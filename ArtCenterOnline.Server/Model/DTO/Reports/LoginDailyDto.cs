namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class LoginDailyDto
    {
        public string Date { get; set; } = "";     // yyyy-MM-dd
        public int TeacherLogins { get; set; }
        public int StudentLogins { get; set; }
        public int Total { get; set; }
    }
}
