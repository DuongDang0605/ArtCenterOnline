namespace ArtCenterOnline.Server.Model.Entities
{
    public class AuthLoginLog
    {
        public long Id { get; set; }
        public DateTime OccurredAtUtc { get; set; }
        public DateOnly DateLocal { get; set; }
        public int UserId { get; set; }
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";         // chốt role chính tại thời điểm login
        public string? ClientId { get; set; }
        public string? UserAgent { get; set; }
        public string? Ip { get; set; }
    }
}
