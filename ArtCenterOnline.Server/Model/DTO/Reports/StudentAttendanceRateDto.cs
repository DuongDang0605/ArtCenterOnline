// Model/DTO/Reports/StudentAttendanceRateDto.cs
namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public sealed class StudentAttendanceRateDto
    {
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public int TotalSessions { get; set; }      // present + absent (số dòng attendance trong tháng)
        public int PresentSessions { get; set; }    // số lần present trong tháng
        public double RatePct { get; set; }         // Present / Total * 100 (làm tròn 2)
    }
}
