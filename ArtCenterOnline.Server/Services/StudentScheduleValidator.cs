// Services/StudentScheduleValidator.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ArtCenterOnline.Server.Services
{
    public interface IStudentScheduleValidator
    {
        Task<List<string>> CheckForSessionAsync(
            int classId, DateOnly date, TimeSpan start, TimeSpan end, int? excludeSessionId, CancellationToken ct);

        Task<List<string>> CheckForScheduleAsync(
            int classId, DayOfWeek weekday, TimeSpan start, TimeSpan end, DateOnly from, DateOnly to, CancellationToken ct);
    }

    public class StudentScheduleValidator : IStudentScheduleValidator
    {
        private readonly AppDbContext _db;
        public StudentScheduleValidator(AppDbContext db) => _db = db;

        private static string VNDayOfWeek(DayOfWeek d) => d switch
        {
            DayOfWeek.Monday => "Thứ 2",
            DayOfWeek.Tuesday => "Thứ 3",
            DayOfWeek.Wednesday => "Thứ 4",
            DayOfWeek.Thursday => "Thứ 5",
            DayOfWeek.Friday => "Thứ 6",
            DayOfWeek.Saturday => "Thứ 7",
            DayOfWeek.Sunday => "Chủ nhật",
            _ => d.ToString()
        };

        private static string T(TimeSpan t) => t.ToString(@"hh\:mm", CultureInfo.InvariantCulture);
        private static string D(DateOnly d) => d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

        public async Task<List<string>> CheckForSessionAsync(
            int classId, DateOnly date, TimeSpan start, TimeSpan end, int? excludeSessionId, CancellationToken ct)
        {
            var messages = new List<string>();

            // HS đang active của lớp hiện tại
            var studentIds = await _db.ClassStudents
                .Where(cs => cs.ClassID == classId && cs.IsActive)
                .Select(cs => cs.StudentId)
                .ToListAsync(ct);

            if (studentIds.Count == 0) return messages;

            // Các buổi ở LỚP KHÁC cùng ngày + chồng giờ (không tính buổi huỷ)
            var q = from s in _db.ClassSessions
                    join c in _db.Classes on s.ClassID equals c.ClassID into cg
                    from c in cg.DefaultIfEmpty()
                    join cs2 in _db.ClassStudents on s.ClassID equals cs2.ClassID
                    join st in _db.Students on cs2.StudentId equals st.StudentId
                    where s.SessionDate == date
                       && s.Status != SessionStatus.Cancelled
                       && s.ClassID != classId
                       && s.StartTime < end && start < s.EndTime
                       && (excludeSessionId == null || s.SessionId != excludeSessionId.Value)
                       && cs2.IsActive
                       && studentIds.Contains(st.StudentId)
                    select new
                    {
                        st.StudentId,
                        st.StudentName,
                        ConflictClassId = s.ClassID,
                        ConflictClassName = c != null ? c.ClassName : $"ID {s.ClassID}",
                        s.StartTime,
                        s.EndTime,
                        s.SessionDate
                    };

            var rows = await q.ToListAsync(ct);
            foreach (var r in rows)
            {
                // Mẫu: #12 - Nguyễn A · lớp "Vẽ màu nước" · 14:00–15:30 · Thứ 7 06/09/2025
                messages.Add(
                    $"#{r.StudentId} - {r.StudentName} · lớp \"{r.ConflictClassName}\" · {T(r.StartTime)}–{T(r.EndTime)} · {VNDayOfWeek(r.SessionDate.DayOfWeek)} {D(r.SessionDate)}"
                );
            }

            // Loại trùng chuỗi nếu có
            return messages.Distinct().OrderBy(s => s).ToList();
        }

        public async Task<List<string>> CheckForScheduleAsync(
            int classId, DayOfWeek weekday, TimeSpan start, TimeSpan end, DateOnly from, DateOnly to, CancellationToken ct)
        {
            var messages = new List<string>();

            // HS đang active của lớp hiện tại
            var studentIds = await _db.ClassStudents
                .Where(cs => cs.ClassID == classId && cs.IsActive)
                .Select(cs => cs.StudentId)
                .ToListAsync(ct);

            if (studentIds.Count == 0) return messages;

            // Tập ngày trong khoảng [from..to] đúng thứ
            var dates = new List<DateOnly>();
            for (var d = from; d <= to; d = d.AddDays(1))
            {
                if (d.DayOfWeek == weekday) dates.Add(d);
            }
            if (dates.Count == 0) return messages;

            // Các buổi ở LỚP KHÁC trong các ngày đó + chồng giờ (không tính buổi huỷ)
            var q = from s in _db.ClassSessions
                    join c in _db.Classes on s.ClassID equals c.ClassID into cg
                    from c in cg.DefaultIfEmpty()
                    join cs2 in _db.ClassStudents on s.ClassID equals cs2.ClassID
                    join st in _db.Students on cs2.StudentId equals st.StudentId
                    where dates.Contains(s.SessionDate)
                       && s.Status != SessionStatus.Cancelled
                       && s.ClassID != classId
                       && s.StartTime < end && start < s.EndTime
                       && cs2.IsActive
                       && studentIds.Contains(st.StudentId)
                    select new
                    {
                        st.StudentId,
                        st.StudentName,
                        ConflictClassName = c != null ? c.ClassName : $"ID {s.ClassID}",
                        s.StartTime,
                        s.EndTime,
                        s.SessionDate
                    };

            var rows = await q.ToListAsync(ct);
            foreach (var r in rows)
            {
                // Mẫu (lịch mẫu, vẫn báo theo session thực tế → có thứ/ngày):
                // #12 - Nguyễn A · lớp "Vẽ màu nước" · 18:00–20:00 · Thứ 5 11/09/2025
                messages.Add(
                    $"#{r.StudentId} - {r.StudentName} · lớp \"{r.ConflictClassName}\" · {T(r.StartTime)}–{T(r.EndTime)} · {VNDayOfWeek(r.SessionDate.DayOfWeek)} {D(r.SessionDate)}"
                );
            }

            return messages.Distinct().OrderBy(s => s).ToList();
        }
    }
}
