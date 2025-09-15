namespace ArtCenterOnline.Server.Model.Entities
{
    public class WebRequestLog
    {
        public long Id { get; set; }
        public DateTime OccurredAtUtc { get; set; }
        public DateOnly DateLocal { get; set; }        // dd/MM/yyyy (local VN)
        public string Path { get; set; } = "";
        public string Method { get; set; } = "GET";
        public int StatusCode { get; set; }
        public int? UserId { get; set; }
        public string? Role { get; set; }              // "Teacher","Student",...
        public string? ClientId { get; set; }          // cookie aco_tid
        public int? DurationMs { get; set; }
        public string? UserAgent { get; set; }
        public string? Ip { get; set; }
    }


}
