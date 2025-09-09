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
    [Authorize]
    public class ClassSessionsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly ITeacherScheduleValidator _teacherValidator;   // giữ DI như dự án
        private readonly IStudentScheduleValidator _studentValidator;   // giữ DI như dự án
        private readonly ClassSessionMonthlySyncService _syncService;   // giữ DI như dự án
        private readonly ISessionAccountingService _accounting;         // NEW: hạch toán

        public ClassSessionsController(
            AppDbContext db,
            ITeacherScheduleValidator teacherValidator,
            IStudentScheduleValidator studentValidator,
            ClassSessionMonthlySyncService syncService,
            ISessionAccountingService accounting)    // NEW
        {
            _db = db;
            _teacherValidator = teacherValidator;
            _studentValidator = studentValidator;
            _syncService = syncService;
            _accounting = accounting;                // NEW
        }

        // ================== DTOs ==================
        public sealed class UpdateSessionDto
        {
            public string? SessionDate { get; set; }    // "yyyy-MM-dd"
            public string? StartTime { get; set; }      // "HH:mm"
            public string? EndTime { get; set; }        // "HH:mm"
            public int? TeacherId { get; set; }         // null = chưa gán
            public int? Status { get; set; }            // SessionStatus
            public string? Note { get; set; }
            public bool? OverrideStudentConflicts { get; set; } // cho phép lưu dù có cảnh báo HS
        }

        // Chi tiết duplicate trong cùng lớp
        public sealed class DuplicateSessionInfo
        {
            public int SessionId { get; init; }
            public int ClassId { get; init; }
            public string ClassName { get; init; } = "";
            public string Date { get; init; } = "";   // d/M/y (DMY)
            public string Start { get; init; } = "";
            public string End { get; init; } = "";
        }

        // Chi tiết trùng GV
        public sealed class TeacherOverlapInfo
        {
            public int SessionId { get; init; }
            public int ClassId { get; init; }
            public string ClassName { get; init; } = "";
            public string Date { get; init; } = "";
            public string Start { get; init; } = "";
            public string End { get; init; } = "";
            public int TeacherId { get; init; }
            public string TeacherName { get; init; } = "";
        }

        // Cảnh báo trùng HS
        public sealed class ConflictSlot
        {
            public int ClassId { get; init; }
            public string ClassName { get; init; } = "";
            public string Date { get; init; } = "";
            public string Start { get; init; } = "";
            public string End { get; init; } = "";
        }
        public sealed class StudentConflictInfo
        {
            public int StudentId { get; init; }
            public string StudentName { get; init; } = "";
            public ConflictSlot Conflict { get; init; } = new ConflictSlot();
        }

        // ================== Helpers ==================
        private static bool TryParseDateOnly(string? iso, out DateOnly value)
        {
            if (!string.IsNullOrWhiteSpace(iso) &&
                DateOnly.TryParseExact(iso.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
                return true;
            value = default;
            return false;
        }

        private static bool TryParseTime(string? hhmm, out TimeSpan value)
        {
            if (!string.IsNullOrWhiteSpace(hhmm) &&
                TimeSpan.TryParseExact(hhmm.Trim(), @"hh\:mm", CultureInfo.InvariantCulture, out value))
                return true;
            value = default;
            return false;
        }

        private static string DMY(DateOnly d) => $"{d.Day:D2}/{d.Month:D2}/{d.Year:D4}";
        private static string HHMM(TimeSpan t) => $"{(int)t.TotalHours:D2}:{t.Minutes:D2}";

        private static bool Overlap(TimeSpan aStart, TimeSpan aEnd, TimeSpan bStart, TimeSpan bEnd)
        {
            // [aStart, aEnd) overlaps [bStart, bEnd)
            return aStart < bEnd && bStart < aEnd;
        }

        // ================== LIST ==================
        // GET: /api/ClassSessions?from=yyyy-MM-dd&to=yyyy-MM-dd&classId=&teacherId=&status=
        [HttpGet]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> List([FromQuery] string? from, [FromQuery] string? to,
                                              [FromQuery] int? classId, [FromQuery] int? teacherId,
                                              [FromQuery] int? status, CancellationToken ct)
        {
            var q = _db.ClassSessions
                .AsNoTracking()
                .Include(s => s.Class)
                .Include(s => s.Teacher)
                .AsQueryable();

            if (TryParseDateOnly(from, out var fromDo))
                q = q.Where(s => s.SessionDate >= fromDo);
            if (TryParseDateOnly(to, out var toDo))
                q = q.Where(s => s.SessionDate <= toDo);

            if (classId.HasValue)
                q = q.Where(s => s.ClassID == classId.Value);

            if (teacherId.HasValue)
                q = q.Where(s => s.TeacherId == teacherId.Value);

            if (status.HasValue && Enum.IsDefined(typeof(SessionStatus), status.Value))
            {
                var st = (SessionStatus)status.Value;
                q = q.Where(s => s.Status == st);
            }

            var rows = await q
                .OrderBy(s => s.SessionDate)
                .ThenBy(s => s.StartTime)
                .Select(s => new
                {
                    sessionId = s.SessionId,
                    classId = s.ClassID,
                    className = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
                    teacherId = s.TeacherId,
                    teacherName = s.Teacher != null ? s.Teacher.TeacherName : null,
                    sessionDate = s.SessionDate.ToString("yyyy-MM-dd"),
                    startTime = s.StartTime.ToString(@"hh\:mm"),
                    endTime = s.EndTime.ToString(@"hh\:mm"),
                    status = (int)s.Status,
                    isAutoGenerated = s.IsAutoGenerated,
                    note = s.Note
                })
                .ToListAsync(ct);

            return Ok(rows);
        }

        // ================== GET ONE ==================
        // GET: /api/ClassSessions/{id}
        [HttpGet("{sessionId:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> GetOne([FromRoute] int sessionId, CancellationToken ct)
        {
            var s = await _db.ClassSessions
                .AsNoTracking()
                .Include(x => x.Class)
                .Include(x => x.Teacher)
                .FirstOrDefaultAsync(x => x.SessionId == sessionId, ct);

            if (s == null) return NotFound(new { message = "Buổi học không tồn tại." });

            // canEdit theo vai trò
            var now = DateTime.Now;
            var today = DateOnly.FromDateTime(now);
            var endOfMonth = DateOnly.FromDateTime(new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month)));

            bool canEdit;
            if (User.IsInRole("Admin"))
            {
                // Admin: cho sửa nếu ngày buổi trong [hôm nay .. hết tháng]
                canEdit = s.SessionDate >= today && s.SessionDate <= endOfMonth;
            }
            else
            {
                // Giáo viên: chỉ trước giờ bắt đầu (theo giờ local)
                var startLocal = new DateTime(s.SessionDate.Year, s.SessionDate.Month, s.SessionDate.Day,
                                              s.StartTime.Hours, s.StartTime.Minutes, 0, DateTimeKind.Local);
                canEdit = DateTime.Now < startLocal;
            }

            return Ok(new
            {
                sessionId = s.SessionId,
                classId = s.ClassID,
                className = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
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

        // ================== UPDATE ==================
        // PUT: /api/ClassSessions/{id}
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> UpdateOne([FromRoute] int id, [FromBody] UpdateSessionDto dto, CancellationToken ct)
        {
            var s = await _db.ClassSessions
                .Include(x => x.Class)
                .FirstOrDefaultAsync(x => x.SessionId == id, ct);

            if (s == null) return NotFound(new { message = "Buổi học không tồn tại." });

            // Parse new values (fallback về giá trị cũ nếu null)
            var newDate = TryParseDateOnly(dto.SessionDate, out var d) ? d : s.SessionDate;
            var newStart = TryParseTime(dto.StartTime, out var st) ? st : s.StartTime;
            var newEnd = TryParseTime(dto.EndTime, out var et) ? et : s.EndTime;
            var newTeacherId = dto.TeacherId.HasValue ? dto.TeacherId : s.TeacherId;

            if (newEnd <= newStart)
                return BadRequest(new { message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            // Role-based edit window
            var now = DateTime.Now;
            var today = DateOnly.FromDateTime(now);
            var endOfMonth = DateOnly.FromDateTime(new DateTime(now.Year, now.Month, DateTime.DaysInMonth(now.Year, now.Month)));

            if (User.IsInRole("Admin"))
            {
                // Admin: chỉ cho sửa ngày trong [hôm nay .. hết tháng]
                if (newDate < today || newDate > endOfMonth)
                    return Conflict(new { message = "Admin chỉ được sửa buổi từ hôm nay đến hết tháng hiện tại." });
            }
            else
            {
                // Giáo viên: không cho sửa nếu đã/đang diễn ra (theo giờ cũ)
                var originalStartLocal = new DateTime(s.SessionDate.Year, s.SessionDate.Month, s.SessionDate.Day,
                                                      s.StartTime.Hours, s.StartTime.Minutes, 0, DateTimeKind.Local);
                if (DateTime.Now >= originalStartLocal)
                    return Conflict(new { message = $"Buổi {DMY(s.SessionDate)} {HHMM(s.StartTime)} đã/đang diễn ra, không thể chỉnh sửa." });

                // Giáo viên KHÔNG được đổi giáo viên dạy buổi
                if (newTeacherId != s.TeacherId)
                    return StatusCode(403, new { message = "Bạn không có quyền đổi giáo viên của buổi học này (chỉ Admin)." });
            }

            // 1) Trùng buổi trong CÙNG LỚP (block)
            var dupInClass = await FindDuplicateSessionInClassAsync(s.ClassID, newDate, newStart, newEnd, excludeSessionId: id, ct);
            if (dupInClass != null)
            {
                return Conflict(new
                {
                    error = "DuplicateSession",
                    message = $"Lớp {dupInClass.ClassName} đã có buổi {dupInClass.Date} {dupInClass.Start}-{dupInClass.End}.",
                    duplicate = dupInClass
                });
            }

            // 2) Trùng lịch GIÁO VIÊN (block)
            if (newTeacherId.HasValue)
            {
                var overlap = await FindTeacherOverlapSessionAsync(newTeacherId.Value, newDate, newStart, newEnd, excludeSessionId: id, ct);
                if (overlap != null)
                {
                    return Conflict(new
                    {
                        error = "TeacherOverlap",
                        message = $"{overlap.TeacherName} trùng lịch ở lớp {overlap.ClassName} — {overlap.Date} {overlap.Start}-{overlap.End}.",
                        conflicts = new[] { overlap }
                    });
                }
            }

            // 3) Cảnh báo trùng lịch HỌC SINH (only warn; allow override)
            var studentWarn = await FindStudentOverlapsAsync(s.ClassID, newDate, newStart, newEnd, excludeSessionId: id, ct);
            if (studentWarn.Count > 0 && dto.OverrideStudentConflicts != true)
            {
                return Conflict(new
                {
                    error = "StudentOverlapWarning",
                    message = "Có học sinh trùng khung giờ với lớp khác. Bấm tiếp tục để vẫn lưu.",
                    conflicts = studentWarn
                });
            }

            // Ghi nhớ GV cũ để quyết định re-accounting
            var oldTeacherId = s.TeacherId;

            // Apply update
            s.SessionDate = newDate;
            s.StartTime = newStart;
            s.EndTime = newEnd;
            s.TeacherId = newTeacherId;
            if (dto.Note != null) s.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            if (dto.Status.HasValue)
            {
                if (!Enum.IsDefined(typeof(SessionStatus), dto.Status.Value))
                    return BadRequest(new { message = "Status không hợp lệ." });
                s.Status = (SessionStatus)dto.Status.Value;
            }
            s.IsAutoGenerated = false;

            await _db.SaveChangesAsync(ct);

            // NEW: Nếu đổi giáo viên và buổi sau cập nhật đang ở trạng thái Completed -> hạch toán lại PHẦN GIÁO VIÊN
            var teacherChanged = oldTeacherId != s.TeacherId;
            if (teacherChanged && s.Status == SessionStatus.Completed)
            {
                // teacherOnly = true => chỉ đồng bộ thống kê giáo viên theo THÁNG; không cộng số buổi học của học sinh
                await _accounting.ApplyAsync(s.SessionId, teacherOnly: true);
            }

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
                note = s.Note,
                reAccounted = teacherChanged && s.Status == SessionStatus.Completed // tiện để FE biết có chạy lại
            });
        }

        // ================== CHECK STUDENT OVERLAP (compat FE) ==================
        public sealed class CheckStudentOverlapDto
        {
            public int? Id { get; set; }              // sessionId
            public string? SessionDate { get; set; }  // yyyy-MM-dd (tùy chọn nếu muốn preflight cho giá trị mới)
            public string? StartTime { get; set; }    // HH:mm
            public string? EndTime { get; set; }      // HH:mm
            public int? TeacherId { get; set; }       // không dùng ở đây nhưng giữ tương thích payload cũ
        }

        // 1) POST body: { id, sessionDate?, startTime?, endTime? }
        [HttpPost("check-student-overlap")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> CheckStudentOverlapPost([FromBody] CheckStudentOverlapDto body, CancellationToken ct)
        {
            if (body == null || !body.Id.HasValue)
                return BadRequest(new { error = "BadRequest", message = "Thiếu id buổi học." });

            return await CheckStudentOverlapCore(body.Id.Value, body.SessionDate, body.StartTime, body.EndTime, ct);
        }

        // 2) GET /api/ClassSessions/check-student-overlap?id=87&sessionDate=...&startTime=...&endTime=...
        [HttpGet("check-student-overlap")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> CheckStudentOverlapGet([FromQuery] int? id,
            [FromQuery] string? sessionDate, [FromQuery] string? startTime, [FromQuery] string? endTime, CancellationToken ct)
        {
            if (!id.HasValue)
                return BadRequest(new { error = "BadRequest", message = "Thiếu id buổi học." });

            return await CheckStudentOverlapCore(id.Value, sessionDate, startTime, endTime, ct);
        }

        // 3) GET /api/ClassSessions/{id}/check-student-overlap  (thêm route phụ cho một số FE cũ)
        [HttpGet("{id:int}/check-student-overlap")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> CheckStudentOverlapRoute([FromRoute] int id, CancellationToken ct)
            => await CheckStudentOverlapCore(id, null, null, null, ct);

        // Core logic dùng lại validator đã viết
        private async Task<IActionResult> CheckStudentOverlapCore(int id, string? dateIso, string? startHHmm, string? endHHmm, CancellationToken ct)
        {
            var s = await _db.ClassSessions.FirstOrDefaultAsync(x => x.SessionId == id, ct);
            if (s == null)
                return NotFound(new { error = "NotFound", message = "Buổi học không tồn tại hoặc đã bị xóa." });

            // Lấy giá trị muốn check: dùng payload nếu có, ngược lại lấy theo buổi hiện tại
            var date = TryParseDateOnly(dateIso, out var d) ? d : s.SessionDate;
            var start = TryParseTime(startHHmm, out var st) ? st : s.StartTime;
            var end = TryParseTime(endHHmm, out var et) ? et : s.EndTime;

            if (end <= start)
                return BadRequest(new { error = "BadTimeRange", message = "Giờ kết thúc phải lớn hơn giờ bắt đầu." });

            var warns = await FindStudentOverlapsAsync(s.ClassID, date, start, end, excludeSessionId: id, ct);
            return Ok(new
            {
                message = warns.Count == 0 ? "Không có xung đột học sinh." : "Có học sinh trùng khung giờ với lớp khác.",
                count = warns.Count,
                conflicts = warns
            });
        }

        // ================== SYNC THÁNG ==================
        // POST: /api/ClassSessions/sync-month/{classId}?year=YYYY&month=MM
        [HttpPost("sync-month/{classId:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> SyncMonth([FromRoute] int classId, [FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
        {
            var r = await _syncService.SyncMonthAsync(classId, year, month, ct);
            return Ok(new
            {
                created = r.Created,
                updated = r.Updated,
                deleted = r.Deleted,
                skippedTeacherConflicts = r.SkippedTeacherConflicts
            });
        }

        // ================== INTERNAL CHECKERS ==================
        /// <summary>
        /// Trả về duplicate trong cùng lớp nếu có, null nếu không.
        /// </summary>
        private async Task<DuplicateSessionInfo?> FindDuplicateSessionInClassAsync(int classId, DateOnly date, TimeSpan start, TimeSpan end, int? excludeSessionId, CancellationToken ct)
        {
            var sameDay = await _db.ClassSessions
                .AsNoTracking()
                .Where(s => s.ClassID == classId && s.SessionDate == date && (!excludeSessionId.HasValue || s.SessionId != excludeSessionId.Value))
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime
                })
                .ToListAsync(ct);

            var hit = sameDay.FirstOrDefault(x => Overlap(start, end, x.StartTime, x.EndTime));
            if (hit == null) return null;

            var className = await GetClassNameAsync(classId, ct);
            return new DuplicateSessionInfo
            {
                SessionId = hit.SessionId,
                ClassId = classId,
                ClassName = className,
                Date = DMY(hit.SessionDate),
                Start = HHMM(hit.StartTime),
                End = HHMM(hit.EndTime)
            };
        }

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
        /// Tìm 1 buổi khác của GV trùng khung giờ (cùng ngày). Null nếu không có.
        /// </summary>
        private async Task<TeacherOverlapInfo?> FindTeacherOverlapSessionAsync(int teacherId, DateOnly date, TimeSpan start, TimeSpan end, int? excludeSessionId, CancellationToken ct)
        {
            var sameDay = await _db.ClassSessions
                .AsNoTracking()
                .Include(s => s.Class)
                .Where(s => s.TeacherId == teacherId
                         && s.SessionDate == date
                         && (!excludeSessionId.HasValue || s.SessionId != excludeSessionId.Value))
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    ClassName = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime
                })
                .ToListAsync(ct); // ToList rồi mới Overlap để tránh EF translate method

            var hit = sameDay.FirstOrDefault(x => Overlap(start, end, x.StartTime, x.EndTime));
            if (hit == null) return null;

            return new TeacherOverlapInfo
            {
                SessionId = hit.SessionId,
                ClassId = hit.ClassID,
                ClassName = hit.ClassName,
                Date = DMY(hit.SessionDate),
                Start = HHMM(hit.StartTime),
                End = HHMM(hit.EndTime),
                TeacherId = teacherId,
                TeacherName = await GetTeacherNameAsync(teacherId, ct)
            };
        }

        /// <summary>
        /// Tìm các cảnh báo học sinh trùng giờ với lớp khác trong cùng ngày.
        /// Trả về list { studentId, studentName, conflict: { classId, className, date, start, end } }
        /// </summary>
        private async Task<List<StudentConflictInfo>> FindStudentOverlapsAsync(int classId, DateOnly date, TimeSpan start, TimeSpan end, int? excludeSessionId, CancellationToken ct)
        {
            var result = new List<StudentConflictInfo>();

            // Học sinh active của lớp này
            var students = await (from cs in _db.ClassStudents
                                  join st in _db.Students on cs.StudentId equals st.StudentId
                                  where cs.ClassID == classId && cs.IsActive
                                  select new { st.StudentId, st.StudentName })
                                  .ToListAsync(ct);
            if (students.Count == 0) return result;

            var studentIds = students.Select(s => s.StudentId).ToList();

            // Các lớp khác mà các HS này đang active
            var otherClassIds = await _db.ClassStudents
                .AsNoTracking()
                .Where(cs => studentIds.Contains(cs.StudentId) && cs.IsActive && cs.ClassID != classId)
                .Select(cs => cs.ClassID)
                .Distinct()
                .ToListAsync(ct);

            if (otherClassIds.Count == 0) return result;

            // Các buổi trong ngày của các lớp kia (trừ buổi hiện đang sửa)
            var otherSessionsSameDay = await _db.ClassSessions
                .AsNoTracking()
                .Include(s => s.Class)
                .Where(s => otherClassIds.Contains(s.ClassID)
                         && s.SessionDate == date
                         && (!excludeSessionId.HasValue || s.SessionId != excludeSessionId.Value))
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    ClassName = s.Class != null ? s.Class.ClassName : $"#{s.ClassID}",
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime
                })
                .ToListAsync(ct);

            if (otherSessionsSameDay.Count == 0) return result;

            // Map: studentId -> classes active (other classes)
            var mapStudentOtherClasses = await _db.ClassStudents
                .AsNoTracking()
                .Where(cs => studentIds.Contains(cs.StudentId) && cs.IsActive && cs.ClassID != classId)
                .GroupBy(cs => cs.StudentId)
                .Select(g => new { StudentId = g.Key, ClassIds = g.Select(x => x.ClassID).Distinct().ToList() })
                .ToListAsync(ct);

            var dictStudentOtherClassIds = mapStudentOtherClasses.ToDictionary(x => x.StudentId, x => x.ClassIds);

            foreach (var stu in students)
            {
                if (!dictStudentOtherClassIds.TryGetValue(stu.StudentId, out var clsIds)) continue;

                var hits = otherSessionsSameDay
                    .Where(os => clsIds.Contains(os.ClassID) && Overlap(start, end, os.StartTime, os.EndTime))
                    .ToList();

                foreach (var h in hits)
                {
                    result.Add(new StudentConflictInfo
                    {
                        StudentId = stu.StudentId,
                        StudentName = stu.StudentName,
                        Conflict = new ConflictSlot
                        {
                            ClassId = h.ClassID,
                            ClassName = h.ClassName,
                            Date = DMY(h.SessionDate),
                            Start = HHMM(h.StartTime),
                            End = HHMM(h.EndTime)
                        }
                    });
                }
            }

            return result;
        }
    }
}
