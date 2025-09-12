namespace ArtCenterOnline.Server.Services
{
    public record ResetTokenData(int UserId, Guid OtpId, DateTime ExpiresAtUtc);

    public interface IResetTokenStore
    {
        string Issue(int userId, Guid otpId, TimeSpan ttl);     // sinh token + lưu
        bool TryTake(string token, out ResetTokenData data);     // lấy & xóa (1 lần dùng)
    }
}
