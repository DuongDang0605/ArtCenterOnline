// Services/Reports/IReportsService.cs
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Model.DTO.Reports;

namespace ArtCenterOnline.Server.Services.Reports
{
    // DTO danh sách học viên mới (map từ StudentInfo)
    public class NewStudentItemDto
    {
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public System.DateOnly StartDate { get; set; }  // StudentInfo.ngayBatDauHoc
        public string? Phone { get; set; }  // StudentInfo.PhoneNumber
    }

    // DTO danh sách lớp mở mới (Class đã bỏ MainTeacher)
    public class NewClassItemDto
    {
        public int ClassID { get; set; }
        public string ClassName { get; set; } = "";
        public System.DateTime DayStart { get; set; }   // ClassInfo.DayStart (đã null-check khi map)
        public string? Branch { get; set; }
        public int Status { get; set; }
    }

    public interface IReportsService
    {
        /// Tổng quan báo cáo theo tháng.
        Task<MonthlyOverviewDto> GetMonthlyOverviewAsync(System.DateOnly month, CancellationToken ct = default);

        /// Bảng tỉ lệ điểm danh theo học sinh trong tháng (lọc theo classId nếu cần).
        Task<List<StudentAttendanceRateDto>> GetStudentAttendanceRatesAsync(
            System.DateOnly month, int? classId = null, CancellationToken ct = default);

        /// Danh sách học viên đăng ký mới có ngayBatDauHoc ∈ [from, to).
        Task<List<NewStudentItemDto>> GetNewStudentsInRangeAsync(
            System.DateOnly from, System.DateOnly to, CancellationToken ct = default);

        /// Danh sách lớp mở mới có DayStart ∈ [from, to).
        Task<List<NewClassItemDto>> GetClassesCreatedInRangeAsync(
            System.DateOnly from, System.DateOnly to, CancellationToken ct = default);
    }
}
