using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Services
{
    public interface IEmailSender
    {
        Task SendAsync(string toEmail, string subject, string plainBody);
    }
}
