using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;

namespace ArtCenterOnline.Server.Services
{
    // Bước 3: chỉ log, chưa gửi thật
    public class NoopEmailSender : IEmailSender
    {
        private readonly ILogger<NoopEmailSender> _logger;
        private readonly IWebHostEnvironment _env;

        public NoopEmailSender(ILogger<NoopEmailSender> logger, IWebHostEnvironment env)
        {
            _logger = logger;
            _env = env;
        }

        public Task SendAsync(string toEmail, string subject, string plainBody)
        {
            // Chỉ log trong dev cho bạn nhìn thấy OTP
            _logger.LogInformation("DEV EMAIL → {To}\nSubject: {Subject}\nBody:\n{Body}",
                toEmail, subject, plainBody);
            return Task.CompletedTask;
        }
    }
}
