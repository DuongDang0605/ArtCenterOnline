// Controllers/ReportsController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO.Reports;
using ArtCenterOnline.Server.Services;
using ArtCenterOnline.Server.Services.Reports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore; // cho GetDbConnection(), CountAsync, v.v.
using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

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

        [HttpGet("logins/daily")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetLoginDaily(
    [FromQuery] string? from,
    [FromQuery] string? to,
    [FromServices] ILoginReportService svc)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            var fromD = ParseDateOnly(from) ?? today.AddDays(-29);
            var toD = ParseDateOnly(to) ?? today;

            var data = await svc.GetDailyAsync(fromD, toD);
            return Ok(data);

            static DateOnly? ParseDateOnly(string? s)
                => DateOnly.TryParseExact(s ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
        }

        [HttpGet("logins/monthly")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetLoginMonthly(
            [FromQuery] string? from, // yyyy-MM
            [FromQuery] string? to,   // yyyy-MM
            [FromServices] ILoginReportService svc)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

            DateOnly fromYM;
            DateOnly toYM;

            if (!TryParseYearMonth(from, out var fy, out var fm))
            {
                var t = today.AddMonths(-5);
                fromYM = new DateOnly(t.Year, t.Month, 1);
            }
            else
            {
                fromYM = new DateOnly(fy, fm, 1);
            }

            if (!TryParseYearMonth(to, out var ty, out var tm))
            {
                toYM = new DateOnly(today.Year, today.Month, 1);
            }
            else
            {
                toYM = new DateOnly(ty, tm, 1);
            }

            var data = await svc.GetMonthlyAsync(fromYM.Year, fromYM.Month, toYM.Year, toYM.Month);
            return Ok(data);

            static DateOnly? ParseYM(string? s)
            {
                if (string.IsNullOrWhiteSpace(s)) return null;
                if (DateTime.TryParseExact(s, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                    return new DateOnly(dt.Year, dt.Month, 1);
                return null;
            }
        }
        static bool TryParseYearMonth(string? s, out int year, out int month)
        {
            year = 0; month = 0;
            if (string.IsNullOrWhiteSpace(s)) return false;
            if (DateTime.TryParseExact(s, "yyyy-MM", System.Globalization.CultureInfo.InvariantCulture,
                                       System.Globalization.DateTimeStyles.None, out var dt))
            {
                year = dt.Year; month = dt.Month;
                return true;
            }
            return false;
        }


        [HttpGet("logins/by-user")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetLoginByUser(
            [FromQuery] string? from,
            [FromQuery] string? to,
            [FromQuery] string? role,       // Teacher | Student | (null = all)
            [FromQuery] string? keyword,    // tìm theo email (contains)
            [FromServices] ILoginReportService svc)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            var fromD = ParseDateOnly(from) ?? today.AddDays(-29);
            var toD = ParseDateOnly(to) ?? today;

            var data = await svc.GetByUserAsync(fromD, toD, role, keyword);
            return Ok(data);

            static DateOnly? ParseDateOnly(string? s)
                => DateOnly.TryParseExact(s ?? "", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : null;
        }

        [HttpGet("logins/events")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetLoginEvents(
    [FromQuery] string? from,   // yyyy-MM-dd
    [FromQuery] string? to,     // yyyy-MM-dd
    [FromServices] AppDbContext db)
        {
            // mặc định: tháng hiện tại (tính đến hôm nay)
            var todayLocal = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            var fromD = ParseDateOnly(from) ?? new DateOnly(todayLocal.Year, todayLocal.Month, 1);
            var toD = ParseDateOnly(to) ?? todayLocal;

            // join Users, Teachers, Students để lấy đủ tên
            var tz = TimeSpan.FromHours(7);
            var query =
                from l in db.AuthLoginLogs
                join u in db.Users on l.UserId equals u.UserId into gu
                from u in gu.DefaultIfEmpty()
                join t in db.Teachers on l.UserId equals t.UserId into gt
                from t in gt.DefaultIfEmpty()
                join s in db.Students on l.UserId equals s.UserId into gs
                from s in gs.DefaultIfEmpty()
                where l.DateLocal >= fromD && l.DateLocal <= toD
                orderby l.OccurredAtUtc descending
                select new
                {
                    l.UserId,
                    fullName = u != null ? (u.FullName ?? "") : "",
                    teacherName = t != null ? (t.TeacherName ?? "") : null,
                    studentName = s != null ? (s.StudentName ?? "") : null,
                    l.Email,
                    l.Role,
                    l.Ip,
                    occurredAtUtc = l.OccurredAtUtc,
                    occurredAtLocal = l.OccurredAtUtc + tz,
                    dateLocal = l.DateLocal
                };

            // giới hạn để tránh trả quá nhiều
            var items = await query.Take(2000).ToListAsync();
            return Ok(items);

            static DateOnly? ParseDateOnly(string? s)
                => DateOnly.TryParse(s, out var d) ? d : null;
        }

    }
}
