using System;

namespace ArtCenterOnline.Server.Model
{
    public class ClassSchedule
    {
        public int ScheduleId { get; set; }   // Khóa chính

        public int ClassID { get; set; }      // Khóa ngoại -> ClassInfo
        public ClassInfo? Class { get; set; }
        public DayOfWeek DayOfWeek { get; set; }  // Thứ trong tuần (Enum sẵn của .NET: Sunday=0, Monday=1,...)

        public TimeSpan StartTime { get; set; }   // Giờ bắt đầu (VD: 18:00)
        public TimeSpan EndTime { get; set; }     // Giờ kết thúc (VD: 20:00)

        public bool IsActive { get; set; } = true; // Có còn áp dụng không
        public string? Note { get; set; }          // Ghi chú (VD: học online, phòng A101)


        public int? TeacherId { get; set; }          // NEW: giáo viên phụ trách lịch này
        public TeacherInfo? Teacher { get; set; }    // NEW: navigation

    }
}
