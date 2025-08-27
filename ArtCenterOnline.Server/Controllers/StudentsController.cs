using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public StudentsController(AppDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<StudentInfo>>> GetAll()
        => Ok(await _db.Students.AsNoTracking().ToListAsync());

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<StudentInfo>> Get(int id)
    {
        var item = await _db.Students.FindAsync(id);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpGet("not-in-class/{classId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<StudentInfo>>> GetActiveNotInClass(int classId)
    {
        var studentIdsInClass = await _db.ClassStudents
            .Where(cs => cs.ClassID == classId)
            .Select(cs => cs.StudentId)
            .ToListAsync();

        var result = await _db.Students
            .AsNoTracking()
            .Where(s => s.Status == 1 && !studentIdsInClass.Contains(s.StudentId))
            .ToListAsync();

        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StudentInfo>> Create(StudentInfo input)
    {
        _db.Students.Add(input);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = input.StudentId }, input);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, StudentInfo input)
    {
        if (id != input.StudentId) return BadRequest();
        _db.Entry(input).State = EntityState.Modified;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Students.FindAsync(id);
        if (item is null) return NotFound();
        _db.Students.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
