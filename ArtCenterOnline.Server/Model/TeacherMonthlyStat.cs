namespace ArtCenterOnline.Server.Model
{
    public class TeacherMonthlyStat
    {
        public int TeacherMonthlyStatId { get; set; }
        public int TeacherId { get; set; }
        public int Year { get; set; }     // ví dụ 2025
        public int Month { get; set; }    // 1..12
        public int TaughtCount { get; set; } = 0;
    }
}
