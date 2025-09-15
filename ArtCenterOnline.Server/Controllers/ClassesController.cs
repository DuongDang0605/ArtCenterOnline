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
        DateTime? DayStart,
        string Branch,
        int Status
    );

    private static ClassDto ToDto(ClassInfo c)
        => new(
            c.ClassID,
            c.ClassName,
            c.DayStart , // Fix: handle nullable DateTime
            c.Branch,
            c.Status
        );

    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    // ====== LIST ======
    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<ClassDto>>> GetAll()
    {
        var items = await _db.Classes
            .AsNoTracking()
            .Select(c => new ClassDto(
                c.ClassID,
                c.ClassName,
                c.DayStart ?? default, // Fix: handle nullable DateTime
                c.Branch,
                c.Status))
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
    public async Task<ActionResult<ClassDto>> Create([FromBody] ClassDto input, CancellationToken ct)
    {
        var entity = new ClassInfo
        {
            ClassName = input.ClassName?.Trim(),
            Branch = input.Branch?.Trim(),
            Status = input.Status,
            DayStart = (input.DayStart?.Date) ?? DateTime.Today // mặc định hôm nay
        };

        _db.Classes.Add(entity);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = entity.ClassID }, ToDto(entity));
    }


    // ====== UPDATE (KHÔNG còn logic đổi GV chính) ======
    [HttpPut("{id:int}")]
[Authorize(Policy = "AdminOnly")]
public async Task<IActionResult> Update(int id, [FromBody] ClassInfo payload, CancellationToken ct)
{
    var strategy = _db.Database.CreateExecutionStrategy();

    // Bọc toàn bộ thao tác (kể cả transaction) trong execution strategy để có thể retry an toàn
    return await strategy.ExecuteAsync<IActionResult>(async () =>
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var item = await _db.Classes.FirstOrDefaultAsync(c => c.ClassID == id, ct);
        if (item is null)
        {
            // Không có thay đổi nào; transaction sẽ tự dispose.
            return NotFound();
        }

        var oldStatus = item.Status;

        // Cập nhật các trường…
        item.ClassName = payload.ClassName?.Trim() ?? item.ClassName;
        item.Branch    = payload.Branch?.Trim()    ?? item.Branch;
        item.DayStart  = payload.DayStart == default ? item.DayStart : payload.DayStart;
        item.Status    = payload.Status; // 0=dừng, 1=đang hoạt động, …

        await _db.SaveChangesAsync(ct);

        int cancelled = 0;
        if (oldStatus == 1 && item.Status == 0)
        {
            // QUAN TRỌNG: phương thức này nên dùng CÙNG DbContext (_db) và KHÔNG tự mở transaction riêng.
            cancelled = await CancelFutureSessionsForClassAsync(item.ClassID, ct);

            // Nếu CancelFutureSessionsForClassAsync KHÔNG gọi SaveChanges bên trong, hãy giữ dòng dưới:
            // await _db.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);

        if (oldStatus == 1 && item.Status == 0)
        {
            return Ok(new
            {
                message = $"Đã cập nhật lớp và huỷ {cancelled} buổi từ thời điểm tắt.",
                classId = item.ClassID,
                cancelled
            });
        }

        return Ok(new { message = "Đã cập nhật lớp.", classId = item.ClassID });
    });
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
