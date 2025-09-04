// Controllers/ReportsController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model.DTO.Reports;
using ArtCenterOnline.Server.Services.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // cho GetDbConnection(), CountAsync, v.v.
using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Model;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin")] // Controller mặc định: chỉ Admin
    public class ReportsController : ControllerBase
    {
        private readonly IReportsService _reports;
        private readonly IAttendanceExportService _attendanceExport;

        public ReportsController(IAttendanceExportService attendanceExport, IReportsService reports)
        {
            _attendanceExport = attendanceExport;
            _reports = reports;
        }

        // GET: /api/Reports/MonthlyOverview?month=2025-08
        [HttpGet("MonthlyOverview")]
        public async Task<ActionResult<MonthlyOverviewDto>> MonthlyOverview([FromQuery] string? month, CancellationToken ct)
        {
            var m = ParseMonth(month);
            var dto = await _reports.GetMonthlyOverviewAsync(m, ct);
            return Ok(dto);
        }

        // NEW: Bảng tỉ lệ điểm danh theo học sinh (tháng), có thể lọc theo class
        // Cho Admin và Teacher cùng xem
        // GET: /api/Reports/student-attendance?month=2025-08&classId=12
        [HttpGet("student-attendance")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<ActionResult<System.Collections.Generic.List<StudentAttendanceRateDto>>> GetStudentAttendance(
            [FromQuery] string? month,
            [FromQuery] int? classId,
            CancellationToken ct)
        {
            var m = ParseMonth(month);
            var data = await _reports.GetStudentAttendanceRatesAsync(m, classId, ct);
            return Ok(data);
        }

        [HttpGet("AttendanceMatrixExport")]
        public async Task<IActionResult> AttendanceMatrixExport([FromQuery] AttendanceExportQuery query, CancellationToken ct)
        {
            if (query.ClassId <= 0) return BadRequest("ClassId is required.");
            if (query.From > query.To) return BadRequest("From must be <= To.");

            var (content, fileName, contentType) = await _attendanceExport.ExportAttendanceMatrixAsync(query, ct);
            return File(content, contentType, fileName);
        }

        /// <summary>
        /// Chấp nhận "yyyy-MM" hoặc "yyyy-MM-dd". Trả về ngày đầu tháng.
        /// </summary>
        private static DateOnly ParseMonth(string? s)
        {
            if (string.IsNullOrWhiteSpace(s))
            {
                var now = DateTime.Now;
                return new DateOnly(now.Year, now.Month, 1);
            }

            if (DateOnly.TryParseExact(s, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var m1))
                return new DateOnly(m1.Year, m1.Month, 1);

            if (DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var m2))
                return new DateOnly(m2.Year, m2.Month, 1);

            // fallback: cho phép chuỗi "yyyy-MM" + auto "-01"
            if (s.Length == 7) s += "-01";
            var d = DateOnly.Parse(s);
            return new DateOnly(d.Year, d.Month, 1);
        }

        // DEBUG: số liệu thô theo tháng
        [HttpGet("debug-month")]
        [AllowAnonymous]
        public async Task<IActionResult> DebugMonth([FromQuery] string? month, [FromServices] AppDbContext db)
        {
            if (string.IsNullOrWhiteSpace(month)) month = DateTime.Today.ToString("yyyy-MM-01");
            if (month.Length == 7) month += "-01";
            var parsed = DateOnly.Parse(month);
            var first = new DateTime(parsed.Year, parsed.Month, 1);
            var nextFirst = first.AddMonths(1);
            var prevFirst = first.AddMonths(-1);

            var doFirst = DateOnly.FromDateTime(first);
            var doNextFirst = DateOnly.FromDateTime(nextFirst);
            var doPrevFirst = DateOnly.FromDateTime(prevFirst);

            var res = new
            {
                SessionsThisMonth = await db.ClassSessions.CountAsync(
                    s => s.SessionDate >= doFirst && s.SessionDate < doNextFirst),
                SessionsCanceled = await db.ClassSessions.CountAsync(
                    s => s.SessionDate >= doFirst && s.SessionDate < doNextFirst
                       && s.Status == SessionStatus.Cancelled),
                Att = await (from a in db.Attendances
                             join s in db.ClassSessions on a.SessionId equals s.SessionId
                             where s.SessionDate >= doFirst && s.SessionDate < doNextFirst
                             select 1).CountAsync(),
                AttPresent = await (from a in db.Attendances
                                    join s in db.ClassSessions on a.SessionId equals s.SessionId
                                    where s.SessionDate >= doFirst && s.SessionDate < doNextFirst && a.IsPresent
                                    select 1).CountAsync(),
                AttPrev = await (from a in db.Attendances
                                 join s in db.ClassSessions on a.SessionId equals s.SessionId
                                 where s.SessionDate >= doPrevFirst && s.SessionDate < doFirst
                                 select 1).CountAsync(),
                AttPresentPrev = await (from a in db.Attendances
                                        join s in db.ClassSessions on a.SessionId equals s.SessionId
                                        where s.SessionDate >= doPrevFirst && s.SessionDate < doFirst && a.IsPresent
                                        select 1).CountAsync()
            };

            return Ok(res);
        }

        [HttpGet("ping-db")]
        [AllowAnonymous]
        public ActionResult<string> PingDb([FromServices] AppDbContext db)
        {
            var conn = db.Database.GetDbConnection();
            return Ok($"{conn.DataSource} | {conn.Database}");
        }
    }
}
