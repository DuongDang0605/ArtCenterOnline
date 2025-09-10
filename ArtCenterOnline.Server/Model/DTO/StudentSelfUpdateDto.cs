namespace ArtCenterOnline.Server.Model.DTO
{
    public class StudentSelfUpdateDto
    {
        public string? StudentName { get; set; }
        public string? ParentName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Adress { get; set; } // giữ đúng tên cột hiện có
    }
}
