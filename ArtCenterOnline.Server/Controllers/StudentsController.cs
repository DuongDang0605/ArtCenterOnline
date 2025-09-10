using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO;
using ArtCenterOnline.Server.Services; // service vòng đời HS
using ArtCenterOnline.Server.Controllers; // để dùng AuthController.HashPassword
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStudentLifecycleService _lifecycle;

    public StudentsController(AppDbContext db, IStudentLifecycleService lifecycle)
    {
        _db = db;
        _lifecycle = lifecycle;
    }

    // ===== Helpers =====
    private async Task<Role> EnsureRoleAsync(string roleName, CancellationToken ct = default)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName, ct);
        if (role == null)
        {
            role = new Role { Name = roleName };
            _db.Roles.Add(role);
            await _db.SaveChangesAsync(ct);
        }
        return role;
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
    public async Task<ActionResult<object>> Create([FromBody] StudentInfo input, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            // 1) Tạo USER trước với email tạm để không dính ràng buộc FK NOT NULL
            var tempEmail = $"studenttmp-{Guid.NewGuid():N}@example.com";
            var user = new User
            {
                Email = tempEmail,
                // Dùng BCrypt như các chỗ khác trong dự án
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                FullName = (input.StudentName ?? string.Empty).Trim(),
                IsActive = (input.Status == 1)
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct); // có userId

            // 2) Gán ROLE Student
            var studentRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Student", ct);
            if (studentRole == null)
            {
                studentRole = new Role { Name = "Student" };
                _db.Roles.Add(studentRole);
                await _db.SaveChangesAsync(ct);
            }
            _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = studentRole.RoleId });

            // 3) Tạo STUDENT liên kết với user vừa tạo
            input.UserId = user.UserId;
            _db.Students.Add(input);
            await _db.SaveChangesAsync(ct); // có StudentId

            // 4) Cập nhật email chuẩn sau khi biết StudentId
            var finalEmail = $"student{input.StudentId}@example.com";
            var taken = await _db.Users.AnyAsync(u => u.Email == finalEmail && u.UserId != user.UserId, ct);
            if (taken)
            {
                return Conflict(new { message = $"Email {finalEmail} đã tồn tại, không thể tạo tài khoản cho học sinh #{input.StudentId}." });
            }
            user.Email = finalEmail;
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);

            // 5) TRẢ DTO GỌN -> tránh vòng tham chiếu
            return Ok(new
            {
                studentId = input.StudentId,
                email = finalEmail,
                tempPassword = "123456"
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync(ct);
            return StatusCode(500, new
            {
                message = "Tạo học viên + tài khoản đăng nhập thất bại.",
                detail = ex.Message
            });
        }
    }



    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, StudentInfo input)
    {
        if (id != input.StudentId) return BadRequest();

        var existing = await _db.Students.FindAsync(id);
        if (existing == null) return NotFound();

        existing.StudentName = input.StudentName;
        existing.ParentName = input.ParentName;
        existing.PhoneNumber = input.PhoneNumber;
        existing.Adress = input.Adress;
        existing.ngayBatDauHoc = input.ngayBatDauHoc;
        existing.SoBuoiHocConLai = input.SoBuoiHocConLai;
        existing.SoBuoiHocDaHoc = input.SoBuoiHocDaHoc;

        if (existing.Status != input.Status)
        {
            if (input.Status == 0)
            {
                var affected = await _lifecycle.DeactivateStudentAsync(id);
                return Ok(new { message = $"Đã chuyển học sinh sang nghỉ học, tắt {affected} liên kết lớp." });
            }
            else
            {
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

    [HttpGet("me")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(uidStr, out var myUserId)) return Unauthorized();

        var me = await _db.Students.AsNoTracking()
            .Where(s => s.UserId == myUserId)
            .Select(s => new {
                s.StudentId,
                s.StudentName,
                s.ParentName,
                s.PhoneNumber,
                s.Adress,
                s.ngayBatDauHoc,
                s.SoBuoiHocDaHoc,
                s.SoBuoiHocConLai,
                s.Status,
                s.StatusChangedAt
            })
            .FirstOrDefaultAsync(ct);

        if (me == null) return NotFound(new { message = "Không tìm thấy hồ sơ học sinh gắn với tài khoản này." });
        return Ok(me);
    }

    [HttpPut("me")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> UpdateMe([FromBody] StudentSelfUpdateDto input, CancellationToken ct)
    {
        var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(uidStr, out var myUserId)) return Unauthorized();

        var st = await _db.Students.FirstOrDefaultAsync(s => s.UserId == myUserId, ct);
        if (st == null) return NotFound(new { message = "Không tìm thấy hồ sơ học sinh gắn với tài khoản này." });

        static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        if (input.StudentName != null) st.StudentName = Clean(input.StudentName)!;
        if (input.ParentName != null) st.ParentName = Clean(input.ParentName)!;
        if (input.PhoneNumber != null) st.PhoneNumber = Clean(input.PhoneNumber)!;
        if (input.Adress != null) st.Adress = Clean(input.Adress)!;
        
        await _db.SaveChangesAsync(ct);

        var me = await _db.Students.AsNoTracking()
            .Where(s => s.StudentId == st.StudentId)
            .Select(s => new {
                s.StudentId,
                s.StudentName,
                s.ParentName,
                s.PhoneNumber,
                s.Adress,
                s.ngayBatDauHoc,
                s.SoBuoiHocDaHoc,
                s.SoBuoiHocConLai,
                s.Status,
                s.StatusChangedAt
            })
            .FirstAsync(ct);

        return Ok(me);
    }
}
