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

    // ====== DTO (KHÔNG còn trường GV chính) ======
    public record ClassDto(
        int ClassID,
        string ClassName,
        DateTime DayStart,
        string Branch,
        int Status
    );

    private static ClassDto ToDto(ClassInfo c)
        => new(c.ClassID, c.ClassName, c.DayStart, c.Branch, c.Status);

    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    // ====== LIST ======
    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<ClassDto>>> GetAll()
    {
        var items = await _db.Classes
            .AsNoTracking()
            .Select(c => new ClassDto(c.ClassID, c.ClassName, c.DayStart, c.Branch, c.Status))
            .ToListAsync();

        return Ok(items);
    }

    // ====== DETAIL ======
    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<ClassDto>> Get(int id)
    {
        var item = await _db.Classes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ClassID == id);

        return item is null ? NotFound() : Ok(ToDto(item));
    }

    // ====== CREATE ======
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Create([FromBody] ClassInfo input)
    {
        _db.Classes.Add(input);
        await _db.SaveChangesAsync();
        var created = await _db.Classes.FirstAsync(c => c.ClassID == input.ClassID);
        return CreatedAtAction(nameof(Get), new { id = created.ClassID }, ToDto(created));
    }

    // ====== UPDATE (KHÔNG còn logic đổi GV chính) ======
    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassInfo payload, CancellationToken ct)
    {
        var item = await _db.Classes.FirstOrDefaultAsync(c => c.ClassID == id, ct);
        if (item is null) return NotFound();

        using var tx = await _db.Database.BeginTransactionAsync(ct);

        var oldStatus = item.Status;
        // cập nhật các trường khác…
        item.ClassName = payload.ClassName?.Trim() ?? item.ClassName;
        item.Branch = payload.Branch?.Trim() ?? item.Branch;
        item.DayStart = payload.DayStart == default ? item.DayStart : payload.DayStart;
        item.Status = payload.Status; // 0=dừng, 1=đang hoạt động, … (giữ mapping hiện tại)

        await _db.SaveChangesAsync(ct);

        // Nếu chuyển từ Đang hoạt động (1) sang Dừng (0) → Huỷ các buổi từ bây giờ trở đi
        if (oldStatus == 1 && item.Status == 0)
        {
            var cancelled = await CancelFutureSessionsForClassAsync(item.ClassID, ct);
            // (tuỳ chọn) có thể trả về cancelled count cho FE
            await tx.CommitAsync(ct);
            return Ok(new
            {
                message = $"Đã cập nhật lớp và huỷ {cancelled} buổi từ thời điểm tắt.",
                classId = item.ClassID,
                cancelled
            });
        }

        await tx.CommitAsync(ct);
        return Ok(new { message = "Đã cập nhật lớp.", classId = item.ClassID });
    }


    // Hủy tất cả buổi của lớp từ "bây giờ" trở đi (tính theo local time).
    private async Task<int> CancelFutureSessionsForClassAsync(int classId, CancellationToken ct = default)
    {
        var nowLocal = DateTime.Now;
        var today = DateOnly.FromDateTime(nowLocal);
        var nowSpan = new TimeSpan(nowLocal.Hour, nowLocal.Minute, 0);

        var sessions = await _db.ClassSessions
            .Where(s => s.ClassID == classId
                        && s.Status != SessionStatus.Cancelled
                        && (s.SessionDate > today
                            || (s.SessionDate == today && s.StartTime >= nowSpan)))
            .ToListAsync(ct);

        if (sessions.Count == 0) return 0;

        string stamp = $"{nowLocal:dd/MM/yyyy HH:mm}";
        foreach (var s in sessions)
        {
            s.Status = SessionStatus.Cancelled;
            s.Note = string.IsNullOrWhiteSpace(s.Note)
                ? $"(Huỷ do lớp bị tắt lúc {stamp})"
                : $"{s.Note} | Huỷ do lớp bị tắt lúc {stamp}";
        }

        await _db.SaveChangesAsync(ct);
        return sessions.Count;
    }

}
