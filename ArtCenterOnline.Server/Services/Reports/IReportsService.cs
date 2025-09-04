// Services/Reports/IReportsService.cs
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Model.DTO.Reports;

namespace ArtCenterOnline.Server.Services.Reports
{
    public interface IReportsService
    {
        /// <summary>
        /// Tổng quan báo cáo theo tháng (yyyy-MM hoặc yyyy-MM-01).
        /// </summary>
        Task<MonthlyOverviewDto> GetMonthlyOverviewAsync(DateOnly month, CancellationToken ct = default);

        /// <summary>
        /// Bảng tỉ lệ điểm danh theo học sinh trong tháng.
        /// Có thể lọc theo classId (null: toàn hệ thống).
        /// </summary>
        Task<List<StudentAttendanceRateDto>> GetStudentAttendanceRatesAsync(
            DateOnly month, int? classId = null, CancellationToken ct = default);
    }
}
