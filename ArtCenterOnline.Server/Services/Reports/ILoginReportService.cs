using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Model.DTO.Reports;

namespace ArtCenterOnline.Server.Services
{
    public interface ILoginReportService
    {
        Task<List<LoginDailyDto>> GetDailyAsync(DateOnly from, DateOnly to);
        Task<List<LoginMonthlyDto>> GetMonthlyAsync(int fromYear, int fromMonth, int toYear, int toMonth);
        Task<List<LoginUserDetailDto>> GetByUserAsync(DateOnly from, DateOnly to, string? role, string? keyword);
    }
}
