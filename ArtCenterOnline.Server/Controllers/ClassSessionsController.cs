// Controllers/ClassSessionsController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // yêu cầu đăng nhập cho tất cả action
    public class ClassSessionsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITeacherScheduleValidator _teacherValidator;
        private readonly IStudentScheduleValidator _studentValidator;
        private readonly ClassSessionMonthlySyncService _syncService;

        public ClassSessionsController(
            AppDbContext db,
            ITeacherScheduleValidator teacherValidator,
            IStudentScheduleValidator studentValidator,
            ClassSessionMonthlySyncService syncService)
        {
            _db = db;
            _teacherValidator = teacherValidator;
            _studentValidator = studentValidator;
            _syncService = syncService;
        }

        // ================== DTOs ==================
        public class UpdateSessionDto
        {
            public string? SessionDate { get; set; }   // yyyy-MM-dd
            public string? StartTime { get; set; }     // HH:mm hoặc HH:mm:ss
            public string? EndTime { get; set; }       // HH:mm hoặc HH:mm:ss
            public int? TeacherId { get; set; }
            public string? Note { get; set; }
            public int? Status { get; set; }
        }

        public class PreflightTeacherSessionDto
        {
            public int SessionId { get; set; }
            public string SessionDate { get; set; } = "";   // yyyy-MM-dd
            public string StartTime { get; set; } = "";
            public string EndTime { get; set; } = "";
            public int TeacherId { get; set; }
        }

        // ================== Helpers ==================
        private static bool TryParseDateOnly(string? s, out DateOnly d)
        {
            if (!string.IsNullOrWhiteSpace(s))
            {
                if (DateOnly.TryParseExact(s!, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d))
                    return true;
                if (DateOnly.TryParse(s!, out d)) return true;
                if (DateTime.TryParse(s!, out var dt)) { d = DateOnly.FromDateTime(dt); return true; }
            }
            d = default; return false;
        }

        private static bool TryParseTime(string? s, out TimeSpan t)
        {
            if (!string.IsNullOrWhiteSpace(s))
            {
                // chấp nhận HH:mm hoặc HH:mm:ss
                if (TimeSpan.TryParseExact(s, new[] { "hh\\:mm", "hh\\:mm\\:ss" }, CultureInfo.InvariantCulture, out t))
                    return true;
                if (TimeSpan.TryParse(s, out t)) return true;
            }
            t = default; return false;
        }

        private static string HHMM(TimeSpan t) => t.ToString(@"hh\:mm");
        private static string DMY(DateOnly d) => d.ToString("dd/MM/yyyy");

        private async Task<string> GetClassNameAsync(int classId, CancellationToken ct)
        {
            var name = await _db.Classes
                .AsNoTracking()
                .Where(c => c.ClassID == classId)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync(ct);
            return name ?? $"#{classId}";
        }

        private async Task<string> GetTeacherNameAsync(int teacherId, CancellationToken ct)
        {
            var name = await _db.Teachers
                .AsNoTracking()
                .Where(t => t.TeacherId == teacherId)
                .Select(t => t.TeacherName)
                .FirstOrDefaultAsync(ct);
            return name ?? $"GV #{teacherId}";
        }

        /// <summary>
        /// Tìm 1 buổi khác của GV trùng giờ trong cùng ngày, trả chi tiết để hiển thị.
        /// </summary>
        private async Task<object?> FindTeacherOverlapSessionAsync(
            int teacherId, DateOnly date, TimeSpan start, TimeSpan end, int? ignoreSessionId, CancellationToken ct)
        {
            var q = _db.ClassSessions
                .Include(s => s.Class)
                .Include(s => s.Teacher)
                .Where(s =>
                    s.TeacherId == teacherId &&
                    s.SessionDate == date &&
                    s.StartTime < end && s.EndTime > start);

            if (ignoreSessionId.HasValue)
                q = q.Where(s => s.SessionId != ignoreSessionId.Value);

            var row = await q
                .OrderBy(s => s.StartTime)
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    ClassName = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime,
                    TeacherId = s.TeacherId,
                    TeacherName = s.Teacher != null ? s.Teacher.TeacherName : null
                })
                .FirstOrDefaultAsync(ct);

            if (row == null) return null;

            return new
            {
                type = "teacher",
                sessionId = row.SessionId,
                classId = row.ClassID,
                className = row.ClassName,
                date = DMY(row.SessionDate),
                start = HHMM(row.StartTime),
                end = HHMM(row.EndTime),
                teacherId = row.TeacherId,
                teacherName = row.TeacherName ?? $"GV #{row.TeacherId}"
            };
        }

        /// <summary>
        /// Tìm trùng buổi trong cùng lớp: cùng ngày + cùng khung giờ.
        /// </summary>
        private async Task<object?> FindDuplicateSessionInClassAsync(
            int classId, DateOnly date, TimeSpan start, TimeSpan end, int? ignoreSessionId, CancellationToken ct)
        {
            var dup = await _db.ClassSessions
                .Include(s => s.Class)
                .Where(s =>
                    s.ClassID == classId &&
                    s.SessionDate == date &&
                    s.StartTime == start &&
                    s.EndTime == end &&
                    (!ignoreSessionId.HasValue || s.SessionId != ignoreSessionId.Value))
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    ClassName = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime
                })
                .FirstOrDefaultAsync(ct);

            if (dup == null) return null;

            return new
            {
                type = "duplicate",
                sessionId = dup.SessionId,
                classId = dup.ClassID,
                className = dup.ClassName,
                date = DMY(dup.SessionDate),
                start = HHMM(dup.StartTime),
                end = HHMM(dup.EndTime)
            };
        }

        // ================== LIST (Calendar & Full) ==================
        // GET: /api/ClassSessions?from=yyyy-MM-dd&to=yyyy-MM-dd&classId=..&teacherId=..&status=..&forCalendar=true
        [HttpGet]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Query(
            [FromQuery] string? from,
            [FromQuery] string? to,
            [FromQuery] int? classId,
            [FromQuery] int? teacherId,
            [FromQuery] int? status,
            [FromQuery] bool forCalendar = false,
            CancellationToken ct = default)
        {
            var q = _db.ClassSessions.AsNoTracking().AsQueryable();

            if (TryParseDateOnly(from, out var fromD)) q = q.Where(x => x.SessionDate >= fromD);
            if (TryParseDateOnly(to, out var toD)) q = q.Where(x => x.SessionDate <= toD);
            if (classId.HasValue) q = q.Where(x => x.ClassID == classId.Value);
            if (teacherId.HasValue) q = q.Where(x => x.TeacherId == teacherId.Value);
            if (status.HasValue) q = q.Where(x => (int)x.Status == status.Value);

            q = q.OrderBy(x => x.SessionDate).ThenBy(x => x.StartTime);

            if (forCalendar)
            {
                var items = await q
                    .Include(s => s.Class)
                    .Include(s => s.Teacher)
                    .Select(s => new
                    {
                        sessionDate = s.SessionDate.ToString("yyyy-MM-dd"),
                        startTime = s.StartTime.ToString(@"hh\:mm"),
                        endTime = s.EndTime.ToString(@"hh\:mm"),
                        status = (int)s.Status,
                        classId = s.ClassID,
                        className = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}",
                        teacherName = s.Teacher != null ? s.Teacher.TeacherName : null
                    })
                    .ToListAsync(ct);

                return Ok(items);
            }

            var full = await q
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

            return Ok(full);
        }

        // ================== DETAIL ==================
        // GET: /api/ClassSessions/{sessionId}
        [HttpGet("{sessionId:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> GetOne([FromRoute] int sessionId, CancellationToken ct)
        {
            var s = await _db.ClassSessions
                .AsNoTracking()
                .Include(x => x.Class)
                .Include(x => x.Teacher)
                .FirstOrDefaultAsync(x => x.SessionId == sessionId, ct);
            if (s == null) return NotFound();

            var startLocal = new DateTime(s.SessionDate.Year, s.SessionDate.Month, s.SessionDate.Day,
                                          s.StartTime.Hours, s.StartTime.Minutes, 0, DateTimeKind.Local);
            var canEdit = DateTime.Now < startLocal;

            return Ok(new
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
                note = s.Note,
                canEdit
            });
        }

        // ================== PREFLIGHT: Cảnh báo trùng HS theo BUỔI ==================
        // POST: /api/ClassSessions/{sessionId}/check-student-overlap
        [HttpPost("{sessionId:int}/check-student-overlap")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> CheckStudentOverlapForSession(
            [FromRoute] int sessionId,
            [FromBody] UpdateSessionDto? dto,
            CancellationToken ct)
        {
            var s = await _db.ClassSessions
                .Include(x => x.Class)
                .FirstOrDefaultAsync(x => x.SessionId == sessionId, ct);
            if (s == null) return NotFound(new { message = "Buổi học không tồn tại." });

            var newDate = TryParseDateOnly(dto?.SessionDate, out var d) ? d : s.SessionDate;
            var newStart = TryParseTime(dto?.StartTime, out var st) ? st : s.StartTime;
            var newEnd = TryParseTime(dto?.EndTime, out var et) ? et : s.EndTime;
            if (newEnd <= newStart) return BadRequest(new { message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            var warnings = await _studentValidator.CheckForSessionAsync(
                s.ClassID, newDate, newStart, newEnd, sessionId, ct);

            return Ok(warnings); // [] nếu không có cảnh báo
        }

        // ================== PREFLIGHT: Giáo viên (trả CHI TIẾT nếu trùng) ==================
        // POST: /api/ClassSessions/{id}/preflight-teacher
        [HttpPost("{id:int}/preflight-teacher")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> PreflightTeacher(int id, [FromBody] PreflightTeacherSessionDto dto, CancellationToken ct)
        {
            if (id != dto.SessionId) return BadRequest(new { error = "Invalid", message = "SessionId không khớp." });
            if (!TryParseDateOnly(dto.SessionDate, out var date) ||
                !TryParseTime(dto.StartTime, out var start) ||
                !TryParseTime(dto.EndTime, out var end))
                return BadRequest(new { error = "InvalidTime", message = "Tham số thời gian không hợp lệ." });
            if (end <= start) return BadRequest(new { error = "InvalidTime", message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            var detail = await FindTeacherOverlapSessionAsync(dto.TeacherId, date, start, end, id, ct);
            if (detail != null)
            {
                var tName = await GetTeacherNameAsync(dto.TeacherId, ct);
                var cName = (string?)detail.GetType().GetProperty("className")?.GetValue(detail) ?? "";
                var dmy = (string?)detail.GetType().GetProperty("date")?.GetValue(detail) ?? DMY(date);
                var st = (string?)detail.GetType().GetProperty("start")?.GetValue(detail) ?? HHMM(start);
                var en = (string?)detail.GetType().GetProperty("end")?.GetValue(detail) ?? HHMM(end);

                return Conflict(new
                {
                    error = "TeacherOverlap",
                    message = $"{tName} trùng lịch ở lớp {cName} — {dmy} {st}-{en}.",
                    conflicts = new[] { detail }
                });
            }

            return Ok(new { conflict = false });
        }

        // ================== UPDATE/PATCH 1 BUỔI ==================
        // PUT: /api/ClassSessions/{id}
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> UpdateOne(int id, [FromBody] UpdateSessionDto dto, CancellationToken ct)
        {
            var s = await _db.ClassSessions.Include(x => x.Class).FirstOrDefaultAsync(x => x.SessionId == id, ct);
            if (s == null) return NotFound(new { message = "Buổi học không tồn tại." });

            // Không cho sửa nếu đã/đang diễn ra (theo giờ cũ)
            var originalStartLocal = new DateTime(s.SessionDate.Year, s.SessionDate.Month, s.SessionDate.Day,
                                                  s.StartTime.Hours, s.StartTime.Minutes, 0, DateTimeKind.Local);
            if (DateTime.Now >= originalStartLocal)
                return Conflict(new { message = $"Buổi {DMY(s.SessionDate)} {HHMM(s.StartTime)} đã/đang diễn ra, không thể chỉnh sửa." });

            // Lấy giá trị mới
            var newDate = TryParseDateOnly(dto.SessionDate, out var d) ? d : s.SessionDate;
            var newStart = TryParseTime(dto.StartTime, out var st) ? st : s.StartTime;
            var newEnd = TryParseTime(dto.EndTime, out var et) ? et : s.EndTime;
            if (newEnd <= newStart) return BadRequest(new { message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            // 1) Trùng buổi trong CÙNG LỚP (cùng ngày + cùng khung giờ)
            var dup = await FindDuplicateSessionInClassAsync(s.ClassID, newDate, newStart, newEnd, id, ct);
            if (dup != null)
            {
                var cName = (string?)dup.GetType().GetProperty("className")?.GetValue(dup) ?? await GetClassNameAsync(s.ClassID, ct);
                var dmy = (string?)dup.GetType().GetProperty("date")?.GetValue(dup) ?? DMY(newDate);
                var stv = (string?)dup.GetType().GetProperty("start")?.GetValue(dup) ?? HHMM(newStart);
                var env = (string?)dup.GetType().GetProperty("end")?.GetValue(dup) ?? HHMM(newEnd);

                return Conflict(new
                {
                    error = "DuplicateSession",
                    message = $"Lớp {cName} đã có buổi {dmy} {stv}-{env}.",
                    duplicate = dup
                });
            }

            // 2) Giáo viên có bận buổi khác cùng ngày & chồng giờ?
            int? teacherToUse = dto.TeacherId.HasValue ? dto.TeacherId : s.TeacherId;
            if (teacherToUse.HasValue)
            {
                var detail = await FindTeacherOverlapSessionAsync(teacherToUse.Value, newDate, newStart, newEnd, id, ct);
                if (detail != null)
                {
                    var tName = await GetTeacherNameAsync(teacherToUse.Value, ct);
                    var cName = (string?)detail.GetType().GetProperty("className")?.GetValue(detail) ?? "";
                    var dmy = (string?)detail.GetType().GetProperty("date")?.GetValue(detail) ?? DMY(newDate);
                    var stv = (string?)detail.GetType().GetProperty("start")?.GetValue(detail) ?? HHMM(newStart);
                    var env = (string?)detail.GetType().GetProperty("end")?.GetValue(detail) ?? HHMM(newEnd);

                    return Conflict(new
                    {
                        error = "TeacherOverlap",
                        message = $"{tName} trùng lịch ở lớp {cName} — {dmy} {stv}-{env}.",
                        conflicts = new[] { detail }
                    });
                }
            }

            // Áp dụng cập nhật
            s.SessionDate = newDate;
            s.StartTime = newStart;
            s.EndTime = newEnd;
            s.TeacherId = dto.TeacherId; // có thể null
            if (dto.Note != null) s.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (dto.Status.HasValue)
            {
                if (!Enum.IsDefined(typeof(SessionStatus), dto.Status.Value))
                    return BadRequest(new { message = "Status không hợp lệ." });
                s.Status = (SessionStatus)dto.Status.Value;
            }
            s.IsAutoGenerated = false; // mọi chỉnh sửa trở thành thủ công

            await _db.SaveChangesAsync(ct);

            return Ok(new
            {
                sessionId = s.SessionId,
                classId = s.ClassID,
                sessionDate = s.SessionDate.ToString("yyyy-MM-dd"),
                startTime = s.StartTime.ToString(@"hh\:mm"),
                endTime = s.EndTime.ToString(@"hh\:mm"),
                status = (int)s.Status,
                isAutoGenerated = s.IsAutoGenerated,
                teacherId = s.TeacherId,
                note = s.Note
            });
        }

        // ================== SYNC THÁNG ==================
        // POST: /api/ClassSessions/sync-month/{classId}?year=YYYY&month=MM
        [HttpPost("sync-month/{classId:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> SyncMonth(int classId, [FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
        {
            var r = await _syncService.SyncMonthAsync(classId, year, month, ct);
            return Ok(new { created = r.Created, updated = r.Updated, deleted = r.Deleted, skippedTeacherConflicts = r.SkippedTeacherConflicts });
        }
    }
}
