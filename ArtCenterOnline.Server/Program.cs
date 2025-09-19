// Program.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Services;
using ArtCenterOnline.Server.Services.Reports;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ===== CORS =====
const string AllowClient = "_allowClient";
builder.Services.AddCors(options =>
{
    options.AddPolicy(AllowClient, p => p
        .WithOrigins(
            "http://localhost:5173", "https://localhost:5173",
            "http://127.0.0.1:5173", "https://127.0.0.1:5173",
            "https://<YOUR_SWA>.azurestaticapps.net" // thay sau khi có domain SWA
        )
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// ===== EF Core / SQL Server (Azure) =====
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sql => sql.EnableRetryOnFailure(5, TimeSpan.FromSeconds(10), null)
    )
);

// ===== MVC / Swagger =====
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ===== Domain services / Options =====
builder.Services.AddScoped<ClassSessionMonthlySyncService>();
builder.Services.Configure<AttendancePolicyOptions>(builder.Configuration.GetSection("AttendancePolicy"));
builder.Services.AddScoped<IAttendanceGuard, AttendanceGuard>();
builder.Services.AddScoped<ISessionAccountingService, SessionAccountingService>();

// Program.cs
builder.Services.AddScoped<ArtCenterOnline.Server.Services.Reports.IReportsService,
                           ArtCenterOnline.Server.Services.Reports.ReportsService>();



builder.Services.AddScoped<ArtCenterOnline.Server.Services.Reports.IAttendanceExportService,
                           ArtCenterOnline.Server.Services.Reports.AttendanceExportService>();
builder.Services.AddScoped<ArtCenterOnline.Server.Services.ITeacherScheduleValidator,
                           ArtCenterOnline.Server.Services.TeacherScheduleValidator>();
builder.Services.AddScoped<IStudentScheduleValidator, StudentScheduleValidator>();

builder.Services.Configure<AutoAbsentOptions>(builder.Configuration.GetSection("AutoAbsent"));
builder.Services.AddHostedService<SessionAutoAbsentService>();
builder.Services.AddScoped<ArtCenterOnline.Server.Services.IStudentLifecycleService,
                           ArtCenterOnline.Server.Services.StudentLifecycleService>();

builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.Configure<OtpOptions>(builder.Configuration.GetSection("Otp"));

var smtpEnabled = builder.Configuration.GetValue<bool>("Smtp:Enabled");
if (smtpEnabled)
    builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
else
    builder.Services.AddSingleton<IEmailSender, NoopEmailSender>();

builder.Services.AddSingleton<IResetTokenStore, InMemoryResetTokenStore>();
builder.Services.AddScoped<IOtpService, OtpService>();

// ===== AuthN / AuthZ (JWT) =====
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();

// Login tracking
builder.Services.Configure<WebTrafficOptions>(builder.Configuration.GetSection("WebTraffic"));
builder.Services.AddScoped<ILoginReportService, LoginReportService>();

var keyBytes = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "DEV_DUMMY_KEY_CHANGE_ME");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    options.AddPolicy("TeacherOnly", p => p.RequireRole("Teacher"));
});

// ===== Build app (sau khi Add... xong) =====
var app = builder.Build();

// ===== Pipeline =====
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseCors(AllowClient);

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<RequestTrackingMiddleware>();

app.MapControllers();
app.MapFallbackToFile("/index.html");

// ===== Endpoint chẩn đoán DB =====
app.MapGet("/db-ping", async (IConfiguration cfg) =>
{
    var cs = cfg.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(cs)) return Results.Problem("Missing ConnectionStrings:DefaultConnection");
    try
    {
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("SELECT SUSER_SNAME() AS [login], DB_NAME() AS [db]", conn);
        await using var r = await cmd.ExecuteReaderAsync();
        await r.ReadAsync();
        return Results.Ok(new { login = r.GetString(0), db = r.GetString(1) });
    }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});

app.MapGet("/db-ping/ef", async (AppDbContext db) =>
{
    try
    {
        var can = await db.Database.CanConnectAsync();
        var dbName = db.Database.GetDbConnection().Database;
        return Results.Ok(new { can, db = dbName });
    }
    catch (Exception ex) { return Results.Problem(ex.Message); }
});
if (app.Configuration.GetValue<bool>("ApplyMigrations"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}
app.Run();
