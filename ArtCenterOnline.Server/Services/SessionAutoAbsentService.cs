// Services/SessionAutoAbsentService.cs
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;

namespace ArtCenterOnline.Server.Services
{
    public sealed class AutoAbsentOptions
    {
        /// <summary>Chu kỳ quét (phút). Mặc định 10 phút.</summary>
        public int ScanIntervalMinutes { get; set; } = 10;

        /// <summary>
        /// Giới hạn quét các buổi kết thúc trong khoảng bao nhiêu ngày quá khứ.
        /// Tránh quét toàn bộ lịch sử. Mặc định 14 ngày.
        /// </summary>
        public int LookbackDays { get; set; } = 14;

        /// <summary>
        /// Có tự động chấm vắng cho buổi Cancelled không? Mặc định: false (bỏ qua).
        /// </summary>
        public bool IncludeCancelled { get; set; } = false;
    }

    /// <summary>
    /// Hosted Service: định kỳ quét ClassSessions đã quá hạn cửa sổ điểm danh
    /// (EndTime + GraceAfter) và chèn attendance = Absent cho mọi học sinh active
    /// chưa có bản ghi. Sau khi có bất kỳ attendance nào (đã có hoặc vừa chèn),
    /// sẽ cập nhật Session.Status = Completed (1).
    /// </summary>
    public sealed class SessionAutoAbsentService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly AttendancePolicyOptions _policy;
        private readonly AutoAbsentOptions _opt;
        private readonly ILogger<SessionAutoAbsentService> _log;

        public SessionAutoAbsentService(
            IServiceScopeFactory scopeFactory,
            IOptions<AttendancePolicyOptions> policy,
            IOptions<AutoAbsentOptions> opt,
            ILogger<SessionAutoAbsentService> log)
        {
            _scopeFactory = scopeFactory;
            _policy = policy.Value;
            _opt = opt.Value;
            _log = log;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _log.LogInformation("SessionAutoAbsentService started. Interval={Interval}m, Lookback={Days}d",
                _opt.ScanIntervalMinutes, _opt.LookbackDays);

            while (!stoppingToken.IsCancellationRequested)
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    await SweepOnceAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _log.LogError(ex, "Auto-absent sweep failed.");
                }
                finally
                {
                    sw.Stop();
                    _log.LogDebug("Auto-absent sweep finished in {Elapsed} ms", sw.ElapsedMilliseconds);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(Math.Max(1, _opt.ScanIntervalMinutes)), stoppingToken);
                }
                catch (TaskCanceledException) { }
            }

            _log.LogInformation("SessionAutoAbsentService stopped.");
        }

        private DateTime NowLocal()
        {
            var tz = TimeZoneInfo.FindSystemTimeZoneById(_policy.TimeZoneId);
            return TimeZoneInfo.ConvertTime(DateTime.UtcNow, tz);
        }

        private async Task SweepOnceAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var nowLocal = NowLocal();
            var lookbackFromLocal = nowLocal.AddDays(-Math.Abs(_opt.LookbackDays));
            var endDeadlineLocal = nowLocal - _policy.GraceAfter;

            // Lấy các session ứng viên
            var sessions = await db.ClassSessions
                .AsNoTracking()
                .Include(s => s.Class)
                .Where(s =>
                    s.SessionDate >= DateOnly.FromDateTime(lookbackFromLocal) &&
                    s.SessionDate <= DateOnly.FromDateTime(nowLocal) &&
                    (!_opt.IncludeCancelled ? s.Status != SessionStatus.Cancelled : true))
                .Select(s => new
                {
                    s.SessionId,
                    s.ClassID,
                    s.SessionDate,
                    s.StartTime,
                    s.EndTime
                })
                .ToListAsync(ct);

            if (sessions.Count == 0) return;

            int totalSessionsProcessed = 0;
            int totalInserted = 0;

            foreach (var s in sessions)
            {
                // Tính endLocal của session
                var endLocal = s.SessionDate.ToDateTime(TimeOnly.FromTimeSpan(s.EndTime));
                if (endLocal >= endDeadlineLocal)
                    continue; // chưa quá hạn GraceAfter -> bỏ qua

                // Roster HS active
                var roster = await db.ClassStudents
                    .Where(cs => cs.ClassID == s.ClassID && cs.IsActive)
                    .Select(cs => cs.StudentId)
                    .ToListAsync(ct);

                if (roster.Count == 0)
                {
                    totalSessionsProcessed++;
                    continue; // không có HS để chấm
                }

                // HS đã có attendance
                var existed = await db.Attendances
                    .AsNoTracking()
                    .Where(a => a.SessionId == s.SessionId)
                    .Select(a => a.StudentId)
                    .ToListAsync(ct);

                var existedSet = new HashSet<int>(existed);
                var todo = roster.Where(stuId => !existedSet.Contains(stuId)).ToList();

                // Chèn bản ghi absent cho những HS còn thiếu
                if (todo.Count > 0)
                {
                    var nowUtc = DateTime.UtcNow;
                    foreach (var stuId in todo)
                    {
                        db.Attendances.Add(new Attendance
                        {
                            SessionId = s.SessionId,
                            StudentId = stuId,
                            IsPresent = false,         // Absent
                            Note = "Auto absent (session expired)",
                            TakenAtUtc = nowUtc,
                            TakenByUserId = 0          // hệ thống
                        });
                    }
                    totalInserted += todo.Count;

                    // Commit phần attendance trước
                    await db.SaveChangesAsync(ct);
                }

                // ❗YÊU CẦU MỚI: Hễ có attendance (đã có hoặc vừa chèn) -> Completed
                if (existed.Count > 0 || todo.Count > 0)
                {
                    var sess = await db.ClassSessions.FirstOrDefaultAsync(x => x.SessionId == s.SessionId, ct);
                    if (sess != null && sess.Status != SessionStatus.Completed)
                    {
                        sess.Status = SessionStatus.Completed;
                        await db.SaveChangesAsync(ct);
                    }
                }

                totalSessionsProcessed++;
            }

            if (totalSessionsProcessed > 0)
            {
                _log.LogInformation("Auto-absent sweep: processed {Sessions} sessions, inserted {Rows} attendance rows.",
                    totalSessionsProcessed, totalInserted);
            }
        }
    }
}
