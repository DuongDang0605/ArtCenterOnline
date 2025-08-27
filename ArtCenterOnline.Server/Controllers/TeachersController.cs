using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // yêu cầu đăng nhập cho tất cả action trừ khi override
    public class TeachersController : ControllerBase
    {
        private readonly AppDbContext _db;
        public TeachersController(AppDbContext db) => _db = db;

        // ===== DTOs cho create/update =====
        // ===== DTOs cho create/update =====
        public class TeacherCreateDto
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;  // sẽ được hash
            public string TeacherName { get; set; } = string.Empty;
            public string PhoneNumber { get; set; } = string.Empty;
            public int SoBuoiDayTrongThang { get; set; } = 0;
            public int status { get; set; } = 1; // 1=active
        }

        public class TeacherUpdateDto
        {
            public int TeacherId { get; set; }
            public string? Email { get; set; } // null/empty => không đổi
            public string? Password { get; set; } // NEW: null/empty => giữ mật khẩu cũ
            public string TeacherName { get; set; } = string.Empty;
            public string PhoneNumber { get; set; } = string.Empty;
            public int SoBuoiDayTrongThang { get; set; } = 0;
            public int status { get; set; } = 1; // 1=active
        }

        // ===== PUT: update Teacher + optionally change email/password =====
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Update(int id, [FromBody] TeacherUpdateDto input, CancellationToken ct)
        {
            if (id != input.TeacherId)
                return BadRequest("Id không khớp với TeacherId.");

            var teacher = await _db.Teachers
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TeacherId == id, ct);

            if (teacher is null) return NotFound();

            var isAdmin = User.IsInRole("Admin");

            // lấy teacherId của user đăng nhập
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdStr, out var myUserId);
            var myTeacherId = await _db.Teachers
                .Where(t => t.UserId == myUserId)
                .Select(t => t.TeacherId)
                .FirstOrDefaultAsync(ct);

            if (!isAdmin && myTeacherId != id)
                return Forbid();

            // Chỉ cho Teacher sửa name/phone của chính mình
            teacher.TeacherName = input.TeacherName?.Trim() ?? teacher.TeacherName;
            teacher.PhoneNumber = input.PhoneNumber?.Trim() ?? teacher.PhoneNumber;

            if (isAdmin)
            {
                // Admin được sửa thêm các field khác
                if (!string.IsNullOrWhiteSpace(input.Email)) teacher.User.Email = input.Email.Trim();
                if (!string.IsNullOrWhiteSpace(input.Password))
                    teacher.User.PasswordHash = AuthController.HashPassword(input.Password);
                teacher.SoBuoiDayTrongThang = input.SoBuoiDayTrongThang;
                teacher.status = input.status;
                if (teacher.User != null)
                {
                    teacher.User.FullName = teacher.TeacherName;
                    teacher.User.IsActive = input.status == 1;
                }
            }

            await _db.SaveChangesAsync(ct);
            return NoContent();
        }



        // ===== helpers =====
        private async Task<Role> EnsureTeacherRoleAsync()
        {
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Teacher");
            if (role == null)
            {
                role = new Role { Name = "Teacher" };
                _db.Roles.Add(role);
                await _db.SaveChangesAsync();
            }
            return role;
        }

        // ===== GET: list with email =====
        [HttpGet]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<ActionResult<IEnumerable<TeacherRowDto>>> GetAll()
        {
            var rows = await _db.Teachers
                .AsNoTracking()
                .Include(t => t.User)
                .Select(t => new TeacherRowDto(
                    t.TeacherId,
                    t.UserId,
                    t.TeacherName,
                    t.PhoneNumber,
                    t.SoBuoiDayTrongThang,
                    t.status,
                    t.User != null ? t.User.Email : string.Empty
                ))
                .ToListAsync();

            return Ok(rows);
        }

        // ===== GET: by id with email =====
        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<ActionResult<TeacherRowDto>> Get(int id)
        {
            var item = await _db.Teachers
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.TeacherId == id)
                .Select(t => new TeacherRowDto(
                    t.TeacherId,
                    t.UserId,
                    t.TeacherName,
                    t.PhoneNumber,
                    t.SoBuoiDayTrongThang,
                    t.status,
                    t.User != null ? t.User.Email : string.Empty
                ))
                .FirstOrDefaultAsync();

            return item is null ? NotFound() : Ok(item);
        }

        // ===== POST: create Teacher + create User + assign Role(Teacher) =====
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<TeacherRowDto>> Create([FromBody] TeacherCreateDto input)
        {
            if (string.IsNullOrWhiteSpace(input.Email))
                return BadRequest("Email không được để trống.");
            if (string.IsNullOrWhiteSpace(input.Password) || input.Password.Length < 6)
                return BadRequest("Mật khẩu phải ít nhất 6 ký tự.");

            input.Email = input.Email.Trim();

            // Email unique?
            var existed = await _db.Users.AsNoTracking()
                .AnyAsync(u => u.Email == input.Email);
            if (existed) return Conflict("Email đã tồn tại.");

            var teacherRole = await EnsureTeacherRoleAsync();

            // Hash password (dùng helper của AuthController)
            var passwordHash = AuthController.HashPassword(input.Password);

            // Create User
            var user = new User
            {
                Email = input.Email,
                PasswordHash = passwordHash,
                FullName = input.TeacherName?.Trim() ?? string.Empty,
                IsActive = input.status == 1
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            // Assign role Teacher
            _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = teacherRole.RoleId });

            // Create Teacher
            var teacher = new TeacherInfo
            {
                UserId = user.UserId,
                TeacherName = input.TeacherName?.Trim() ?? string.Empty,
                PhoneNumber = input.PhoneNumber?.Trim() ?? string.Empty,
                SoBuoiDayTrongThang = input.SoBuoiDayTrongThang,
                status = input.status
            };
            _db.Teachers.Add(teacher);
            await _db.SaveChangesAsync();

            var dto = new TeacherRowDto(
                teacher.TeacherId,
                teacher.UserId,
                teacher.TeacherName,
                teacher.PhoneNumber,
                teacher.SoBuoiDayTrongThang,
                teacher.status,
                user.Email
            );

            return CreatedAtAction(nameof(Get), new { id = teacher.TeacherId }, dto);
        }

     

        // ===== DELETE: chỉ xoá Teacher (không xoá User để tránh mất lịch sử) =====
        [HttpDelete("{id:int}")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Teachers.FindAsync(id);
            if (item is null) return NotFound();
            _db.Teachers.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // ===== Đặt lại mật khẩu (hash) =====
        [HttpPost("{id:int}/set-password")]
        [Authorize(Policy = "AdminOnly")]
        public async Task<IActionResult> SetPassword(int id, [FromBody] string newPassword)
        {
            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
                return BadRequest("Mật khẩu phải ít nhất 6 ký tự.");

            var teacher = await _db.Teachers
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.TeacherId == id);

            if (teacher == null || teacher.User == null)
                return NotFound();

            teacher.User.PasswordHash = AuthController.HashPassword(newPassword);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Đặt lại mật khẩu thành công" });
        }
    }
}
