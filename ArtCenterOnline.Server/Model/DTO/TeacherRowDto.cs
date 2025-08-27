// Models/DTO/TeacherRowDto.cs
namespace ArtCenterOnline.Server.Model.DTO
{
    public record TeacherRowDto(
        int TeacherId,
        int UserId,
        string TeacherName,
        string PhoneNumber,
        int SoBuoiDayTrongThang,
        int status,
        string UserEmail
    );
}
