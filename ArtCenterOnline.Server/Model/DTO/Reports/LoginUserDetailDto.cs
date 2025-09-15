namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class LoginUserDetailDto
    {
        public int UserId { get; set; }
        public string Email { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Role { get; set; } = "";       // Teacher/Student
        public int LoginCount { get; set; }
    }
}
