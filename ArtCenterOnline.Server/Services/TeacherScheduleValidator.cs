using ArtCenterOnline.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public interface ITeacherScheduleValidator
    {
        Task<bool> HasOverlapWeeklyAsync(int teacherId, DayOfWeek dow, TimeSpan start, TimeSpan end, int? ignoreClassId = null);
        Task<bool> HasOverlapSessionAsync(int teacherId, DateOnly date, TimeSpan start, TimeSpan end, int? ignoreSessionId = null);
    }

    public class TeacherScheduleValidator : ITeacherScheduleValidator
    {
        private readonly AppDbContext _db;
        public TeacherScheduleValidator(AppDbContext db) => _db = db;

        /// <summary>
        /// Kiểm tra trùng theo lịch tuần (cùng DayOfWeek).
        /// Quy ước: chỉ coi là TRÙNG nếu các khoảng thời gian giao nhau thực sự:
        /// (aStart < bEnd) && (aEnd > bStart). Biên chạm nhau (==) KHÔNG tính trùng.
        /// </summary>
        public async Task<bool> HasOverlapWeeklyAsync(
            int teacherId, DayOfWeek dow, TimeSpan start, TimeSpan end, int? ignoreClassId = null)
        {
            // tip: giữ biến cục bộ để EF không “lôi” start/end nhiều lần
            var aStart = start;
            var aEnd = end;
            var dowInt = (int)dow;

            var q = _db.ClassSchedules
                .Where(c => c.IsActive
                         && c.TeacherId == teacherId
                         && (int)c.DayOfWeek == dowInt);

            if (ignoreClassId.HasValue)
                q = q.Where(c => c.ClassID != ignoreClassId.Value);

            // **INLINE điều kiện overlap** thay vì gọi hàm Overlap(...)
            // Điều kiện: aStart < c.EndTime && aEnd > c.StartTime
            return await q.AnyAsync(c => aStart < c.EndTime && aEnd > c.StartTime);
        }

        /// <summary>
        /// Kiểm tra trùng cho 1 BUỔI (date cụ thể).
        /// </summary>
        public async Task<bool> HasOverlapSessionAsync(
            int teacherId, DateOnly date, TimeSpan start, TimeSpan end, int? ignoreSessionId = null)
        {
            var aStart = start;
            var aEnd = end;

            var q = _db.ClassSessions
                .Where(s => s.SessionDate == date && s.TeacherId == teacherId);

            if (ignoreSessionId.HasValue)
                q = q.Where(s => s.SessionId != ignoreSessionId.Value);

            // **INLINE overlap** giống trên
            return await q.AnyAsync(s => aStart < s.EndTime && aEnd > s.StartTime);
        }

        // Nếu bạn vẫn muốn giữ hàm helper dùng ở nơi KHÔNG query EF:
        // private static bool Overlap(TimeSpan aStart, TimeSpan aEnd, TimeSpan bStart, TimeSpan bEnd)
        //     => aStart < bEnd && aEnd > bStart; // không dùng bên trong AnyAsync gửi SQL
    }
}
