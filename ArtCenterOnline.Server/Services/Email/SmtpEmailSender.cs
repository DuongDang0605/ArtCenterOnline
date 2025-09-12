using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security;

namespace ArtCenterOnline.Server.Services
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly SmtpOptions _opt;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IOptions<SmtpOptions> opt, ILogger<SmtpEmailSender> logger)
        {
            _opt = opt.Value;
            _logger = logger;
        }

        public async Task SendAsync(string toEmail, string subject, string plainBody)
        {
            if (!_opt.Enabled)
            {
                _logger.LogWarning("SMTP disabled; skipping send to {To}", toEmail);
                return;
            }

            var msg = new MimeMessage();
            msg.From.Add(new MailboxAddress(_opt.FromName ?? "ArtCenterOnline", _opt.From));
            msg.To.Add(MailboxAddress.Parse(toEmail));
            msg.Subject = subject;
            msg.Body = new TextPart("plain") { Text = plainBody };

            using var client = new SmtpClient();
            var socket = _opt.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;

            await client.ConnectAsync(_opt.Host, _opt.Port, socket);
            if (!string.IsNullOrWhiteSpace(_opt.User))
                await client.AuthenticateAsync(_opt.User, _opt.Pass);

            await client.SendAsync(msg);
            await client.DisconnectAsync(true);

            _logger.LogInformation("SMTP sent to {To} via {Host}:{Port}", toEmail, _opt.Host, _opt.Port);
        }
    }
}
