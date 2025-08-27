using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IJwtTokenService _jwt;

        public AuthController(AppDbContext db, IJwtTokenService jwt)
        {
            _db = db;
            _jwt = jwt;
        }
        public static string HashPassword(string rawPassword)
        {
            if (string.IsNullOrWhiteSpace(rawPassword))
                throw new ArgumentException("Password không được để trống");

            // Luôn dùng BCrypt
            return BCrypt.Net.BCrypt.HashPassword(rawPassword, workFactor: 12);
        }
        public record LoginReq(string Email, string Password);

        private static bool LooksLikeBCrypt(string? s)
            => !string.IsNullOrEmpty(s) &&
               (s.StartsWith("$2a$") || s.StartsWith("$2b$") || s.StartsWith("$2y$"));
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginReq req)
        {
            if (req is null || string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrEmpty(req.Password))
                return BadRequest(new { message = "Thiếu email hoặc mật khẩu" });

            var emailNorm = req.Email.Trim().ToLowerInvariant();

            var user = await _db.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .SingleOrDefaultAsync(u => u.Email.ToLower() == emailNorm);

            if (user == null) return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });
            if (!user.IsActive) return Unauthorized(new { message = "Tài khoản đã bị khoá" });

            bool ok = false;
            if (LooksLikeBCrypt(user.PasswordHash))
            {
                ok = BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash);
            }
            else
            {
                if (string.Equals(user.PasswordHash ?? "", req.Password, StringComparison.Ordinal))
                {
                    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, workFactor: 12);
                    await _db.SaveChangesAsync();
                    ok = true;
                }
            }
            if (!ok) return Unauthorized(new { message = "Email hoặc mật khẩu không đúng" });

            var roles = user.UserRoles?.Select(ur => ur.Role.Name).ToArray() ?? Array.Empty<string>();

            // 🔹 lấy TeacherId (nếu có mapping)
            var teacherId = await _db.Teachers
                .Where(t => t.UserId == user.UserId)
                .Select(t => t.TeacherId)
                .FirstOrDefaultAsync();

            var access = _jwt.GenerateAccessToken(user, roles);
            var refresh = _jwt.GenerateRefreshToken(user);

            return Ok(new
            {
                accessToken = access,
                refreshToken = refresh,
                user = new
                {
                    user.UserId,
                    user.Email,
                    user.FullName,
                    roles,
                    TeacherId = teacherId // thêm field này
                }
            });
        }

    }
}
