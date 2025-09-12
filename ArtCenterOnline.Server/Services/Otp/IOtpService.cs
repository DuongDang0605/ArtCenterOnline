using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Services
{
    public interface IOtpService
    {
        Task CreateAndSendOtpAsync(string email, string? clientIp, string? userAgent);

        // NEW
        Task<OtpVerifyResult> VerifyOtpAsync(string email, string code);
    }
}
