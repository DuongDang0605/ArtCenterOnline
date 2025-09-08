// Services/Reports/ReportsService.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO.Reports;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services.Reports
{
    public class ReportsService : IReportsService
    {
        private readonly AppDbContext _ctx;
        public ReportsService(AppDbContext ctx) => _ctx = ctx;

        public async Task<MonthlyOverviewDto> GetMonthlyOverviewAsync(DateOnly month, CancellationToken ct = default)
        {
            // Mốc thời gian tháng này / trước (DateOnly để so với cột DateOnly trong DB)
            var first = new DateTime(month.Year, month.Month, 1);
            var nextFirst = first.AddMonths(1);
            var prevFirst = first.AddMonths(-1);

            var doFirst = DateOnly.FromDateTime(first);
            var doNextFirst = DateOnly.FromDateTime(nextFirst);
            var doPrevFirst = DateOnly.FromDateTime(prevFirst);

            // ===== 1) Học viên mới trong tháng =====
            int newThis = await _ctx.Students.CountAsync(
                s => s.ngayBatDauHoc >= doFirst && s.ngayBatDauHoc < doNextFirst, ct);

            int newPrev = await _ctx.Students.CountAsync(
                s => s.ngayBatDauHoc >= doPrevFirst && s.ngayBatDauHoc < doFirst, ct);

            double newDelta = CalcDeltaPct(newPrev, newThis);
            // ===== 2) Số buổi / buổi hủy trong tháng (this & prev) =====
            var today = DateOnly.FromDateTime(DateTime.Today);

            // Mốc kết thúc cho "tháng này" chỉ tính đến hôm nay
            DateOnly endThis;
            if (doFirst.Year == today.Year && doFirst.Month == today.Month)
            {
                endThis = today.AddDays(1);          // bao gồm hôm nay (dùng điều kiện < endThis)
            }
            else if (doFirst > today)
            {
                endThis = doFirst;                   // tháng tương lai -> 0
            }
            else
            {
                endThis = doNextFirst;               // tháng quá khứ -> trọn tháng
            }

            // Tổng số buổi (mọi trạng thái) "tính đến hôm nay" trong tháng này – làm mẫu số cho cancelRate
            int sessionsTotalThisMonth = await _ctx.ClassSessions.CountAsync(
                s => s.SessionDate >= doFirst && s.SessionDate < endThis, ct);

            // ĐÃ HOÀN THÀNH trong tháng này (tính đến hôm nay)
            int sessionsThisMonth = await _ctx.ClassSessions.CountAsync(
                s => s.SessionDate >= doFirst && s.SessionDate < endThis
                  && s.Status == SessionStatus.Completed, ct);

            // ĐÃ HỦY trong tháng này (tính đến hôm nay)
            int sessionsCanceled = await _ctx.ClassSessions.CountAsync(
                s => s.SessionDate >= doFirst && s.SessionDate < endThis
                  && s.Status == SessionStatus.Cancelled, ct);

            // Tháng trước: giữ nguyên tính trọn tháng
            int sessionsPrev = await _ctx.ClassSessions.CountAsync(
                s => s.SessionDate >= doPrevFirst && s.SessionDate < doFirst
                  && s.Status == SessionStatus.Completed, ct);

            int sessionsCanceledPrev = await _ctx.ClassSessions.CountAsync(
                s => s.SessionDate >= doPrevFirst && s.SessionDate < doFirst
                  && s.Status == SessionStatus.Cancelled, ct);

            // Tỷ lệ hủy = số buổi hủy / tổng số buổi (mọi trạng thái) "tính đến hôm nay"
            double cancelRate = sessionsTotalThisMonth == 0
                ? 0
                : Math.Round(sessionsCanceled * 100.0 / sessionsTotalThisMonth, 2);


            // ===== 3) Attendance: kéo về bộ nhớ để tính an toàn =====
            var attThis = await (
                from a in _ctx.Attendances
                join s in _ctx.ClassSessions on a.SessionId equals s.SessionId
                where s.SessionDate >= doFirst && s.SessionDate < doNextFirst
                select new { a.IsPresent, s.SessionDate, s.ClassID, s.TeacherId }
            ).ToListAsync(ct);

            var attPrev = await (
                from a in _ctx.Attendances
                join s in _ctx.ClassSessions on a.SessionId equals s.SessionId
                where s.SessionDate >= doPrevFirst && s.SessionDate < doFirst
                select new { a.IsPresent, s.SessionDate, s.ClassID, s.TeacherId }
            ).ToListAsync(ct);

            int attTotalThis = attThis.Count;
            int attPresentThis = attThis.Count(x => x.IsPresent);
            int attTotalPrev = attPrev.Count;
            int attPresentPrev = attPrev.Count(x => x.IsPresent);

            double attendanceThis = attTotalThis == 0 ? 0 : attPresentThis * 100.0 / attTotalThis;
            double attendancePrev = attTotalPrev == 0 ? 0 : attPresentPrev * 100.0 / attTotalPrev;
            double attendanceDelta = Math.Round(attendanceThis - attendancePrev, 2);

            // ===== 4) Series theo ngày =====
            var attendanceSeries = attThis
                .GroupBy(x => x.SessionDate)
                .AsEnumerable()
                .Select(g => new SeriesPoint
                {
                    Label = g.Key.Day.ToString("00"),
                    Value = g.Count() == 0 ? 0 : Math.Round(g.Count(y => y.IsPresent) * 100.0 / g.Count(), 1)
                })
                .OrderBy(p => p.Label)
                .ToList();

            var attendanceSeriesPrev = attPrev
                .GroupBy(x => x.SessionDate)
                .AsEnumerable()
                .Select(g => new SeriesPoint
                {
                    Label = g.Key.Day.ToString("00"),
                    Value = g.Count() == 0 ? 0 : Math.Round(g.Count(y => y.IsPresent) * 100.0 / g.Count(), 1)
                })
                .OrderBy(p => p.Label)
                .ToList();

            // ===== 5) Top lớp / giáo viên theo tỉ lệ điểm danh =====
            // --- Chốt mốc "hôm nay" (nếu SessionDate là DateTime) ---
          


            // Nếu SessionDate là DateOnly, dùng:
            // var today = DateOnly.FromDateTime(DateTime.Today);

            // Lấy dữ liệu điểm danh của các buổi HÔM NAY, gắn theo lớp & giáo viên của BUỔI
            var attToday = await (
                 from a in _ctx.Attendances
                 join s in _ctx.ClassSessions on a.SessionId equals s.SessionId
                 where s.SessionDate == today               // so sánh DateOnly với DateOnly
                 && s.Status != SessionStatus.Cancelled
                    select new
                            {
                                 ClassID = s.ClassID,
                                 TeacherId = s.TeacherId,               // GV của buổi (Admin điểm hộ vẫn tính cho GV này)
                                    IsPresent = a.IsPresent
                                }
                        ).ToListAsync(ct);

            // ===== 5) Top lớp / giáo viên theo tỉ lệ điểm danh (THEO THÁNG) =====
            var attRange = await (
                from a in _ctx.Attendances
                join s in _ctx.ClassSessions on a.SessionId equals s.SessionId
                where s.SessionDate >= doFirst && s.SessionDate < endThis
                      && s.Status == SessionStatus.Completed // chỉ buổi đã diễn ra
                select new { a.IsPresent, s.ClassID, s.TeacherId }
            ).ToListAsync(ct);

            // --- TOP LỚP ---
            var topClassesRaw = attRange
                .GroupBy(x => x.ClassID)
                .Select(g => new { key = g.Key, total = g.Count(), present = g.Count(x => x.IsPresent) })
                .Where(x => x.total > 0)
                .OrderByDescending(x => x.present * 1.0 / x.total)
                .ThenByDescending(x => x.present)
                .Take(5)
                .ToList();

            var classIds = topClassesRaw.Select(t => t.key).Where(id => id != 0).Distinct().ToList();
            var classNames = await _ctx.Classes
                .Where(c => classIds.Contains(c.ClassID))
                .Select(c => new { c.ClassID, c.ClassName })
                .ToDictionaryAsync(x => x.ClassID, x => x.ClassName, ct);

            var topClasses = topClassesRaw.Select(x => new NameValue
            {
                Name = (x.key != 0 && classNames.TryGetValue(x.key, out var n)) ? n : $"Class {x.key}",
                Value = Math.Round(x.present * 100.0 / x.total, 1)
            }).ToList();

            // --- TOP GIÁO VIÊN ---
            var topTeachersRaw = attRange
                .Where(x => x.TeacherId != null)
                .GroupBy(x => x.TeacherId!.Value)
                .Select(g => new { key = g.Key, total = g.Count(), present = g.Count(x => x.IsPresent) })
                .Where(x => x.total > 0)
                .OrderByDescending(x => x.present * 1.0 / x.total)
                .ThenByDescending(x => x.present)
                .Take(5)
                .ToList();

            var teacherIds = topTeachersRaw.Select(t => t.key).Distinct().ToList();
            var teacherNames = await _ctx.Teachers
                .Where(t => teacherIds.Contains(t.TeacherId))
                .Select(t => new { t.TeacherId, t.TeacherName })
                .ToDictionaryAsync(x => x.TeacherId, x => x.TeacherName, ct);

            var topTeachers = topTeachersRaw.Select(x => new NameValue
            {
                Name = teacherNames.TryGetValue(x.key, out var n) ? n : $"Teacher {x.key}",
                Value = Math.Round(x.present * 100.0 / x.total, 1)
            }).ToList();



            // ===== 6) LeftStudents: tắt tạm theo yêu cầu =====
            int leftThis = 0, leftPrev = 0;
            double leftDelta = 0;

            // ===== Kết quả =====
            return new MonthlyOverviewDto
            {
                Month = $"{month:yyyy-MM}",

                NewStudents = newThis,
                NewStudentsPrev = newPrev,
                NewStudentsDeltaPct = Math.Round(newDelta, 1),

                LeftStudents = leftThis,
                LeftStudentsPrev = leftPrev,
                LeftStudentsDeltaPct = Math.Round(leftDelta, 1),

                AttendanceRate = Math.Round(attendanceThis, 2),
                AttendanceRatePrev = Math.Round(attendancePrev, 2),
                AttendanceRateDeltaPct = attendanceDelta,

                SessionsThisMonth = sessionsThisMonth,
                SessionsCanceled = sessionsCanceled,
                SessionsThisMonthPrev = sessionsPrev,
                SessionsCanceledPrev = sessionsCanceledPrev,

                CancelRate = cancelRate,

                AttendanceSeries = attendanceSeries,
                AttendanceSeriesPrev = attendanceSeriesPrev,
                TopClassesByAttendance = topClasses,
                TopTeachersByAttendance = topTeachers
            };
        }

        public async Task<List<StudentAttendanceRateDto>> GetStudentAttendanceRatesAsync(
            DateOnly month, int? classId = null, CancellationToken ct = default)
        {
            var first = new DateOnly(month.Year, month.Month, 1);
            var next = first.AddMonths(1);

            // Lấy attendance của các buổi trong tháng (lọc theo class nếu có)
            var baseQuery =
                from a in _ctx.Attendances
                join s in _ctx.ClassSessions on a.SessionId equals s.SessionId
                where s.SessionDate >= first && s.SessionDate < next
                select new { a.StudentId, a.IsPresent, s.ClassID };

            if (classId.HasValue && classId.Value > 0)
                baseQuery = baseQuery.Where(x => x.ClassID == classId.Value);

            // Gom theo học sinh: total = tất cả attendance, present = IsPresent = true
            var agg = await baseQuery
                .GroupBy(x => x.StudentId)
                .Select(g => new
                {
                    StudentId = g.Key,
                    Total = g.Count(),
                    Present = g.Count(x => x.IsPresent)
                })
                .Where(x => x.Total > 0)
                .ToListAsync(ct);

            if (agg.Count == 0) return new List<StudentAttendanceRateDto>();

            // Lấy tên học sinh
            var ids = agg.Select(x => x.StudentId).Distinct().ToList();
            var nameMap = await _ctx.Students
                .Where(st => ids.Contains(st.StudentId))
                .Select(st => new { st.StudentId, st.StudentName })
                .ToDictionaryAsync(x => x.StudentId, x => x.StudentName, ct);

            // Map ra DTO, sắp xếp theo Rate giảm dần
            return agg
                .Select(x =>
                {
                    var rate = x.Present * 100.0 / x.Total;
                    nameMap.TryGetValue(x.StudentId, out var name);
                    return new StudentAttendanceRateDto
                    {
                        StudentId = x.StudentId,
                        StudentName = name ?? $"Student {x.StudentId}",
                        TotalSessions = x.Total,
                        PresentSessions = x.Present,
                        RatePct = Math.Round(rate, 2)
                    };
                })
                .OrderByDescending(d => d.RatePct)
                .ThenBy(d => d.StudentName)
                .ToList();
        }

        // Helper: % thay đổi so với tháng trước
        private static double CalcDeltaPct(int prev, int cur)
            => prev <= 0 ? (cur > 0 ? 100.0 : 0.0) : (cur - prev) * 100.0 / prev;
    }
}
