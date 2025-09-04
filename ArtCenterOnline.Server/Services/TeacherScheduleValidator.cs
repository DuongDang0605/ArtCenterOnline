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

        private static bool Overlap(TimeSpan a1, TimeSpan a2, TimeSpan b1, TimeSpan b2)
            => a1 < b2 && b1 < a2;

        public async Task<bool> HasOverlapWeeklyAsync(int teacherId, DayOfWeek dow, TimeSpan start, TimeSpan end, int? ignoreClassId = null)
        {
            var q = _db.ClassSchedules
                .Include(s => s.Class)
                .Where(s => s.IsActive && s.DayOfWeek == dow && s.Class!.MainTeacherId == teacherId);

            if (ignoreClassId.HasValue)
                q = q.Where(s => s.ClassID != ignoreClassId.Value);

            return await q.AnyAsync(s => Overlap(start, end, s.StartTime, s.EndTime));
        }

        public async Task<bool> HasOverlapSessionAsync(int teacherId, DateOnly date, TimeSpan start, TimeSpan end, int? ignoreSessionId = null)
        {
            var q = _db.ClassSessions
                .Where(s => s.SessionDate == date && s.TeacherId == teacherId);

            if (ignoreSessionId.HasValue)
                q = q.Where(s => s.SessionId != ignoreSessionId.Value);

            return await q.AnyAsync(s => Overlap(start, end, s.StartTime, s.EndTime));
        }
    }
}
