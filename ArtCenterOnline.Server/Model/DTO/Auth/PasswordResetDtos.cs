using System.ComponentModel.DataAnnotations;

namespace ArtCenterOnline.Server.Model.DTO.Auth
{
    public class ForgotPasswordReq
    {
        [Required, EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;
    }

    public class VerifyOtpReq
    {
        [Required, EmailAddress, MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        // Tạm thời cho phép 4–6 ký tự để linh hoạt khi test
        [Required, MinLength(4), MaxLength(6)]
        public string Code { get; set; } = string.Empty;
    }

    public class ResetPasswordReq
    {
        [Required, MinLength(10), MaxLength(512)]
        public string ResetToken { get; set; } = string.Empty;

        [Required, MinLength(6), MaxLength(100)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
