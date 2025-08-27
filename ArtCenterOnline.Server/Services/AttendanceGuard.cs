// Services/AttendanceGuard.cs
using System.Security.Claims;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ArtCenterOnline.Server.Services
{
    public interface IAttendanceGuard
    {
        Task<(bool allowed, string? reason)> CanTakeAsync(
            ClaimsPrincipal user, string role, ClassSession session, AppDbContext db);
    }

    public sealed class AttendanceGuard : IAttendanceGuard
    {
        private readonly AttendancePolicyOptions _opt;
        public AttendanceGuard(IOptions<AttendancePolicyOptions> opt) => _opt = opt.Value;

        private DateTime NowLocal()
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(_opt.TimeZoneId);
            return TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);
        }

        // Services/AttendanceGuard.cs
        public async Task<(bool allowed, string? reason)> CanTakeAsync(
            ClaimsPrincipal user, string role, ClassSession session, AppDbContext db)
        {
            // 1) Có cho ghi điểm danh buổi hủy không?
            // Nếu muốn Admin vẫn được ghi, bỏ chặn dòng dưới:
            // if (session.Status == SessionStatus.Cancelled) return (false, "Buổi học đã hủy.");

            // 👉 Bypass toàn bộ kiểm tra cho Admin
            if (role == "Admin")
                return (true, null);

            // 2) Teacher chỉ được điểm danh buổi mình phụ trách
            if (role == "Teacher")
            {
                var userId = user.GetUserId();
                var myTeacherId = await db.Teachers
                    .Where(t => t.UserId == userId)
                    .Select(t => t.TeacherId)
                    .FirstOrDefaultAsync();

                if (myTeacherId == 0) return (false, "Không tìm thấy giáo viên tương ứng với tài khoản.");
                if (session.TeacherId != myTeacherId) return (false, "Bạn không phụ trách buổi này.");
            }

            // 3) Cửa sổ thời gian (chỉ áp cho Teacher)
            var nowLocal = NowLocal();
            if (_opt.Mode == AttendancePolicyOptions.WindowMode.SameDayTesting)
            {
                if (DateOnly.FromDateTime(nowLocal) != session.SessionDate)
                    return (false, "Chỉ cho điểm danh trong đúng ngày của buổi học (chế độ thử).");
                return (true, null);
            }
            else
            {
                var startDt = session.SessionDate.ToDateTime(TimeOnly.FromTimeSpan(session.StartTime));
                var endDt = session.SessionDate.ToDateTime(TimeOnly.FromTimeSpan(session.EndTime));
                var openFrom = startDt - _opt.GraceBefore;
                var openTo = endDt + _opt.GraceAfter;

                if (nowLocal < openFrom || nowLocal > openTo)
                    return (false, $"Ngoài khung thời gian điểm danh ({openFrom:t}–{openTo:t}).");
                return (true, null);
            }
        }

    }
}
