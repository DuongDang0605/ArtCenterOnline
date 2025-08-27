using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // bắt buộc đăng nhập
public class ClassStudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ClassStudentsController(AppDbContext db) => _db = db;

    public sealed class ClassStudentBatchAddDto
    {
        public int ClassID { get; set; }
        public List<int> StudentIds { get; set; } = new();
    }

    public sealed class ClassStudentSetActiveDto
    {
        public bool IsActive { get; set; }
    }

    // Thêm 1 học viên vào lớp — AdminOnly
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Add([FromBody] ClassStudent input)
    {
        if (input == null) return BadRequest("Body is required.");

        var clsExists = await _db.Classes.AnyAsync(c => c.ClassID == input.ClassID);
        var stuExists = await _db.Students.AnyAsync(s => s.StudentId == input.StudentId);
        if (!clsExists || !stuExists) return NotFound("Class or Student not found.");

        var exists = await _db.ClassStudents
            .AnyAsync(x => x.ClassID == input.ClassID && x.StudentId == input.StudentId);
        if (exists) return Conflict("Student already in class.");

        if (input.JoinedDate == default)
            input.JoinedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        input.IsActive = true;

        _db.ClassStudents.Add(input);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // Thêm nhiều học viên — AdminOnly
    [HttpPost("batch")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> BatchAdd([FromBody] ClassStudentBatchAddDto dto)
    {
        if (dto == null || dto.StudentIds.Count == 0) return BadRequest("Empty list.");
        var cls = await _db.Classes.FindAsync(dto.ClassID);
        if (cls == null) return NotFound("Class not found.");

        var existingIds = await _db.ClassStudents
            .Where(x => x.ClassID == dto.ClassID && dto.StudentIds.Contains(x.StudentId))
            .Select(x => x.StudentId)
            .ToListAsync();

        var toAddIds = dto.StudentIds.Except(existingIds).ToList();
        if (toAddIds.Count == 0) return Ok(new { added = 0 });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = toAddIds.Select(id => new ClassStudent
        {
            ClassID = dto.ClassID,
            StudentId = id,
            JoinedDate = today,
            IsActive = true,
        });

        _db.ClassStudents.AddRange(rows);
        await _db.SaveChangesAsync();
        return Ok(new { added = toAddIds.Count });
    }

    // Danh sách học viên trong lớp — Admin & Teacher
    [HttpGet("in-class/{classId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<object>>> GetInClass(int classId)
    {
        var q = from cs in _db.ClassStudents
                join s in _db.Students on cs.StudentId equals s.StudentId
                where cs.ClassID == classId
                orderby s.StudentName
                select new
                {
                    cs.ClassID,
                    cs.StudentId,
                    StudentName = s.StudentName,
                    // No Email field (removed)
                    cs.IsActive,
                    cs.JoinedDate,
                    cs.Note
                };

        var data = await q.AsNoTracking().ToListAsync();
        return Ok(data);
    }

    // Bật/tắt IsActive — AdminOnly
    [HttpPut("{classId:int}/{studentId:int}/active")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> SetActive(int classId, int studentId, [FromBody] ClassStudentSetActiveDto dto)
    {
        var row = await _db.ClassStudents
            .SingleOrDefaultAsync(x => x.ClassID == classId && x.StudentId == studentId);

        if (row == null) return NotFound();
        row.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, isActive = row.IsActive });
    }

    // Loại học viên khỏi lớp — AdminOnly
    [HttpDelete("{classId:int}/{studentId:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Remove(int classId, int studentId)
    {
        var row = await _db.ClassStudents
            .SingleOrDefaultAsync(x => x.ClassID == classId && x.StudentId == studentId);

        if (row == null) return NotFound();
        _db.ClassStudents.Remove(row);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}
