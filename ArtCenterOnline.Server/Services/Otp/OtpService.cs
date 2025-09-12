using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Services
{
    public class OtpService : IOtpService
    {
        private readonly AppDbContext _db;
        private readonly IEmailSender _email;
        private readonly ILogger<OtpService> _logger;
        private readonly OtpOptions _opt;
        private readonly IResetTokenStore _resetTokenStore;
        public OtpService(AppDbContext db, IEmailSender email, IOptions<OtpOptions> opt,
                          ILogger<OtpService> logger, IResetTokenStore resetTokenStore)
        {
            _db = db; _email = email; _logger = logger; _opt = opt.Value; _resetTokenStore = resetTokenStore;
        }

     

        public async Task CreateAndSendOtpAsync(string email, string? clientIp, string? userAgent)
        {
            if (string.IsNullOrWhiteSpace(email)) return;
            var normEmail = email.Trim();

            // Tìm user theo email (collation bạn đang dùng là CI, so sánh thông thường OK)
            var user = await _db.Users
                .AsNoTracking()
                .SingleOrDefaultAsync(u => u.Email == normEmail);

            // Không lộ email: nếu không có user → trả yên lặng
            if (user == null)
            {
                _logger.LogInformation("ForgotPassword requested for NON-EXIST email: {Email}", normEmail);
                return;
            }

            // Tạo mã OTP numeric
            var code = GenerateNumericCode(_opt.Length); // ví dụ 6 chữ số
            var codeHash = BCrypt.Net.BCrypt.HashPassword(code, _opt.WorkFactor);
            var nowUtc = DateTime.UtcNow;

            // Tìm OTP "đang hoạt động" (ConsumedAtUtc IS NULL) cho user/purpose
            var active = await _db.PasswordResetOtps
                .SingleOrDefaultAsync(x => x.UserId == user.UserId
                                        && x.Purpose == "reset"
                                        && x.ConsumedAtUtc == null);

            if (active == null)
            {
                active = new PasswordResetOtp
                {
                    OtpId = Guid.NewGuid(),
                    UserId = user.UserId,
                    Purpose = "reset",
                    CodeHash = codeHash,
                    ExpiresAtUtc = nowUtc.AddMinutes(_opt.TtlMinutes),
                    Attempts = 0,
                    SendCount = 1,
                    LastSentAtUtc = nowUtc,
                    ClientIp = clientIp,
                    UserAgent = userAgent
                };
                _db.PasswordResetOtps.Add(active);
            }
            else
            {
                // Cập nhật lại mã mới & TTL (bước 3 chưa siết cooldown/limit)
                active.CodeHash = codeHash;
                active.ExpiresAtUtc = nowUtc.AddMinutes(_opt.TtlMinutes);
                active.Attempts = 0;
                active.SendCount = (active.SendCount <= 0 ? 1 : active.SendCount + 1);
                active.LastSentAtUtc = nowUtc;
                active.ClientIp = clientIp;
                active.UserAgent = userAgent;
                _db.PasswordResetOtps.Update(active);
            }

            await _db.SaveChangesAsync();

            // Email nội dung (bước 3: sẽ log ra console thay vì gửi thật)
            var subject = "Mã OTP đặt lại mật khẩu";
            var body = new StringBuilder()
                .AppendLine("Chào bạn,")
                .AppendLine()
                .AppendLine($"Mã OTP đặt lại mật khẩu của bạn là: {code}")
                .AppendLine($"Hiệu lực trong {_opt.TtlMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.")
                .AppendLine()
                .AppendLine("Nếu bạn không yêu cầu, hãy bỏ qua email này.")
                .AppendLine()
                .AppendLine("— ArtCenterOnline")
                .ToString();

            await _email.SendAsync(normEmail, subject, body);

            // Log để test nhanh
            _logger.LogInformation("OTP generated for {Email}, expires at {ExpUtc}. (DEV hint: {Code})",
                normEmail, active.ExpiresAtUtc, code);
        }

        private static string GenerateNumericCode(int length)
        {
            // Tạo mã số an toàn bằng RNG
            // Nếu length=6: trả "000000"… "999999"
            if (length >= 1 && length <= 9)
            {
                var max = (int)Math.Pow(10, length);
                var n = RandomNumberGenerator.GetInt32(0, max);
                return n.ToString($"D{length}");
            }

            // Length khác → ghép từng chữ số
            var sb = new StringBuilder(length);
            for (int i = 0; i < length; i++)
            {
                var d = RandomNumberGenerator.GetInt32(0, 10);
                sb.Append(d);
            }
            return sb.ToString();
        }

        public async Task<OtpVerifyResult> VerifyOtpAsync(string email, string code)
        {
            var result = new OtpVerifyResult { Success = false };

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
            {
                result.ErrorCode = "invalid_or_expired";
                return result;
            }

            var normEmail = email.Trim();
            var nowUtc = DateTime.UtcNow;

            // Lấy user
            var user = await _db.Users.AsNoTracking()
                .SingleOrDefaultAsync(u => u.Email == normEmail);

            if (user == null)
            {
                // Không lộ email
                result.ErrorCode = "invalid_or_expired";
                return result;
            }

            // Lấy OTP đang hoạt động
            var otp = await _db.PasswordResetOtps
                .SingleOrDefaultAsync(x => x.UserId == user.UserId
                                        && x.Purpose == "reset"
                                        && x.ConsumedAtUtc == null);

            if (otp == null)
            {
                result.ErrorCode = "invalid_or_expired";
                return result;
            }

            // Hết Attempts?
            if (otp.Attempts >= _opt.MaxAttempts)
            {
                result.ErrorCode = "too_many_attempts";
                return result;
            }

            // Hết hạn?
            if (nowUtc > otp.ExpiresAtUtc)
            {
                result.ErrorCode = "invalid_or_expired";
                return result;
            }

            // So khớp mã
            var ok = BCrypt.Net.BCrypt.Verify(code.Trim(), otp.CodeHash);
            if (!ok)
            {
                otp.Attempts += 1;
                _db.PasswordResetOtps.Update(otp);
                await _db.SaveChangesAsync();

                result.ErrorCode = otp.Attempts >= _opt.MaxAttempts ? "too_many_attempts" : "invalid_or_expired";
                return result;
            }

            // Đúng mã → (chưa consume ở bước 4),
            var token = _resetTokenStore.Issue(user.UserId, otp.OtpId, TimeSpan.FromMinutes(_opt.ResetTokenTtlMinutes));
            result.Success = true;
            result.ResetToken = token;
            _logger.LogInformation("OTP verified for {Email}. Issued reset token (ttl {Min}m).",
                normEmail, _opt.ResetTokenTtlMinutes);
            return result;

        }

    }
}
