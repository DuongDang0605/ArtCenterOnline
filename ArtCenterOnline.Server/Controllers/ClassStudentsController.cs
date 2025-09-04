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
        if (!clsExists) return NotFound("Class not found.");

        var student = await _db.Students.FirstOrDefaultAsync(s => s.StudentId == input.StudentId);
        if (student == null) return NotFound("Student not found.");
        if (student.Status == 0) return Conflict("Student is inactive and cannot be added to a class.");

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

        // Lọc học sinh đang active toàn hệ thống
        var activeStudents = await _db.Students
            .Where(s => dto.StudentIds.Contains(s.StudentId) && s.Status == 1)
            .Select(s => s.StudentId)
            .ToListAsync();

        var existingIds = await _db.ClassStudents
            .Where(x => x.ClassID == dto.ClassID && activeStudents.Contains(x.StudentId))
            .Select(x => x.StudentId)
            .ToListAsync();

        var toAddIds = activeStudents.Except(existingIds).ToList();
        if (toAddIds.Count == 0)
            return Ok(new { added = 0, note = "No eligible active students to add." });

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
                join c in _db.Classes on cs.ClassID equals c.ClassID
                where cs.ClassID == classId
                orderby s.StudentName
                select new
                {
                    cs.ClassID,
                    cs.StudentId,
                    ClassName = c.ClassName,
                    StudentName = s.StudentName,
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

        // Nếu Student đã nghỉ (Status=0) thì không cho bật lại liên kết lớp
        var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.StudentId == studentId);
        if (student == null) return NotFound("Student not found.");
        if (dto.IsActive && student.Status == 0)
            return Conflict("Student is inactive. Cannot activate class link.");

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
