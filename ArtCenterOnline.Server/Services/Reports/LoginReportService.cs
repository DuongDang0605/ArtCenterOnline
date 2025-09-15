using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model.DTO.Reports;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public class LoginReportService : ILoginReportService
    {
        private readonly AppDbContext _db;
        public LoginReportService(AppDbContext db) => _db = db;

        public async Task<List<LoginDailyDto>> GetDailyAsync(DateOnly from, DateOnly to)
        {
            if (to < from) (from, to) = (to, from);

            var raw = await _db.AuthLoginLogs
                .Where(x => x.DateLocal >= from && x.DateLocal <= to)
                .GroupBy(x => new { x.DateLocal, x.Role })
                .Select(g => new { g.Key.DateLocal, Role = g.Key.Role, Cnt = g.Count() })
                .ToListAsync();

            // Map theo ngày
            var byDate = raw
                .GroupBy(x => x.DateLocal)
                .ToDictionary(
                    g => g.Key,
                    g => new {
                        Teacher = g.Where(i => i.Role == "Teacher").Sum(i => i.Cnt),
                        Student = g.Where(i => i.Role == "Student").Sum(i => i.Cnt)
                    });

            var list = new List<LoginDailyDto>();
            for (var d = from; d <= to; d = d.AddDays(1))
            {
                var v = byDate.ContainsKey(d) ? byDate[d] : new { Teacher = 0, Student = 0 };
                list.Add(new LoginDailyDto
                {
                    Date = d.ToDateTime(TimeOnly.MinValue).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    TeacherLogins = v.Teacher,
                    StudentLogins = v.Student,
                    Total = v.Teacher + v.Student
                });
            }
            return list;
        }

        public async Task<List<LoginMonthlyDto>> GetMonthlyAsync(int fromYear, int fromMonth, int toYear, int toMonth)
        {
            var from = new DateOnly(fromYear, fromMonth, 1);
            var to = new DateOnly(toYear, toMonth, 1);
            if (to < from) (from, to) = (to, from);

            var raw = await _db.AuthLoginLogs
                .Where(x => x.DateLocal >= new DateOnly(from.Year, from.Month, 1)
                         && x.DateLocal <= new DateOnly(to.Year, to.Month, DateTime.DaysInMonth(to.Year, to.Month)))
                .GroupBy(x => new { x.DateLocal.Year, x.DateLocal.Month, x.Role })
                .Select(g => new { g.Key.Year, g.Key.Month, Role = g.Key.Role, Cnt = g.Count() })
                .ToListAsync();

            // Map theo Year-Month
            var byMonth = raw
                .GroupBy(x => new { x.Year, x.Month })
                .ToDictionary(
                    g => (g.Key.Year, g.Key.Month),
                    g => new {
                        Teacher = g.Where(i => i.Role == "Teacher").Sum(i => i.Cnt),
                        Student = g.Where(i => i.Role == "Student").Sum(i => i.Cnt)
                    });

            var list = new List<LoginMonthlyDto>();
            for (var y = from.Year; y <= to.Year; y++)
            {
                var mStart = (y == from.Year) ? from.Month : 1;
                var mEnd = (y == to.Year) ? to.Month : 12;

                for (var m = mStart; m <= mEnd; m++)
                {
                    var key = (y, m);
                    var v = byMonth.ContainsKey(key) ? byMonth[key] : new { Teacher = 0, Student = 0 };
                    list.Add(new LoginMonthlyDto
                    {
                        YearMonth = $"{y:D4}-{m:D2}",
                        TeacherLogins = v.Teacher,
                        StudentLogins = v.Student,
                        Total = v.Teacher + v.Student
                    });
                }
            }
            return list;
        }

        public async Task<List<LoginUserDetailDto>> GetByUserAsync(DateOnly from, DateOnly to, string? role, string? keyword)
        {
            if (to < from) (from, to) = (to, from);
            role = NormalizeRole(role); // chỉ nhận "Teacher"/"Student" hoặc null

            var q = _db.AuthLoginLogs.AsQueryable()
                .Where(x => x.DateLocal >= from && x.DateLocal <= to);

            if (!string.IsNullOrWhiteSpace(role))
                q = q.Where(x => x.Role == role);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                keyword = keyword.Trim().ToLower();
                q = q.Where(x => x.Email.ToLower().Contains(keyword));
            }

            var aggregated = await q
                .GroupBy(x => new { x.UserId, x.Email, x.Role })
                .Select(g => new { g.Key.UserId, g.Key.Email, g.Key.Role, LoginCount = g.Count() })
                .OrderByDescending(x => x.LoginCount)
                .ToListAsync();

            // Lấy FullName từ bảng Users
            var userIds = aggregated.Select(x => x.UserId).Distinct().ToList();
            var names = await _db.Users
                .Where(u => userIds.Contains(u.UserId))
                .Select(u => new { u.UserId, u.FullName })
                .ToListAsync();
            var nameMap = names.ToDictionary(x => x.UserId, x => x.FullName ?? "");

            return aggregated.Select(x => new LoginUserDetailDto
            {
                UserId = x.UserId,
                Email = x.Email,
                Role = x.Role,
                FullName = nameMap.TryGetValue(x.UserId, out var fn) ? fn : "",
                LoginCount = x.LoginCount
            }).ToList();
        }

        private static string? NormalizeRole(string? r)
        {
            if (string.IsNullOrWhiteSpace(r)) return null;
            r = r.Trim();
            if (r.Equals("Teacher", StringComparison.OrdinalIgnoreCase)) return "Teacher";
            if (r.Equals("Student", StringComparison.OrdinalIgnoreCase)) return "Student";
            return null; // các role khác bỏ qua trong báo cáo này
        }
    }
}
