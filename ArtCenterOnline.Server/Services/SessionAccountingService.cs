// Services/SessionAccountingService.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public interface ISessionAccountingService
    {
        /// <summary>
        /// Hạch toán 1 buổi học:
        /// - +1 TaughtCount cho giáo viên của buổi (theo tháng của SessionDate) nếu buổi có TeacherId.
        /// - +1 SoBuoiHocDaHoc cho MỖI học sinh có bản ghi attendance trong buổi
        ///   (present/absent đều +1), với điều kiện đang active trong lớp.
        /// - Giảm RemainingSessions nếu bạn đang dùng gói buổi.
        /// - Đảm bảo idempotent bằng cờ ClassSession.AccountingApplied.
        /// </summary>
        Task<(bool applied, string? msg)> ApplyAsync(int sessionId);
    }

    public sealed class SessionAccountingService : ISessionAccountingService
    {
        private readonly AppDbContext _db;
        public SessionAccountingService(AppDbContext db) => _db = db;

        public async Task<(bool applied, string? msg)> ApplyAsync(int sessionId)
        {
            using var tx = await _db.Database.BeginTransactionAsync();

            // Chỉ cần lấy session (không còn phụ thuộc GV chính của lớp)
            var s = await _db.ClassSessions
                .FirstOrDefaultAsync(x => x.SessionId == sessionId);

            if (s == null) return (false, "Không tìm thấy buổi học.");
            if (s.Status == SessionStatus.Cancelled) return (false, "Buổi học đã hủy.");
            if (s.AccountingApplied) return (false, "Buổi này đã được hạch toán.");

            string? msg = null;

            // 1) Hạch toán giáo viên theo TeacherId của BUỔI
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

                    // Đồng thời cộng trực tiếp vào TeacherInfo.SoBuoiDayTrongThang
                    var teacherRow = await _db.Teachers.FirstOrDefaultAsync(t => t.TeacherId == s.TeacherId.Value);
                    if (teacherRow != null)
                    {
                        teacherRow.SoBuoiDayTrongThang = (teacherRow.SoBuoiDayTrongThang <= 0)
                            ? 1
                            : teacherRow.SoBuoiDayTrongThang + 1;
                    }
                }
                else
                {
                    stat.TaughtCount += 1;
                }
            }
            else
            {
                // Không có TeacherId ở buổi → bỏ qua phần GV, nhưng vẫn hạch toán học viên
                msg = "Buổi chưa gán giáo viên; đã bỏ qua cộng giờ GV.";
            }

            // 2) Hạch toán học viên theo attendance
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

                st.SoBuoiHocDaHoc = (st.SoBuoiHocDaHoc <= 0) ? 1 : st.SoBuoiHocDaHoc + 1;

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

            // 3) Đánh dấu đã hạch toán
            s.AccountingApplied = true;
            s.AccountingAppliedAtUtc = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return (true, msg);
        }
    }
}
