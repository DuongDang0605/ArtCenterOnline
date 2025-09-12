using System;

namespace ArtCenterOnline.Server.Model
{
    public class PasswordResetOtp
    {
        public Guid OtpId { get; set; }            // PK
        public int UserId { get; set; }            // FK -> Users.UserId

        public string CodeHash { get; set; } = string.Empty; // BCrypt hash (~60)
        public string Purpose { get; set; } = "reset";        // ví dụ: "reset"

        public DateTime ExpiresAtUtc { get; set; }            // UTC
        public DateTime? ConsumedAtUtc { get; set; }          // UTC, null nếu chưa dùng

        public int Attempts { get; set; } = 0;     // số lần nhập sai
        public int SendCount { get; set; } = 1;    // số lần gửi trong ngày
        public DateTime LastSentAtUtc { get; set; } = DateTime.UtcNow; // thời điểm gửi

        public string? ClientIp { get; set; }      // tối đa 45 ký tự (IPv6)
        public string? UserAgent { get; set; }     // tối đa 200 ký tự

        // Nav
        public User User { get; set; } = default!;
    }
}
