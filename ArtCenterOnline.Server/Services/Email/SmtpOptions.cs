namespace ArtCenterOnline.Server.Services
{
    public class SmtpOptions
    {
        public bool Enabled { get; set; } = false;
        public string Host { get; set; } = "smtp.gmail.com";
        public int Port { get; set; } = 587;
        public string User { get; set; } = "";
        public string Pass { get; set; } = "";
        public bool UseStartTls { get; set; } = true;
        public string From { get; set; } = "";
        public string FromName { get; set; } = "ArtCenterOnline";
    }
}
