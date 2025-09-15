namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class LoginMonthlyDto
    {
        public string YearMonth { get; set; } = "";  // yyyy-MM
        public int TeacherLogins { get; set; }
        public int StudentLogins { get; set; }
        public int Total { get; set; }
    }
}
