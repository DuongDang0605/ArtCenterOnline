namespace ArtCenterOnline.Server.Services
{
    public class OtpVerifyResult
    {
        public bool Success { get; set; }
        public string? ResetToken { get; set; } // tạm thời là token giả
        public string? ErrorCode { get; set; }  // "invalid_or_expired" | "too_many_attempts"
    }
}
