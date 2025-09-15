using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Diagnostics;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ArtCenterOnline.Server.Services
{
    public class RequestTrackingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestTrackingMiddleware> _logger;
        private readonly WebTrafficOptions _options;

        public RequestTrackingMiddleware(
            RequestDelegate next,
            ILogger<RequestTrackingMiddleware> logger,
            IOptions<WebTrafficOptions> options)
        {
            _next = next;
            _logger = logger;
            _options = options.Value;
        }

        public async Task Invoke(HttpContext context)
        {
            if (!_options.Enabled)
            {
                await _next(context);
                return;
            }

            // Bỏ qua theo prefix
            var path = context.Request.Path.HasValue ? context.Request.Path.Value! : "/";
            if (_options.IgnorePathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
            {
                await _next(context);
                return;
            }

            // Sample rate (giảm tải khi cần)
            if (_options.SampleRate < 1.0)
            {
                var rnd = Random.Shared.NextDouble();
                if (rnd > _options.SampleRate)
                {
                    await _next(context);
                    return;
                }
            }

            // Gắn/tạo ClientId cookie
            string clientId = EnsureClientIdCookie(context, _options.CookieName);

            var sw = Stopwatch.StartNew();
            try
            {
                await _next(context);
            }
            finally
            {
                sw.Stop();

                try
                {
                    // Lấy info người dùng (nếu có)
                    int? userId = TryGetUserId(context.User);
                    string? role = context.User?.FindAll(ClaimTypes.Role).FirstOrDefault()?.Value
                                   ?? context.User?.FindFirst("role")?.Value;

                    // Múi giờ Asia/Bangkok (UTC+7) — đơn giản: cộng 7 giờ
                    var localNow = DateTime.UtcNow.AddHours(7);
                    var dateLocal = DateOnly.FromDateTime(localNow);

                    var log = new WebRequestLog
                    {
                        OccurredAtUtc = DateTime.UtcNow,
                        DateLocal = dateLocal,
                        Path = path,
                        Method = context.Request.Method,
                        StatusCode = context.Response?.StatusCode ?? 0,
                        UserId = userId,
                        Role = role,
                        ClientId = clientId,
                        DurationMs = (int)sw.ElapsedMilliseconds,
                        UserAgent = context.Request.Headers.UserAgent.ToString(),
                        Ip = GetClientIp(context)
                    };

                    // Lấy DbContext theo scope request
                    var db = context.RequestServices.GetService(typeof(AppDbContext)) as AppDbContext;
                    if (db != null)
                    {
                        db.WebRequestLogs.Add(log);
                        // Không chặn pipeline nếu lỗi DB — swallow lỗi có log warn
                        await db.SaveChangesAsync();
                    }
                    else
                    {
                        _logger.LogWarning("AppDbContext is not available in RequestTrackingMiddleware.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to write WebRequestLog for path {Path}", path);
                }
            }
        }

        private static string EnsureClientIdCookie(HttpContext ctx, string cookieName)
        {
            if (!ctx.Request.Cookies.TryGetValue(cookieName, out var id) || string.IsNullOrWhiteSpace(id))
            {
                id = Guid.NewGuid().ToString("N");
                ctx.Response.Cookies.Append(cookieName, id, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Lax,
                    Secure = ctx.Request.IsHttps, // true nếu đang chạy HTTPS
                    Expires = DateTimeOffset.UtcNow.AddDays(400)
                });
            }
            return id!;
        }

        private static int? TryGetUserId(ClaimsPrincipal user)
        {
            if (user?.Identity?.IsAuthenticated != true) return null;
            string? raw =
                user.FindFirst("uid")?.Value ??
                user.FindFirst("userId")?.Value ??
                user.FindFirst("UserId")?.Value ??
                user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (int.TryParse(raw, out int uid)) return uid;
            return null;
        }

        private static string? GetClientIp(HttpContext ctx)
        {
            // Ưu tiên X-Forwarded-For (nếu reverse proxy)
            if (ctx.Request.Headers.TryGetValue("X-Forwarded-For", out var v))
                return v.ToString().Split(',').FirstOrDefault()?.Trim();

            return ctx.Connection.RemoteIpAddress?.ToString();
        }
    }
}
