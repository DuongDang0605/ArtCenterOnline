using System;

namespace ArtCenterOnline.Server.Model
{
    public class Attendance
    {
        public int AttendanceId { get; set; }
        public int SessionId { get; set; }
        public int StudentId { get; set; }
        public bool IsPresent { get; set; } = false; // Absent mặc định
        public string? Note { get; set; }
        public DateTime TakenAtUtc { get; set; }
        public int TakenByUserId { get; set; }

        // (tùy chọn) Nav
        public ClassSession? Session { get; set; }
        public StudentInfo? Student { get; set; }
    }
}
