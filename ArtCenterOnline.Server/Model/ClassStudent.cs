// Models/ClassStudent.cs (bảng nối)
using ArtCenterOnline.Server.Model;

namespace ArtCenterOnline.Server.Model
{
    public class ClassStudent
    {
        public int ClassID { get; set; }
        public ClassInfo? Class { get; set; }

        public int StudentId { get; set; }
        public StudentInfo? Student { get; set; }

        // Trường bổ sung tuỳ nhu cầu
        public DateOnly JoinedDate { get; set; } = DateOnly.FromDateTime(DateTime.Now);
        public bool IsActive { get; set; } = true;
        public string? Note { get; set; }

        public int RemainingSessions { get; set; } = 0;

    }
}
