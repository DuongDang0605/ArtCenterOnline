using System;
namespace ArtCenterOnline.Server.Model
{
    public class StudentInfo
    {
        public int StudentId { get; set; }
        public String StudentName { get; set; } = string.Empty;
        public String ParentName { get; set; } = string.Empty;   
        public String PhoneNumber { get; set; } = string.Empty;
        public String Adress { get; set; } = string.Empty;
        public DateOnly ngayBatDauHoc { get; set; } = DateOnly.FromDateTime(DateTime.Now);
        public int SoBuoiHocConLai { get; set; } = 0;
        public int SoBuoiHocDaHoc { get; set; } = 0;
        public int Status { get; set; } = 0;
        public ICollection<ClassStudent> ClassStudents { get; set; } = new List<ClassStudent>();

    }
}
