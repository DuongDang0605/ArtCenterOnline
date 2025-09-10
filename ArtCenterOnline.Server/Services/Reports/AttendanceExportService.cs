// Services/Reports/AttendanceExportService.cs
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO.Reports;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services.Reports
{
    public class AttendanceExportService : IAttendanceExportService
    {
        private readonly AppDbContext _ctx;
        public AttendanceExportService(AppDbContext ctx) => _ctx = ctx;

        public async Task<(byte[] content, string fileName, string contentType)> ExportAttendanceMatrixAsync(
            AttendanceExportQuery q, CancellationToken ct = default)
        {
            // 1) Lấy thông tin lớp
            var cls = await _ctx.Classes
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.ClassID == q.ClassId, ct)
                ?? throw new InvalidOperationException($"Không tìm thấy lớp #{q.ClassId}");

            // 2) Lấy danh sách buổi trong range (kèm TeacherId để lấy tên GV)
            var sessions = await _ctx.ClassSessions
                .Where(s => s.ClassID == q.ClassId
                         && s.SessionDate >= q.From && s.SessionDate <= q.To
                         && (q.IncludeCanceled || s.Status != SessionStatus.Cancelled))
                .OrderBy(s => s.SessionDate)
                .ThenBy(s => s.StartTime)
                .Select(s => new
                {
                    s.SessionId,
                    s.SessionDate,
                    s.StartTime,
                    s.Status,
                    s.TeacherId
                })
                .ToListAsync(ct);

            // 3) Lấy attendance của các buổi
            var sessionIds = sessions.Select(s => s.SessionId).ToList();
            var atts = await _ctx.Attendances
                .Where(a => sessionIds.Contains(a.SessionId))
                .Select(a => new { a.SessionId, a.StudentId, a.IsPresent })
                .ToListAsync(ct);

            // 4) Roster = ClassStudents ∪ Attendance.StudentId
            var classStudentIds = await _ctx.ClassStudents
                .Where(cs => cs.ClassID == q.ClassId)
                .Select(cs => cs.StudentId)
                .ToListAsync(ct);

            var attendanceStudentIds = atts.Select(a => a.StudentId).Distinct();
            var rosterIds = classStudentIds.Concat(attendanceStudentIds).Distinct().ToList();

            var students = await _ctx.Students
                .Where(s => rosterIds.Contains(s.StudentId))
                .Select(s => new { s.StudentId, s.StudentName })
                .OrderBy(s => s.StudentName)
                .ToListAsync(ct);

            // 4b) Orphan: Attendance.StudentId không có trong ClassStudents
            var orphanIds = attendanceStudentIds.Except(classStudentIds).Distinct().ToList();

            // 5) Dựng tra cứu nhanh
            var attLookup = atts.ToDictionary(k => (k.SessionId, k.StudentId), v => v.IsPresent);
            var latestAttByStudent = atts
                .Join(_ctx.ClassSessions, a => a.SessionId, s => s.SessionId, (a, s) => new { a.StudentId, s.SessionDate })
                .GroupBy(x => x.StudentId)
                .ToDictionary(g => g.Key, g => g.Max(x => x.SessionDate));

            // 5b) Lấy tên giáo viên theo buổi (distinct)
            var teacherIds = sessions.Where(s => s.TeacherId.HasValue).Select(s => s.TeacherId!.Value).Distinct().ToList();
            var teacherNamesMap = teacherIds.Count == 0
                ? new Dictionary<int, string>()
                : await _ctx.Teachers
                    .Where(t => teacherIds.Contains(t.TeacherId))
                    .Select(t => new { t.TeacherId, t.TeacherName })
                    .ToDictionaryAsync(x => x.TeacherId, x => x.TeacherName ?? string.Empty, ct);

            string teachersHeader = teacherIds.Count == 0
                ? ""
                : string.Join(", ",
                    sessions.Where(s => s.TeacherId.HasValue)
                            .Select(s => s.TeacherId!.Value)
                            .Distinct()
                            .Select(id => teacherNamesMap.TryGetValue(id, out var n) && !string.IsNullOrWhiteSpace(n) ? n : $"GV #{id}"));

            // 6) Thống kê validate
            int colCount = sessions.Count;
            int cancelledCols = sessions.Count(s => s.Status == SessionStatus.Cancelled);
            int missingCells = 0; // đếm • (buổi không hủy nhưng thiếu attendance)

            // 7) Build Excel
            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Attendance");

            int row = 1;

            // Header thông tin lớp
            ws.Cell(row, 1).Value = "Tên lớp";
            ws.Cell(row, 2).Value = cls.ClassName;
            row++;
            ws.Cell(row, 1).Value = "Mã lớp";
            ws.Cell(row, 2).Value = cls.ClassID;
            row++;
            ws.Cell(row, 1).Value = "Giáo viên (theo lịch)";
            ws.Cell(row, 2).Value = teachersHeader;
            row++;
            ws.Cell(row, 1).Value = "Khoảng thời gian";
            ws.Cell(row, 2).Value = $"{q.From:yyyy-MM-dd} → {q.To:yyyy-MM-dd}";
            row++;
            ws.Cell(row, 1).Value = "Thời điểm xuất";
            ws.Cell(row, 2).Value = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            row++;

            // Dòng chú thích ký hiệu
            ws.Cell(row, 1).Value = "Chú thích";
            ws.Cell(row, 2).Value = "✓ Có mặt; × Vắng; ⊘ Hủy; ↘ Đã rời lớp; • Thiếu dữ liệu";
            row += 2;

            // Header bảng
            int headerRow = row;
            ws.Cell(row, 1).Value = "Học viên";
            ws.Cell(row, 2).Value = "Mã HV";

            // Cột buổi — thêm tên giáo viên theo từng buổi
            for (int i = 0; i < sessions.Count; i++)
            {
                var s = sessions[i];
                string dayName = CultureInfo.GetCultureInfo("vi-VN").DateTimeFormat
                    .GetAbbreviatedDayName(s.SessionDate.DayOfWeek);

                // Lấy tên GV cho cột
                string teacherLabel = "—";
                if (s.TeacherId.HasValue)
                {
                    if (teacherNamesMap.TryGetValue(s.TeacherId.Value, out var tname) && !string.IsNullOrWhiteSpace(tname))
                        teacherLabel = tname;
                    else
                        teacherLabel = $"GV #{s.TeacherId.Value}";
                }

                var title = $"{s.SessionDate:dd/MM} ({dayName})\n{s.StartTime:hh\\:mm}" +
                            (s.Status == SessionStatus.Cancelled ? " (Hủy)" : "") +
                            $"\nGV: {teacherLabel}";

                ws.Cell(row, 3 + i).Value = title;
                ws.Cell(row, 3 + i).Style.Alignment.WrapText = true;
                ws.Cell(row, 3 + i).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                ws.Cell(row, 3 + i).Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            }
            row++;

            // Freeze panes (2 cột đầu + header)
            ws.SheetView.Freeze(headerRow, 2);

            // Dòng dữ liệu
            foreach (var st in students)
            {
                ws.Cell(row, 1).Value = st.StudentName;
                ws.Cell(row, 2).Value = st.StudentId;

                // Ngày rời (ước lượng) = ngày sau lần Attendance cuối cùng của SV trong lớp
                latestAttByStudent.TryGetValue(st.StudentId, out var lastDate);
                DateOnly? leaveAfter = lastDate == default ? (DateOnly?)null : lastDate.AddDays(1);

                for (int i = 0; i < sessions.Count; i++)
                {
                    var s = sessions[i];
                    var col = 3 + i;

                    string mark;
                    if (s.Status == SessionStatus.Cancelled)
                        mark = "⊘";
                    else if (leaveAfter != null && s.SessionDate >= leaveAfter.Value)
                        mark = "↘";
                    else if (attLookup.TryGetValue((s.SessionId, st.StudentId), out bool present))
                        mark = present ? "✓" : "×";
                    else
                    {
                        mark = "•"; // thiếu dữ liệu
                        missingCells++;
                    }

                    var cell = ws.Cell(row, col);
                    cell.Value = mark;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

                    // tô màu theo ký hiệu
                    switch (mark)
                    {
                        case "✓": cell.Style.Font.FontColor = XLColor.Green; break;   // có mặt
                        case "×": cell.Style.Font.FontColor = XLColor.Red; break;     // vắng
                        case "⊘": cell.Style.Font.FontColor = XLColor.Gray; break;    // hủy
                        case "↘": cell.Style.Font.FontColor = XLColor.Orange; break;  // rời lớp
                        case "•": default: cell.Style.Font.FontColor = XLColor.Black; break; // thiếu DL
                    }
                }
                row++;
            }

            // Footer cảnh báo
            row += 1;
            ws.Cell(row, 1).Value = "Tổng quan kiểm tra";
            ws.Cell(row, 1).Style.Font.Bold = true; row++;
            ws.Cell(row, 1).Value = "Số cột (buổi)";
            ws.Cell(row, 2).Value = colCount; row++;
            ws.Cell(row, 1).Value = "Số buổi hủy";
            ws.Cell(row, 2).Value = cancelledCols; row++;
            ws.Cell(row, 1).Value = "Số ô thiếu Attendance (•)";
            ws.Cell(row, 2).Value = missingCells; row++;

            if (orphanIds.Any())
            {
                var orphanList = string.Join(", ", orphanIds.OrderBy(x => x));
                ws.Cell(row, 1).Value = "Cảnh báo";
                ws.Cell(row, 2).Value = $"Có Attendance 'mồ côi' cho StudentId: {orphanList}";
                row++;
            }

            // Styling: border + autofit
            int lastDataRow = headerRow + Math.Max(1, students.Count);
            int lastDataCol = 2 + Math.Max(1, sessions.Count);
            var rngTable = ws.Range(headerRow, 1, lastDataRow, lastDataCol);
            rngTable.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            rngTable.Style.Border.InsideBorder = XLBorderStyleValues.Dotted;
            ws.Columns().AdjustToContents();

            // Xuất
            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            var bytes = ms.ToArray();

            string safeName = string.Join("_", (cls.ClassName ?? $"Class_{cls.ClassID}")
                .Split(Path.GetInvalidFileNameChars()));
            string fileName = $"{safeName}_{q.From:yyyyMMdd}-{q.To:yyyyMMdd}.xlsx";
            const string contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            return (bytes, fileName, contentType);
        }
    }
}
