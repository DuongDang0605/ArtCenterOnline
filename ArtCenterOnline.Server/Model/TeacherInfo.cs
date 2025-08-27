using System;

namespace ArtCenterOnline.Server.Model
{
    public class TeacherInfo
    {
        public int TeacherId { get; set; }

        public int UserId { get; set; }
        public string TeacherName { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public int SoBuoiDayTrongThang { get; set; } = 0;
        public int status { get; set; } = 0;

        // NEW: navigation sang User để Include
        public User? User { get; set; }

    }
}
