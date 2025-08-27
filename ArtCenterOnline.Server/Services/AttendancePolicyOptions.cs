namespace ArtCenterOnline.Server.Services
{
    public sealed class AttendancePolicyOptions
    {
        public enum WindowMode { StrictWindow, SameDayTesting }
        public WindowMode Mode { get; set; } = WindowMode.SameDayTesting;

        public TimeSpan GraceBefore { get; set; } = TimeSpan.FromMinutes(30);
        public TimeSpan GraceAfter { get; set; } = TimeSpan.FromHours(2);
        public string TimeZoneId { get; set; } = "Asia/Bangkok"; // VN timezone
    }
}
