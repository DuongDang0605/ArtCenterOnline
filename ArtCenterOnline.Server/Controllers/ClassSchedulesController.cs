using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ClassSchedulesController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITeacherScheduleValidator _teacherValidator;
        private readonly IStudentScheduleValidator _studentValidator;

        public ClassSchedulesController(
            AppDbContext db,
            ITeacherScheduleValidator teacherValidator,
            IStudentScheduleValidator studentValidator)
        {
            _db = db;
            _teacherValidator = teacherValidator;
            _studentValidator = studentValidator;
        }

        // ===== DTOs =====
        public class ScheduleDto
        {
            public int ScheduleId { get; set; }
            public int ClassID { get; set; }
            public int DayOfWeek { get; set; } // 0..6
            public string StartTime { get; set; } = "00:00:00";
            public string EndTime { get; set; } = "00:00:00";
            public bool IsActive { get; set; }
            public string? Note { get; set; }
            public int? TeacherId { get; set; }
            public string? TeacherName { get; set; }
        }

        public class UpsertScheduleDto
        {
            public int ClassID { get; set; }
            public int DayOfWeek { get; set; } // 0..6
            public string StartTime { get; set; } = "";
            public string EndTime { get; set; } = "";
            public bool IsActive { get; set; } = true;
            public string? Note { get; set; }
            public int? TeacherId { get; set; }
        }

        public class PreflightTeacherDto
        {
            public int ClassID { get; set; }
            public int DayOfWeek { get; set; } // 0..6
            public string StartTime { get; set; } = "";
            public string EndTime { get; set; } = "";
            public int TeacherId { get; set; }
            public int? IgnoreScheduleId { get; set; } // khi edit, bỏ qua chính nó
        }

        // ===== Helpers =====
        private static TimeSpan ParseTime(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) throw new ArgumentException("Time is required.");
            var parts = s.Split(':');
            if (parts.Length < 2) throw new ArgumentException("Invalid time format.");
            int h = int.Parse(parts[0]), m = int.Parse(parts[1]), sec = parts.Length >= 3 ? int.Parse(parts[2]) : 0;
            return new TimeSpan(h, m, sec);
        }

        private static ScheduleDto ToDto(ClassSchedule x) => new ScheduleDto
        {
            ScheduleId = x.ScheduleId,
            ClassID = x.ClassID,
            DayOfWeek = (int)x.DayOfWeek,
            StartTime = x.StartTime.ToString(@"hh\:mm\:ss"),
            EndTime = x.EndTime.ToString(@"hh\:mm\:ss"),
            IsActive = x.IsActive,
            Note = x.Note,
            TeacherId = x.TeacherId,
            TeacherName = x.Teacher?.TeacherName
        };

        private static string ViDow(int dow)
        {
            return dow switch
            {
                0 => "Chủ nhật",
                1 => "Thứ 2",
                2 => "Thứ 3",
                3 => "Thứ 4",
                4 => "Thứ 5",
                5 => "Thứ 6",
                6 => "Thứ 7",
                _ => $"Thứ {dow}"
            };
        }

        private static string Tfmt(TimeSpan t) => t.ToString(@"hh\:mm");

        private async Task<string?> GetClassNameAsync(int classId, CancellationToken ct)
        {
            // Lưu ý: tùy DbSet có thể là _db.Classes hoặc _db.ClassInfos → nếu khác, đổi tên cho khớp.
            var cls = await _db.Classes
                .AsNoTracking()
                .Where(c => c.ClassID == classId)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync(ct);
            return cls;
        }

        private async Task<object?> FindTeacherOverlapDetailAsync(
            int teacherId, int? ignoreScheduleId, DayOfWeek dow, TimeSpan start, TimeSpan end, CancellationToken ct)
        {
            // Lấy lịch đầu tiên trùng (nếu có) kèm lớp & GV
            var q = _db.ClassSchedules
                .Include(c => c.Teacher)
                // Nếu entity có navigation Class thì có thể Include(c => c.Class) — không bắt buộc
                .Where(c =>
                    c.IsActive &&
                    c.TeacherId == teacherId &&
                    (int)c.DayOfWeek == (int)dow &&
                    start < c.EndTime && end > c.StartTime);

            if (ignoreScheduleId.HasValue)
                q = q.Where(c => c.ScheduleId != ignoreScheduleId.Value);

            var row = await q
                .OrderBy(c => c.StartTime)
                .Select(c => new
                {
                    c.ScheduleId,
                    c.ClassID,
                    TeacherId = c.TeacherId,
                    TeacherName = c.Teacher != null ? c.Teacher.TeacherName : null,
                    DayOfWeek = (int)c.DayOfWeek,
                    c.StartTime,
                    c.EndTime
                })
                .FirstOrDefaultAsync(ct);

            if (row == null) return null;

            var className = await GetClassNameAsync(row.ClassID, ct);
            return new
            {
                type = "teacher",
                teacherId = row.TeacherId,
                teacherName = row.TeacherName,
                classId = row.ClassID,
                className = className ?? $"#{row.ClassID}",
                scheduleId = row.ScheduleId,
                dayOfWeek = row.DayOfWeek,
                dayName = ViDow(row.DayOfWeek),
                start = Tfmt(row.StartTime),
                end = Tfmt(row.EndTime)
            };
        }

        private async Task<object?> FindDuplicateScheduleInClassAsync(
            int classId, int? ignoreScheduleId, DayOfWeek dow, TimeSpan start, TimeSpan end, CancellationToken ct)
        {
            var dup = await _db.ClassSchedules
                .Where(s =>
                    s.ClassID == classId &&
                    s.IsActive &&
                    (int)s.DayOfWeek == (int)dow &&
                    s.StartTime == start &&
                    s.EndTime == end &&
                    (!ignoreScheduleId.HasValue || s.ScheduleId != ignoreScheduleId.Value))
                .Select(s => new { s.ScheduleId })
                .FirstOrDefaultAsync(ct);

            if (dup == null) return null;

            var className = await GetClassNameAsync(classId, ct);
            return new
            {
                type = "duplicate",
                scheduleId = dup.ScheduleId,
                classId,
                className = className ?? $"#{classId}",
                dayOfWeek = (int)dow,
                dayName = ViDow((int)dow),
                start = Tfmt(start),
                end = Tfmt(end)
            };
        }

        // ===== Endpoints =====

        // GET: api/ClassSchedules/by-class/{classId}
        [HttpGet("by-class/{classId:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> GetByClass(int classId, CancellationToken ct)
        {
            var rows = await _db.ClassSchedules
                .Include(s => s.Teacher)
                .Where(s => s.ClassID == classId)
                .OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
                .ToListAsync(ct);

            return Ok(rows.Select(ToDto).ToList());
        }

        // GET: api/ClassSchedules/{id}
        [HttpGet("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> GetOne(int id, CancellationToken ct)
        {
            var s = await _db.ClassSchedules.Include(x => x.Teacher).FirstOrDefaultAsync(x => x.ScheduleId == id, ct);
            if (s == null) return NotFound();
            return Ok(ToDto(s));
        }

        // Helpers parse DateOnly
        private static DateOnly ParseDateOnly(string s)
        {
            var dt = DateTime.Parse(s);
            return new DateOnly(dt.Year, dt.Month, dt.Day);
        }

        [HttpGet("{id:int}/check-student-overlap")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> CheckStudentOverlap(
            int id,
            [FromQuery] string? from,
            [FromQuery] string? to,
            CancellationToken ct = default)
        {
            var sch = await _db.ClassSchedules
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ScheduleId == id, ct);

            if (sch == null) return NotFound();

            var today = DateTime.Today;
            var defFrom = new DateOnly(today.Year, today.Month, 1);
            var defTo = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

            var fromD = string.IsNullOrWhiteSpace(from) ? defFrom : ParseDateOnly(from);
            var toD = string.IsNullOrWhiteSpace(to) ? defTo : ParseDateOnly(to);

            var messages = await _studentValidator.CheckForScheduleAsync(
                sch.ClassID, sch.DayOfWeek, sch.StartTime, sch.EndTime, fromD, toD, ct);

            return Ok(messages); // [] nếu không có cảnh báo
        }

        // POST: api/ClassSchedules/preflight-teacher — trả về lỗi CHI TIẾT nếu trùng
        [HttpPost("preflight-teacher")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> PreflightTeacher([FromBody] PreflightTeacherDto dto, CancellationToken ct)
        {
            if (dto.TeacherId <= 0)
                return BadRequest(new { error = "InvalidTeacher", message = "Vui lòng chọn giáo viên." });

            var start = ParseTime(dto.StartTime);
            var end = ParseTime(dto.EndTime);
            if (end <= start)
                return BadRequest(new { error = "InvalidTime", message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            // Chi tiết xung đột (nếu có)
            var detail = await FindTeacherOverlapDetailAsync(
                dto.TeacherId, dto.IgnoreScheduleId, (DayOfWeek)dto.DayOfWeek, start, end, ct);

            if (detail != null)
            {
                var tName = (string?)detail.GetType().GetProperty("teacherName")?.GetValue(detail) ?? "Giáo viên";
                var cName = (string?)detail.GetType().GetProperty("className")?.GetValue(detail) ?? $"#{dto.ClassID}";
                var dayName = (string?)detail.GetType().GetProperty("dayName")?.GetValue(detail) ?? ViDow(dto.DayOfWeek);
                var st = (string?)detail.GetType().GetProperty("start")?.GetValue(detail) ?? Tfmt(start);
                var en = (string?)detail.GetType().GetProperty("end")?.GetValue(detail) ?? Tfmt(end);

                return Conflict(new
                {
                    error = "TeacherOverlap",
                    message = $"{tName} trùng lịch ở lớp {cName} — {dayName} {st}-{en}.",
                    conflicts = new[] { detail }
                });
            }

            return Ok(new { conflict = false });
        }

        // POST: api/ClassSchedules
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Create([FromBody] UpsertScheduleDto dto, CancellationToken ct)
        {
            var start = ParseTime(dto.StartTime);
            var end = ParseTime(dto.EndTime);
            if (end <= start)
                return BadRequest(new { error = "InvalidTime", message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            // 1) Trùng lịch của lớp (lịch giống hệt)
            var dup = await FindDuplicateScheduleInClassAsync(
                dto.ClassID, null, (DayOfWeek)dto.DayOfWeek, start, end, ct);
            if (dup != null)
            {
                var cName = (string?)dup.GetType().GetProperty("className")?.GetValue(dup) ?? $"#{dto.ClassID}";
                var dayName = (string?)dup.GetType().GetProperty("dayName")?.GetValue(dup) ?? ViDow(dto.DayOfWeek);
                var st = (string?)dup.GetType().GetProperty("start")?.GetValue(dup) ?? Tfmt(start);
                var en = (string?)dup.GetType().GetProperty("end")?.GetValue(dup) ?? Tfmt(end);

                return Conflict(new
                {
                    error = "DuplicateSchedule",
                    message = $"Lớp {cName} đã có lịch {dayName} {st}-{en}.",
                    duplicate = dup
                });
            }

            // 2) Trùng lịch giáo viên (chi tiết)
            if (dto.TeacherId.HasValue)
            {
                var detail = await FindTeacherOverlapDetailAsync(
                    dto.TeacherId.Value, null, (DayOfWeek)dto.DayOfWeek, start, end, ct);
                if (detail != null)
                {
                    var tName = (string?)detail.GetType().GetProperty("teacherName")?.GetValue(detail) ?? "Giáo viên";
                    var cName = (string?)detail.GetType().GetProperty("className")?.GetValue(detail) ?? $"#{dto.ClassID}";
                    var dayName = (string?)detail.GetType().GetProperty("dayName")?.GetValue(detail) ?? ViDow(dto.DayOfWeek);
                    var st = (string?)detail.GetType().GetProperty("start")?.GetValue(detail) ?? Tfmt(start);
                    var en = (string?)detail.GetType().GetProperty("end")?.GetValue(detail) ?? Tfmt(end);

                    return Conflict(new
                    {
                        error = "TeacherOverlap",
                        message = $"{tName} trùng lịch ở lớp {cName} — {dayName} {st}-{en}.",
                        conflicts = new[] { detail }
                    });
                }
            }

            var entity = new ClassSchedule
            {
                ClassID = dto.ClassID,
                DayOfWeek = (DayOfWeek)dto.DayOfWeek,
                StartTime = start,
                EndTime = end,
                IsActive = dto.IsActive,
                Note = dto.Note,
                TeacherId = dto.TeacherId
            };

            _db.ClassSchedules.Add(entity);
            await _db.SaveChangesAsync(ct);

            var withTeacher = await _db.ClassSchedules.Include(x => x.Teacher).FirstAsync(x => x.ScheduleId == entity.ScheduleId, ct);
            return Ok(ToDto(withTeacher));
        }

        // PUT: api/ClassSchedules/{id}
        [HttpPut("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Update(int id, [FromBody] UpsertScheduleDto dto, CancellationToken ct)
        {
            var s = await _db.ClassSchedules.Include(x => x.Teacher).FirstOrDefaultAsync(x => x.ScheduleId == id, ct);
            if (s == null) return NotFound();

            var start = ParseTime(dto.StartTime);
            var end = ParseTime(dto.EndTime);
            if (end <= start)
                return BadRequest(new { error = "InvalidTime", message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            // 1) Trùng lịch của lớp (giống hệt) — bỏ qua chính nó
            var dup = await FindDuplicateScheduleInClassAsync(
                dto.ClassID, id, (DayOfWeek)dto.DayOfWeek, start, end, ct);
            if (dup != null)
            {
                var cName = (string?)dup.GetType().GetProperty("className")?.GetValue(dup) ?? $"#{dto.ClassID}";
                var dayName = (string?)dup.GetType().GetProperty("dayName")?.GetValue(dup) ?? ViDow(dto.DayOfWeek);
                var st = (string?)dup.GetType().GetProperty("start")?.GetValue(dup) ?? Tfmt(start);
                var en = (string?)dup.GetType().GetProperty("end")?.GetValue(dup) ?? Tfmt(end);

                return Conflict(new
                {
                    error = "DuplicateSchedule",
                    message = $"Lớp {cName} đã có lịch {dayName} {st}-{en}.",
                    duplicate = dup
                });
            }

            // 2) Trùng lịch giáo viên — bỏ qua chính schedule này khi so khớp
            if (dto.TeacherId.HasValue)
            {
                var detail = await FindTeacherOverlapDetailAsync(
                    dto.TeacherId.Value, id, (DayOfWeek)dto.DayOfWeek, start, end, ct);
                if (detail != null)
                {
                    var tName = (string?)detail.GetType().GetProperty("teacherName")?.GetValue(detail) ?? "Giáo viên";
                    var cName = (string?)detail.GetType().GetProperty("className")?.GetValue(detail) ?? $"#{dto.ClassID}";
                    var dayName = (string?)detail.GetType().GetProperty("dayName")?.GetValue(detail) ?? ViDow(dto.DayOfWeek);
                    var st = (string?)detail.GetType().GetProperty("start")?.GetValue(detail) ?? Tfmt(start);
                    var en = (string?)detail.GetType().GetProperty("end")?.GetValue(detail) ?? Tfmt(end);

                    return Conflict(new
                    {
                        error = "TeacherOverlap",
                        message = $"{tName} trùng lịch ở lớp {cName} — {dayName} {st}-{en}.",
                        conflicts = new[] { detail }
                    });
                }
            }

            s.ClassID = dto.ClassID;
            s.DayOfWeek = (DayOfWeek)dto.DayOfWeek;
            s.StartTime = start;
            s.EndTime = end;
            s.IsActive = dto.IsActive;
            s.Note = dto.Note;
            s.TeacherId = dto.TeacherId;

            await _db.SaveChangesAsync(ct);
            var withTeacher = await _db.ClassSchedules.Include(x => x.Teacher).FirstAsync(x => x.ScheduleId == s.ScheduleId, ct);
            return Ok(ToDto(withTeacher));
        }

        // PATCH: api/ClassSchedules/{id}/toggle
        [HttpPatch("{id:int}/toggle")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Toggle(int id, CancellationToken ct)
        {
            var s = await _db.ClassSchedules.FirstOrDefaultAsync(x => x.ScheduleId == id, ct);
            if (s == null) return NotFound();
            s.IsActive = !s.IsActive;
            await _db.SaveChangesAsync(ct);
            return Ok(new { id = s.ScheduleId, isActive = s.IsActive });
        }

        // DELETE: api/ClassSchedules/{id}
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var s = await _db.ClassSchedules.FirstOrDefaultAsync(x => x.ScheduleId == id, ct);
            if (s == null) return NotFound();
            _db.ClassSchedules.Remove(s);
            await _db.SaveChangesAsync(ct);
            return Ok(new { id });
        }
        [HttpGet] // GET: api/ClassSessions?from=yyyy-MM-dd&to=yyyy-MM-dd&classId=9&teacherId=...&status=...&forCalendar=true
        public async Task<IActionResult> Query(
       [FromQuery] string? from,
       [FromQuery] string? to,
       [FromQuery] int? classId,
       [FromQuery] int? teacherId,
       [FromQuery] int? status,
       [FromQuery] bool forCalendar = false,
       CancellationToken ct = default)
        {
            // parse yyyy-MM-dd -> DateOnly (chấp nhận cả định dạng mặc định)
            static bool TryParseDateOnly(string? s, out DateOnly d)
            {
                if (!string.IsNullOrWhiteSpace(s))
                {
                    if (DateOnly.TryParseExact(s!, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d))
                        return true;
                    if (DateOnly.TryParse(s!, out d)) return true;
                    // fallback qua DateTime
                    if (DateTime.TryParse(s!, out var dt))
                    {
                        d = new DateOnly(dt.Year, dt.Month, dt.Day);
                        return true;
                    }
                }
                d = default;
                return false;
            }

            var q = _db.ClassSessions.AsNoTracking().AsQueryable();

            if (TryParseDateOnly(from, out var fromD))
                q = q.Where(x => x.SessionDate >= fromD);
            if (TryParseDateOnly(to, out var toD))
                q = q.Where(x => x.SessionDate <= toD);

            if (classId.HasValue)
                q = q.Where(x => x.ClassID == classId.Value);
            if (teacherId.HasValue)
                q = q.Where(x => x.TeacherId == teacherId.Value);
            if (status.HasValue)
            {
                var st = status.Value;
                q = q.Where(x => (int)x.Status == st);
            }

            q = q.OrderBy(x => x.SessionDate).ThenBy(x => x.StartTime);

            if (forCalendar)
            {
                // Trả về gọn cho Calendar
                var items = await q
                    .Select(s => new
                    {
                        sessionDate = s.SessionDate.ToString("yyyy-MM-dd"),
                        startTime = s.StartTime.ToString(@"hh\:mm"),
                        endTime = s.EndTime.ToString(@"hh\:mm"),
                        status = (int)s.Status,
                        classId = s.ClassID,
                        className = _db.Classes.Where(c => c.ClassID == s.ClassID).Select(c => c.ClassName).FirstOrDefault(),
                        teacherName = _db.Teachers.Where(t => t.TeacherId == s.TeacherId).Select(t => t.TeacherName).FirstOrDefault()
                    })
                    .ToListAsync(ct);

                return Ok(items);
            }
            else
            {
                var items = await q
                    .Include(s => s.Class)
                    .Include(s => s.Teacher)
                    .Select(s => new
                    {
                        sessionId = s.SessionId,
                        classId = s.ClassID,
                        className = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}",
                        sessionDate = s.SessionDate.ToString("yyyy-MM-dd"),
                        startTime = s.StartTime.ToString(@"hh\:mm"),
                        endTime = s.EndTime.ToString(@"hh\:mm"),
                        status = (int)s.Status,
                        isAutoGenerated = s.IsAutoGenerated,
                        teacherId = s.TeacherId,
                        teacherName = s.Teacher != null ? s.Teacher.TeacherName : null,
                        note = s.Note
                    })
                    .ToListAsync(ct);

                return Ok(items);
            }
        }

    }
}
