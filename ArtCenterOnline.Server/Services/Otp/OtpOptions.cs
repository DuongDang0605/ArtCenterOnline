namespace ArtCenterOnline.Server.Services
{
    public class OtpOptions
    {
        public int Length { get; set; } = 6;
        public int TtlMinutes { get; set; } = 10;
        public int WorkFactor { get; set; } = 11;

        // NEW
        public int MaxAttempts { get; set; } = 5;

        // (để dành cho bước sau)
        public int CooldownSeconds { get; set; } = 60;
        public int DailySendLimit { get; set; } = 5;
        public int ResetTokenTtlMinutes { get; set; } = 15;
    }
}
