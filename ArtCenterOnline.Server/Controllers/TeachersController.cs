using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
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

        // ===== DTOs cho create/update (ĐÃ BỎ SoBuoiDayTrongThang) =====
        public class TeacherCreateDto
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;  // sẽ được hash
            public string TeacherName { get; set; } = string.Empty;
            public string PhoneNumber { get; set; } = string.Empty;
            public int status { get; set; } = 1; // 1=active
        }

        public class TeacherUpdateDto
        {
            public int TeacherId { get; set; }
            public string? Email { get; set; }      // null/empty => không đổi
            public string? Password { get; set; }   // null/empty => giữ mật khẩu cũ
            public string TeacherName { get; set; } = string.Empty;
            public string PhoneNumber { get; set; } = string.Empty;
            public int status { get; set; } = 1; // 1=active
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

        // ===== GET: list — trả sessionsThisMonth từ TeacherMonthlyStat, và chỉ THÊM soBuoiDayThangTruoc =====
        [HttpGet]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<ActionResult<IEnumerable<object>>> GetAll(CancellationToken ct)
        {
            var today = DateTime.Today;
            int y = today.Year, m = today.Month;

            var firstThisDO = new DateOnly(y, m, 1);
            var firstPrevDO = firstThisDO.AddMonths(-1);

            const int STATUS_COMPLETED = 1;

            // Đếm tháng trước -> dict { TeacherId -> Count }
            var prevCounts = await _db.ClassSessions
                .AsNoTracking()
                .Where(s => s.TeacherId != null
                         && s.SessionDate >= firstPrevDO
                         && s.SessionDate < firstThisDO
                         && (int)s.Status == STATUS_COMPLETED)
                .GroupBy(s => s.TeacherId!.Value)
                .Select(g => new { TeacherId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TeacherId, x => x.Count, ct);

            // Lấy danh sách teacher + sessionsThisMonth (giữ nguyên cách lấy)
            var baseRows = await _db.Teachers
                .AsNoTracking()
                .Include(t => t.User)
                .Select(t => new
                {
                    teacherId = t.TeacherId,
                    userId = t.UserId,
                    teacherName = t.TeacherName,
                    phoneNumber = t.PhoneNumber,
                    status = t.status,
                    email = t.User != null ? t.User.Email : string.Empty,

                    sessionsThisMonth = _db.TeacherMonthlyStats
                        .Where(s => s.TeacherId == t.TeacherId && s.Year == y && s.Month == m)
                        .Select(s => (int?)s.TaughtCount).FirstOrDefault() ?? 0,
                })
                .ToListAsync(ct);

            var result = baseRows.Select(r => new
            {
                r.teacherId,
                r.userId,
                r.teacherName,
                r.phoneNumber,
                r.status,
                r.email,
                r.sessionsThisMonth,
                soBuoiDayThangTruoc = prevCounts.TryGetValue(r.teacherId, out var c) ? c : 0
            });

            return Ok(result);
        }

        // ===== GET: chi tiết theo id — vẫn chỉ THÊM soBuoiDayThangTruoc, giữ nguyên các trường khác =====
        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<ActionResult<object>> Get(int id, CancellationToken ct)
        {
            var today = DateTime.Today;
            int y = today.Year, m = today.Month;

            var firstThisDO = new DateOnly(y, m, 1);
            var firstPrevDO = firstThisDO.AddMonths(-1);

            const int STATUS_COMPLETED = 1;

            var item = await _db.Teachers
                .AsNoTracking()
                .Include(t => t.User)
                .Where(t => t.TeacherId == id)
                .Select(t => new
                {
                    teacherId = t.TeacherId,
                    userId = t.UserId,
                    teacherName = t.TeacherName,
                    phoneNumber = t.PhoneNumber,
                    status = t.status,
                    email = t.User != null ? t.User.Email : string.Empty,

                    // giữ nguyên sessionsThisMonth từ TeacherMonthlyStats (tháng này)
                    sessionsThisMonth = _db.TeacherMonthlyStats
                        .Where(s => s.TeacherId == t.TeacherId && s.Year == y && s.Month == m)
                        .Select(s => (int?)s.TaughtCount).FirstOrDefault() ?? 0,

                    // chỉ thêm: số buổi dạy THÁNG TRƯỚC đếm trực tiếp từ ClassSessions
                    soBuoiDayThangTruoc = _db.ClassSessions
                        .Where(s => s.TeacherId == t.TeacherId
                                 && s.SessionDate >= firstPrevDO
                                 && s.SessionDate < firstThisDO
                                 && (int)s.Status == STATUS_COMPLETED)
                        .Count()
                })
                .FirstOrDefaultAsync(ct);

            return item is null ? NotFound() : Ok(item);
        }

        // ===== POST: create Teacher + User + assign Role(Teacher) =====
        [HttpPost]
        [Authorize(Policy = "AdminOnly")]
        public async Task<ActionResult<object>> Create([FromBody] TeacherCreateDto input)
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
                status = input.status
            };
            _db.Teachers.Add(teacher);
            await _db.SaveChangesAsync();

            // sessionsThisMonth (tháng này) từ TeacherMonthlyStats - giữ nguyên
            var today = DateTime.Today;
            int y = today.Year, m = today.Month;
            int sessionsThisMonth = await _db.TeacherMonthlyStats
                .Where(s => s.TeacherId == teacher.TeacherId && s.Year == y && s.Month == m)
                .Select(s => (int?)s.TaughtCount).FirstOrDefaultAsync() ?? 0;

            var dto = new
            {
                teacherId = teacher.TeacherId,
                userId = teacher.UserId,
                teacherName = teacher.TeacherName,
                phoneNumber = teacher.PhoneNumber,
                status = teacher.status,
                email = user.Email,
                sessionsThisMonth
                // không thêm soBuoiDayThangTruoc ở POST (theo yêu cầu chỉ thêm ở view/list)
            };

            return CreatedAtAction(nameof(Get), new { id = teacher.TeacherId }, dto);
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
                if (!string.IsNullOrWhiteSpace(input.Email) && teacher.User != null)
                    teacher.User.Email = input.Email.Trim();

                if (!string.IsNullOrWhiteSpace(input.Password) && teacher.User != null)
                    teacher.User.PasswordHash = AuthController.HashPassword(input.Password);

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
