using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public interface ISessionAccountingService
    {
        Task<(bool applied, string? msg)> ApplyAsync(int sessionId);
    }

    public sealed class SessionAccountingService : ISessionAccountingService
    {
        private readonly AppDbContext _db;
        public SessionAccountingService(AppDbContext db) => _db = db;

        public async Task<(bool applied, string? msg)> ApplyAsync(int sessionId)
        {
            using var tx = await _db.Database.BeginTransactionAsync();

            var s = await _db.ClassSessions.FirstOrDefaultAsync(x => x.SessionId == sessionId);
            if (s == null) return (false, "Không tìm thấy buổi học.");
            if (s.Status == SessionStatus.Cancelled) return (false, "Buổi học đã hủy.");
            if (s.AccountingApplied) return (false, "Buổi này đã được hạch toán.");

            // +1 buổi dạy cho giáo viên của buổi (nếu có)
            if (s.TeacherId.HasValue && s.TeacherId.Value > 0)
            {
                int year = s.SessionDate.Year;
                int month = s.SessionDate.Month;

                var stat = await _db.TeacherMonthlyStats
                    .FirstOrDefaultAsync(t => t.TeacherId == s.TeacherId.Value && t.Year == year && t.Month == month);

                if (stat == null)
                {
                    stat = new TeacherMonthlyStat
                    {
                        TeacherId = s.TeacherId.Value,
                        Year = year,
                        Month = month,
                        TaughtCount = 1
                    };
                    _db.TeacherMonthlyStats.Add(stat);
                }
                else
                {
                    stat.TaughtCount += 1;
                }
            }

            // -1 buổi còn lại cho học sinh Active-on-date có Attendance (Present/Absent)
            var atts = await _db.Attendances
                .Where(a => a.SessionId == sessionId)
                .Select(a => new { a.StudentId })
                .ToListAsync();

            foreach (var a in atts)
            {
                // Đơn giản: dùng IsActive hiện tại (nếu bạn có lịch sử, thay bằng check theo ngày)
                bool activeOnDate = await _db.ClassStudents.AnyAsync(cs =>
                    cs.ClassID == s.ClassID && cs.StudentId == a.StudentId && cs.IsActive);

                if (!activeOnDate) continue;

                var csRow = await _db.ClassStudents
                    .FirstOrDefaultAsync(cs => cs.ClassID == s.ClassID && cs.StudentId == a.StudentId);

                if (csRow == null) continue;

                if (csRow.RemainingSessions > 0)
                    csRow.RemainingSessions -= 1;
                else
                    csRow.RemainingSessions = 0;
            }

            s.AccountingApplied = true;
            s.AccountingAppliedAtUtc = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return (true, null);
        }
    }
}
