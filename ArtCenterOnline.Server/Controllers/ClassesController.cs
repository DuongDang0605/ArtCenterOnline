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
    public async Task<IActionResult> Update(int id, [FromBody] ClassInfo input)
    {
        if (id != input.ClassID) return BadRequest();

        var item = await _db.Classes.FindAsync(id);
        if (item is null) return NotFound();

        // Chỉ cập nhật thông tin cơ bản của lớp
        item.ClassName = input.ClassName;
        item.DayStart = input.DayStart;
        item.Branch = input.Branch;
        item.Status = input.Status;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ====== DELETE ======
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
