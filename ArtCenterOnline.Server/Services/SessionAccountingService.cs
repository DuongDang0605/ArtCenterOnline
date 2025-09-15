// Service/SessionAccountingService.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public interface ISessionAccountingService
    {
        /// <summary>
        /// Hạch toán 1 buổi học.
        /// - Lần đầu (AccountingApplied = false && teacherOnly = false):
        ///   + Cộng số buổi học cho học sinh có attendance (present/absent đều +1) còn active trong lớp.
        ///   + Đánh dấu Session.AccountingApplied = true.
        /// - Luôn luôn: Đồng bộ lại số buổi dạy của giáo viên trong THÁNG của buổi
        ///   bằng cách **tính lại** từ bảng ClassSessions (status = Completed) → TeacherMonthlyStat
        ///   và TeacherInfo.SoBuoiDayTrongThang. Việc tính lại giúp re-apply không cần đổi DB.
        /// - Nếu teacherOnly = true: Bỏ qua phần học sinh kể cả lần đầu.
        /// </summary>
        Task<(bool applied, string? msg)> ApplyAsync(int sessionId, bool teacherOnly = false);
    }

    public sealed class SessionAccountingService : ISessionAccountingService
    {
        private readonly AppDbContext _db;
        public SessionAccountingService(AppDbContext db) => _db = db;

        public async Task<(bool applied, string? msg)> ApplyAsync(int sessionId, bool teacherOnly = false)
        {
            using var tx = await _db.Database.BeginTransactionAsync();

            var s = await _db.ClassSessions.FirstOrDefaultAsync(x => x.SessionId == sessionId);
            if (s == null) return (false, "Không tìm thấy buổi học.");
            if (s.Status == SessionStatus.Cancelled) return (false, "Buổi học đã hủy.");

            // ============ 1) Hạch toán HỌC SINH (chỉ 1 lần, trừ khi teacherOnly) ============
            // Yêu cầu: present/absent đều +1 cho HS còn active trong lớp tại thời điểm buổi học.
            // Không hạch toán lại HS ở lần sau để tránh đếm trùng.
            if (!teacherOnly && !s.AccountingApplied)
            {
                var atts = await _db.Attendances
                    .Where(a => a.SessionId == sessionId)
                    .Select(a => new { a.StudentId })
                    .ToListAsync();

                foreach (var a in atts)
                {
                    bool activeInClass = await _db.ClassStudents.AnyAsync(cs =>
                        cs.ClassID == s.ClassID && cs.StudentId == a.StudentId && cs.IsActive);
                    if (!activeInClass) continue;

                    var st = await _db.Students.FirstOrDefaultAsync(x => x.StudentId == a.StudentId);
                    if (st == null) continue;

                    st.SoBuoiHocDaHoc = st.SoBuoiHocDaHoc <= 0 ? 1 : st.SoBuoiHocDaHoc + 1;

                    var csRow = await _db.ClassStudents.FirstOrDefaultAsync(cs =>
                        cs.ClassID == s.ClassID && cs.StudentId == a.StudentId);
                    if (csRow != null)
                    {
                        if (csRow.RemainingSessions > 0)
                            csRow.RemainingSessions -= 1;
                        else
                            csRow.RemainingSessions = 0;
                    }
                }

                s.AccountingApplied = true;
                s.AccountingAppliedAtUtc = DateTime.UtcNow;
                await _db.SaveChangesAsync();
            }

            // ============ 2) Đồng bộ lại số buổi dạy giáo viên trong THÁNG của buổi ============
            // Không tăng/giảm kiểu cộng dồn nữa → thay bằng TÍNH LẠI từ bảng ClassSessions
            // (status = Completed, TeacherId != null, cùng Year/Month của session này).
            await RecomputeTeacherMonthAsync(s.SessionDate.Year, s.SessionDate.Month);

            await tx.CommitAsync();
            return (true, teacherOnly ? "Đã hạch toán lại giáo viên (chỉ GV)." : s.AccountingApplied ? "Đã hạch toán." : "Đã hạch toán.");
        }

        /// <summary>
        /// Tính lại TeacherMonthlyStat và TeacherInfo.SoBuoiDayTrongThang cho (year, month)
        /// dựa trên số buổi trong ClassSessions có Status = Completed.
        /// </summary>
        private async Task RecomputeTeacherMonthAsync(int year, int month)
        {
            // Lấy các buổi Completed trong tháng → group theo TeacherId.
            var start = new DateOnly(year, month, 1);
            var end = start.AddMonths(1).AddDays(-1);

            var taughtCounts = await _db.ClassSessions
                .Where(s => s.SessionDate >= start && s.SessionDate <= end
                            && s.Status == SessionStatus.Completed
                            && s.TeacherId != null)
                .GroupBy(s => s.TeacherId!.Value)
                .Select(g => new { TeacherId = g.Key, Count = g.Count() })
                .ToListAsync();

            // Bản đồ kết quả để tra nhanh
            var dict = taughtCounts.ToDictionary(x => x.TeacherId, x => x.Count);

            // Đồng bộ bảng thống kê tháng
            var existing = await _db.TeacherMonthlyStats
                .Where(t => t.Year == year && t.Month == month)
                .ToListAsync();

            // Cập nhật hoặc thêm mới theo dict
            foreach (var kv in dict)
            {
                var stat = existing.FirstOrDefault(e => e.TeacherId == kv.Key);
                if (stat == null)
                {
                    _db.TeacherMonthlyStats.Add(new TeacherMonthlyStat
                    {
                        TeacherId = kv.Key,
                        Year = year,
                        Month = month,
                        TaughtCount = kv.Value
                    });
                }
                else
                {
                    stat.TaughtCount = kv.Value;
                }
            }

            // Những stat thừa (giáo viên không còn buổi trong tháng) → đưa về 0
            foreach (var stat in existing)
            {
                if (!dict.ContainsKey(stat.TeacherId))
                    stat.TaughtCount = 0;
            }

            // Đồng bộ cột hiển thị nhanh ở TeacherInfo (SoBuoiDayTrongThang)
            var allTeachers = await _db.Teachers.ToListAsync();
            foreach (var t in allTeachers)
            {
                t.SoBuoiDayTrongThang = dict.TryGetValue(t.TeacherId, out var c) ? c : 0;
            }

            await _db.SaveChangesAsync();
        }
    }
}
