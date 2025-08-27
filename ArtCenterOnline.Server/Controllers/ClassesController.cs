using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
[Authorize] // đăng nhập mới xem được
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ClassesController(AppDbContext db) => _db = db;

    public record ClassDto(
        int ClassID,
        string ClassName,
        DateTime DayStart,
        string Branch,
        int Status,
        int? MainTeacherId,
        string? MainTeacherName
    );

    private static ClassDto ToDto(ClassInfo c) =>
        new(c.ClassID, c.ClassName, c.DayStart, c.Branch, c.Status, c.MainTeacherId, c.MainTeacher?.TeacherName);

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

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassInfo input)
    {
        if (id != input.ClassID) return BadRequest();

        var item = await _db.Classes.FindAsync(id);
        if (item is null) return NotFound();

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
