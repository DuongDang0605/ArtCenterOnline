using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Policy = "AdminOnly")] // 👈 chỉ Admin mới dùng được các API quản trị user
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        public UsersController(AppDbContext db) => _db = db;

        // ===== Legacy DTO (giữ nguyên cho FE) =====
        public class LegacyUserDto
        {
            public int UserId { get; set; }
            public string UserEmail { get; set; } = string.Empty; // map -> User.Email
            public string Password { get; set; } = string.Empty;  // map -> User.PasswordHash (hash) | GET trả rỗng
            public int Status { get; set; } = 1;                  // map -> User.IsActive (1/0)
            public string? role { get; set; } = "Teacher";        // map <- UserRoles (tên role đầu tiên)
        }

        // ===== Helpers =====
        private static LegacyUserDto ToLegacy(User u, string? primaryRole) => new LegacyUserDto
        {
            UserId = u.UserId,
            UserEmail = u.Email ?? string.Empty,
            Password = string.Empty,            // không trả hash/plain
            Status = u.IsActive ? 1 : 0,
            role = primaryRole ?? string.Empty
        };

        private Task<string?> GetPrimaryRoleAsync(int userId, CancellationToken ct) =>
            _db.UserRoles.Where(ur => ur.UserId == userId)
                         .Select(ur => ur.Role.Name)
                         .FirstOrDefaultAsync(ct);

        private Task<bool> HasAdminRoleAsync(int userId, CancellationToken ct) =>
            _db.UserRoles.Where(ur => ur.UserId == userId)
                         .AnyAsync(ur => ur.Role.Name == "Admin", ct);

        private async Task<Role> EnsureRoleAsync(string roleName, CancellationToken ct)
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

        // ===== GET: api/users =====
        [HttpGet]
        public async Task<ActionResult<IEnumerable<LegacyUserDto>>> GetAll(CancellationToken ct)
        {
            var users = await _db.Users.AsNoTracking()
                                       .OrderByDescending(u => u.UserId)
                                       .ToListAsync(ct);

            var result = new List<LegacyUserDto>(users.Count);
            foreach (var u in users)
            {
                var roleName = await GetPrimaryRoleAsync(u.UserId, ct);
                result.Add(ToLegacy(u, roleName));
            }
            return Ok(result);
        }

        // ===== GET: api/users/5 =====
        [HttpGet("{id:int}")]
        public async Task<ActionResult<LegacyUserDto>> GetById(int id, CancellationToken ct)
        {
            var user = await _db.Users.AsNoTracking()
                                      .FirstOrDefaultAsync(u => u.UserId == id, ct);
            if (user == null) return NotFound();

            var roleName = await GetPrimaryRoleAsync(user.UserId, ct);
            return Ok(ToLegacy(user, roleName));
        }

        // ===== POST: api/users =====
        [HttpPost]
        public async Task<ActionResult<LegacyUserDto>> Create([FromBody] LegacyUserDto input, CancellationToken ct)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            // Không cho tạo Admin qua endpoint này
            if (!string.IsNullOrWhiteSpace(input.role) &&
                string.Equals(input.role, "Admin", System.StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(403, "Không thể tạo tài khoản role Admin.");
            }

            var email = (input.UserEmail ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(email)) return BadRequest("Email không được để trống.");

            var exists = await _db.Users.AnyAsync(u => u.Email == email, ct);
            if (exists) return Conflict($"Email '{email}' đã tồn tại.");

            // Hash password (nếu trống -> đặt mặc định)
            var rawPassword = input.Password?.Trim();
            if (string.IsNullOrEmpty(rawPassword)) rawPassword = "changeme123";
            if (rawPassword.Length < 6) return BadRequest("Mật khẩu phải ít nhất 6 ký tự.");
            var passwordHash = AuthController.HashPassword(rawPassword);

            var user = new User
            {
                Email = email,
                PasswordHash = passwordHash,
                FullName = "",
                IsActive = input.Status == 1
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);

            // Gán role (mặc định Teacher nếu FE không gửi)
            var roleName = string.IsNullOrWhiteSpace(input.role) ? "Teacher" : input.role!.Trim();
            var role = await EnsureRoleAsync(roleName, ct);
            _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = role.RoleId });
            await _db.SaveChangesAsync(ct);

            var dto = ToLegacy(user, role.Name);
            return CreatedAtAction(nameof(GetById), new { id = user.UserId }, dto);
        }

        // ===== PUT: api/users/5 =====
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin,Teacher,Student")]
        public async Task<IActionResult> Update(int id, [FromBody] LegacyUserDto input, CancellationToken ct)
        {
            if (id != input.UserId) return BadRequest("Id không khớp.");

            var current = await _db.Users.FirstOrDefaultAsync(u => u.UserId == id, ct);
            if (current == null) return NotFound();

            var isAdmin = User.IsInRole("Admin");

            // nếu là Teacher: chỉ được sửa chính mình
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdStr, out var myUserId);
            if (!isAdmin && myUserId != id) return Forbid();

            // Cho Teacher đổi email/mật khẩu của chính mình
            var newEmail = (input.UserEmail ?? "").Trim();
            if (!string.IsNullOrEmpty(newEmail))
            {
                var emailTaken = await _db.Users.AnyAsync(u => u.Email == newEmail && u.UserId != id, ct);
                if (emailTaken) return Conflict($"Email {newEmail} đã được dùng.");
                current.Email = newEmail;
            }

            if (!string.IsNullOrEmpty(input.Password))
            {
                if (input.Password.Length < 6) return BadRequest("Mật khẩu >=6 ký tự");
                current.PasswordHash = AuthController.HashPassword(input.Password);
            }

            if (isAdmin)
            {
                current.IsActive = input.Status == 1;
                // Admin có thể đổi thêm các field khác
            }

            await _db.SaveChangesAsync(ct);
            return NoContent();
        }

        // ===== DELETE: api/users/5 =====
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id, CancellationToken ct)
        {
            var user = await _db.Users.FindAsync(new object[] { id }, ct);
            if (user == null) return NotFound();

            // Chặn xoá Admin
            if (await HasAdminRoleAsync(user.UserId, ct))
                return StatusCode(403, "Không thể xoá tài khoản Admin.");

            _db.Users.Remove(user);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
    }
}
