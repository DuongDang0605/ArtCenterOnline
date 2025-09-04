// Program.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Services;
using ArtCenterOnline.Server.Services.Reports;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Reflection.Emit;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ========== Services ==========
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// EF Core
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Domain services you already use in controllers
builder.Services.AddScoped<ClassSessionMonthlySyncService>();
builder.Services.Configure<AttendancePolicyOptions>(builder.Configuration.GetSection("AttendancePolicy"));
builder.Services.AddScoped<IAttendanceGuard, AttendanceGuard>();
builder.Services.AddScoped<ISessionAccountingService, SessionAccountingService>();
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});
// JWT
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new()
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", p => p.RequireRole("Admin"));
    options.AddPolicy("TeacherOnly", p => p.RequireRole("Teacher"));
});
builder.Services.AddScoped<ArtCenterOnline.Server.Services.Reports.IReportsService,
                           ArtCenterOnline.Server.Services.Reports.ReportsService>();

builder.Services.AddScoped<
    ArtCenterOnline.Server.Services.Reports.IAttendanceExportService,
    ArtCenterOnline.Server.Services.Reports.AttendanceExportService>();

builder.Services.AddScoped<ArtCenterOnline.Server.Services.ITeacherScheduleValidator,
                           ArtCenterOnline.Server.Services.TeacherScheduleValidator>();

builder.Services.AddScoped<IStudentScheduleValidator, StudentScheduleValidator>();

// CORS cho Vite (http://localhost:5173)
const string AllowClient = "_allowClient";
builder.Services.AddCors(options =>
{
    options.AddPolicy(AllowClient, p =>
        p.WithOrigins("http://localhost:5173", "https://localhost:5173")
         .AllowAnyHeader()
         .AllowAnyMethod());
});
builder.Services.Configure<AutoAbsentOptions>(
    builder.Configuration.GetSection("AutoAbsent")); // tuỳ chọn, có thể không cần section -> dùng default

builder.Services.AddHostedService<SessionAutoAbsentService>();

builder.Services.AddScoped<ArtCenterOnline.Server.Services.IStudentLifecycleService,
                           ArtCenterOnline.Server.Services.StudentLifecycleService>();


// ========== App pipeline ==========
var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseCors(AllowClient);
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// SPA fallback (React)
app.MapFallbackToFile("/index.html");

app.Run();
