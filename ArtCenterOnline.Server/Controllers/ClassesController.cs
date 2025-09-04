// Controllers/ClassesController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

#nullable enable

[ApiController]
[Route("api/[controller]")]
[Authorize] // giữ nguyên yêu cầu đăng nhập
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClassesController(AppDbContext db)
    {
        _db = db;
    }

    // ====== DTO & helpers nhỏ ======
    public record ClassDto(
        int ClassID,
        string ClassName,
        DateTime DayStart,
        string Branch,
        int Status,
        int? MainTeacherId,
        string? MainTeacherName
    );

    private static string VNDayOfWeek(DayOfWeek d)
        => d switch
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

    private static ClassDto ToDto(ClassInfo c) =>
        new(c.ClassID, c.ClassName, c.DayStart, c.Branch, c.Status, c.MainTeacherId, c.MainTeacher?.TeacherName);

    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    // ====== Các API khác giữ nguyên phong cách ======

    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<ClassDto>>> GetAll()
    {
        var items = await _db.Classes
            .Include(c => c.MainTeacher)
            .AsNoTracking()
            .Select(c => new ClassDto(
                c.ClassID, c.ClassName, c.DayStart, c.Branch, c.Status,
                c.MainTeacherId, c.MainTeacher != null ? c.MainTeacher.TeacherName : null))
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<ClassDto>> Get(int id)
    {
        var item = await _db.Classes
            .Include(c => c.MainTeacher)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ClassID == id);

        return item is null ? NotFound() : Ok(ToDto(item));
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Create([FromBody] ClassInfo input)
    {
        _db.Classes.Add(input);
        await _db.SaveChangesAsync();

        var created = await _db.Classes.Include(c => c.MainTeacher).FirstAsync(c => c.ClassID == input.ClassID);
        return CreatedAtAction(nameof(Get), new { id = created.ClassID }, ToDto(created));
    }

    // ======================= UPDATE (đổi giáo viên chính) =======================
    // Trả lỗi rõ ràng:
    // - Schedule overlap: "Thứ mấy HH:mm-HH:mm tại lớp <Tên lớp>"
    // - Session overlap:  "dd/MM/yyyy HH:mm-HH:mm tại lớp <Tên lớp>"
    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassInfo input)
    {
        if (id != input.ClassID) return BadRequest();

        var item = await _db.Classes.FindAsync(id);
        if (item is null) return NotFound();

        // ==== VALIDATE: đổi giáo viên chính ====
        if (input.MainTeacherId != item.MainTeacherId && input.MainTeacherId.HasValue)
        {
            int newTeacherId = input.MainTeacherId.Value;

            // 1) Check trùng lịch tuần (ClassSchedules) của lớp hiện tại
            //    Với từng lịch của lớp này, tìm lịch của lớp KHÁC mà giáo viên mới đang dạy
            //    cùng DayOfWeek, overlap thời gian -> báo "Thứ mấy", khung giờ, lớp nào
            var mySchedules = await _db.ClassSchedules
                .Where(s => s.ClassID == id && s.IsActive)
                .Select(s => new { s.DayOfWeek, s.StartTime, s.EndTime })
                .ToListAsync();

            if (mySchedules.Count > 0)
            {
                foreach (var sc in mySchedules)
                {
                    var conflict = await _db.ClassSchedules
                        .Include(s => s.Class)
                        .Where(s =>
                            s.IsActive &&
                            s.ClassID != id &&
                            s.DayOfWeek == sc.DayOfWeek &&
                            s.Class!.MainTeacherId == newTeacherId &&
                            // overlap: startA < endB && startB < endA
                            sc.StartTime < s.EndTime && s.StartTime < sc.EndTime)
                        .Select(s => new
                        {
                            s.StartTime,
                            s.EndTime,
                            ClassName = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}"
                        })
                        .FirstOrDefaultAsync();

                    if (conflict != null)
                    {
                        var dow = VNDayOfWeek(sc.DayOfWeek);
                        return Conflict(new
                        {
                            message = $"Không thể đổi giáo viên chính: trùng lịch tuần {dow} " +
                                      $"{sc.StartTime:hh\\:mm}-{sc.EndTime:hh\\:mm} với lớp {conflict.ClassName} " +
                                      $"(lớp đó dạy {conflict.StartTime:hh\\:mm}-{conflict.EndTime:hh\\:mm})."
                        });
                    }
                }
            }

            // 2) Check trùng các buổi thực tế (ClassSessions) của lớp này từ hôm nay trở đi
            //    Tìm buổi của GIÁO VIÊN MỚI cùng ngày, overlap khung giờ -> báo "ngày dd/MM/yyyy", khung giờ, lớp nào
            var today = DateOnly.FromDateTime(DateTime.Today);
            var myUpcoming = await _db.ClassSessions
                .Where(s => s.ClassID == id && s.SessionDate >= today)
                .Select(s => new { s.SessionId, s.SessionDate, s.StartTime, s.EndTime })
                .ToListAsync();

            foreach (var sess in myUpcoming)
            {
                var conflictSession = await _db.ClassSessions
                    .Include(s => s.Class)
                    .Where(s =>
                        s.TeacherId == newTeacherId &&
                        s.SessionDate == sess.SessionDate &&
                        s.SessionId != sess.SessionId &&
                        // overlap
                        sess.StartTime < s.EndTime && s.StartTime < sess.EndTime)
                    .Select(s => new
                    {
                        s.StartTime,
                        s.EndTime,
                        ClassName = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}"
                    })
                    .FirstOrDefaultAsync();

                if (conflictSession != null)
                {
                    return Conflict(new
                    {
                        message = $"Không thể đổi giáo viên chính: trùng buổi {sess.SessionDate:dd/MM/yyyy} " +
                                  $"{sess.StartTime:hh\\:mm}-{sess.EndTime:hh\\:mm} tại lớp {conflictSession.ClassName} " +
                                  $"(lớp đó dạy {conflictSession.StartTime:hh\\:mm}-{conflictSession.EndTime:hh\\:mm})."
                    });
                }
            }
        }
        // ==== END VALIDATE ====

        // Cập nhật thông tin lớp
        item.ClassName = input.ClassName;
        item.DayStart = input.DayStart;
        item.Branch = input.Branch;
        item.Status = input.Status;
        item.MainTeacherId = input.MainTeacherId;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Classes.FindAsync(id);
        if (item is null) return NotFound();
        _db.Classes.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
