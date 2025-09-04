using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services; // <-- thêm
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStudentLifecycleService _lifecycle; // <-- thêm

    public StudentsController(AppDbContext db, IStudentLifecycleService lifecycle) // <-- inject
    {
        _db = db;
        _lifecycle = lifecycle;
    }

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

        var existing = await _db.Students.FindAsync(id);
        if (existing == null) return NotFound();

        // Cập nhật các field cho phép
        existing.StudentName = input.StudentName;
        existing.ParentName = input.ParentName;
        existing.PhoneNumber = input.PhoneNumber;
        existing.Adress = input.Adress;
        existing.ngayBatDauHoc = input.ngayBatDauHoc;
        existing.SoBuoiHocConLai = input.SoBuoiHocConLai;
        existing.SoBuoiHocDaHoc = input.SoBuoiHocDaHoc;

        // Nếu Status thay đổi
        if (existing.Status != input.Status)
        {
            if (input.Status == 0)
            {
                // Gọi service để tắt toàn hệ thống
                var affected = await _lifecycle.DeactivateStudentAsync(id);
                return Ok(new { message = $"Đã chuyển học sinh sang nghỉ học, tắt {affected} liên kết lớp." });
            }
            else
            {
                // Cho phép bật lại trạng thái học sinh (không tự động bật lại các liên kết lớp)
                existing.Status = input.Status;
                existing.StatusChangedAt = DateTime.UtcNow;
            }
        }

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
