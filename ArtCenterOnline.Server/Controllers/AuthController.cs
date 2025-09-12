using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using ArtCenterOnline.Server.Model.DTO.Auth;


namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IJwtTokenService _jwt;
        private readonly ILogger<AuthController> _logger;
        private readonly IOtpService _otpService;
        private readonly IResetTokenStore _resetTokenStore;
        public AuthController(IResetTokenStore resetTokenStore, ILogger<AuthController> logger, IOtpService otpService, AppDbContext db, IJwtTokenService jwt)
        {
            _logger = logger;
            _resetTokenStore = resetTokenStore;
            _otpService = otpService;
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
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordReq req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers["User-Agent"].ToString();

            await _otpService.CreateAndSendOtpAsync(req.Email.Trim(), ip, ua);

            // Luôn trả message chung để không lộ email
            return Ok(new { message = "Nếu email tồn tại, chúng tôi đã gửi mã OTP." });
        }


        // ======= Verify OTP (STUB) =======
        [HttpPost("verify-otp")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpReq req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var vr = await _otpService.VerifyOtpAsync(req.Email, req.Code);

            if (!vr.Success)
            {
                // Thông báo chung, kèm errorCode để FE xử lý nếu muốn
                return BadRequest(new
                {
                    message = "Mã OTP không hợp lệ hoặc đã hết hạn.",
                    error = vr.ErrorCode
                });
            }

            return Ok(new { resetToken = vr.ResetToken });
        }


        // ======= Reset password (STUB) =======
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordReq req)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Lấy & xóa token (1 lần dùng)
            if (!_resetTokenStore.TryTake(req.ResetToken, out var data))
                return BadRequest(new { message = "Mã đặt lại không hợp lệ hoặc đã hết hạn." });

            // Lấy user & OTP record
            var user = await _db.Users.SingleOrDefaultAsync(u => u.UserId == data.UserId);
            var otp = await _db.PasswordResetOtps.SingleOrDefaultAsync(o => o.OtpId == data.OtpId);

            if (user == null || otp == null || otp.ConsumedAtUtc != null)
                return BadRequest(new { message = "Mã đặt lại không hợp lệ hoặc đã hết hạn." });

            // Hash & cập nhật mật khẩu
            var newHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword, workFactor: 11);
            user.PasswordHash = newHash;

            // Consume OTP
            otp.ConsumedAtUtc = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            _logger.LogInformation("Password reset OK for userId={UserId}, otpId={OtpId}", user.UserId, otp.OtpId);
            return Ok(new { message = "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." });
        }


    }

}
