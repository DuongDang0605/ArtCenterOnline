using System.Security.Claims;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/classsessions")]
[Authorize]
public class ClassSessionAttendanceController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAttendanceGuard _guard;
    private readonly ISessionAccountingService _accounting;

    public ClassSessionAttendanceController(AppDbContext db, IAttendanceGuard guard, ISessionAccountingService accounting)
    {
        _db = db; _guard = guard; _accounting = accounting;
    }

    [HttpGet("{sessionId:int}/students")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetStudentsInSession([FromRoute] int sessionId)
    {
        var s = await _db.ClassSessions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (s == null) return NotFound(new { message = "Buổi học không tồn tại." });

        // Cho phép HIỂN THỊ roster cho Admin/Teacher.
        // Chỉ ràng buộc: Teacher phải đúng buổi của mình (không ràng buộc thời gian).
        if (User.IsInRole("Teacher"))
        {
            var userId = User.GetUserId();
            var myTeacherId = await _db.Teachers
                .Where(t => t.UserId == userId)
                .Select(t => t.TeacherId)
                .FirstOrDefaultAsync();

            if (myTeacherId == 0 || s.TeacherId != myTeacherId)
                return Forbid("Bạn không phụ trách buổi này.");
        }

        // Roster đang active tại lớp
        var roster = await (from cs in _db.ClassStudents
                            join st in _db.Students on cs.StudentId equals st.StudentId
                            where cs.ClassID == s.ClassID && cs.IsActive
                            orderby st.StudentName
                            select new { st.StudentId, st.StudentName })
                           .ToListAsync();

        // 🔧 Tránh 500: có thể tồn tại N bản ghi Attendance cùng StudentId
        // -> lấy bản ghi MỚI NHẤT theo TakenAtUtc
        var attList = await _db.Attendances.AsNoTracking()
            .Where(a => a.SessionId == sessionId)
            .OrderByDescending(a => a.TakenAtUtc)
            .Select(a => new { a.StudentId, a.IsPresent, a.Note, a.TakenAtUtc })
            .ToListAsync();

        var attMap = attList
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key,
                          g => new { IsPresent = g.First().IsPresent, Note = g.First().Note });

        var result = roster.Select(r => new
        {
            r.StudentId,
            r.StudentName,
            isPresent = attMap.TryGetValue(r.StudentId, out var x) ? x.IsPresent : (bool?)null,
            note = attMap.TryGetValue(r.StudentId, out var y) ? y.Note : null
        });

        return Ok(result);
    }


    public record AttendanceItemDto(int StudentId, bool IsPresent, string? Note);

    [HttpPost("{sessionId:int}/attendance")]
    [Authorize(Roles = "Admin,Teacher")]
    [Consumes("application/json")]
    public async Task<IActionResult> UpsertAttendance([FromRoute] int sessionId, [FromBody] List<AttendanceItemDto> items)
    {
        if (items == null || items.Count == 0)
            return BadRequest(new { message = "Không có dữ liệu điểm danh." });

        var s = await _db.ClassSessions.FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (s == null) return NotFound();

        var role = User.IsInRole("Admin") ? "Admin" : "Teacher";
        var (allowed, reason) = await _guard.CanTakeAsync(User, role, s, _db);
        if (!allowed) return Forbid(reason);

        foreach (var it in items)
        {
            bool active = await _db.ClassStudents.AnyAsync(cs => cs.ClassID == s.ClassID && cs.StudentId == it.StudentId && cs.IsActive);
            if (!active)
                return Conflict(new { message = $"Học sinh {it.StudentId} không hoạt động tại ngày buổi học." });
        }

        var nowUtc = DateTime.UtcNow;
        var userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var tmp) ? tmp : 0;

        foreach (var it in items)
        {
            var rec = await _db.Attendances.FirstOrDefaultAsync(a => a.SessionId == sessionId && a.StudentId == it.StudentId);
            if (rec == null)
            {
                _db.Attendances.Add(new Attendance
                {
                    SessionId = sessionId,
                    StudentId = it.StudentId,
                    IsPresent = it.IsPresent,
                    Note = it.Note,
                    TakenAtUtc = nowUtc,
                    TakenByUserId = userId
                });
            }
            else
            {
                rec.IsPresent = it.IsPresent;
                rec.Note = it.Note;
                rec.TakenAtUtc = nowUtc;
                rec.TakenByUserId = userId;
            }
        }

        await _db.SaveChangesAsync();

        // Hễ có attendance → Completed
        s.Status = SessionStatus.Completed;
        await _db.SaveChangesAsync();

        // Hạch toán: lần đầu cộng học sinh; lần sau chỉ đồng bộ lại giáo viên (do service tính lại theo tháng)
        var (applied, msg) = await _accounting.ApplyAsync(sessionId);
        return Ok(new { message = applied ? (msg ?? "Điểm danh + hạch toán thành công.") : (msg ?? "Đã hạch toán trước đó.") });
    }

    [HttpPost("{sessionId:int}/accounting/apply")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> ApplyAccounting([FromRoute] int sessionId, [FromQuery] bool teacherOnly = false)
    {
        var s = await _db.ClassSessions.AsNoTracking().FirstOrDefaultAsync(x => x.SessionId == sessionId);
        if (s == null) return NotFound();

        var role = User.IsInRole("Admin") ? "Admin" : "Teacher";
        var (allowed, reason) = await _guard.CanTakeAsync(User, role, s, _db);
        if (!allowed) return Forbid(reason);

        var (applied, msg) = await _accounting.ApplyAsync(sessionId, teacherOnly);
        if (!applied) return Conflict(new { message = msg });

        return Ok(new { message = msg ?? (teacherOnly ? "Đã hạch toán lại (chỉ giáo viên)." : "Đã hạch toán buổi học.") });
    }
}
