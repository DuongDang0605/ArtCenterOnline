using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;

namespace ArtCenterOnline.Server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Ánh xạ bảng
        public DbSet<ClassInfo> Classes { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<UserRole> UserRoles { get; set; }
        public DbSet<StudentInfo> Students { get; set; }
        public DbSet<TeacherInfo> Teachers { get; set; }
        public DbSet<ClassStudent> ClassStudents { get; set; }

        public DbSet<ClassSchedule> ClassSchedules { get; set; }
        public DbSet<ClassSession> ClassSessions { get; set; }

        public DbSet<Attendance> Attendances => Set<Attendance>();
        public DbSet<TeacherMonthlyStat> TeacherMonthlyStats => Set<TeacherMonthlyStat>();
        public DbSet<PasswordResetOtp> PasswordResetOtps { get; set; } = default!;

        public DbSet<WebRequestLog> WebRequestLogs { get; set; }
        public DbSet<WebTrafficDaily> WebTrafficDailies { get; set; }
        public DbSet<WebTrafficMonthly> WebTrafficMonthlies { get; set; }
        public DbSet<AuthLoginLog> AuthLoginLogs { get; set; }

        // NEW: TuitionPaymentRequests
        public DbSet<TuitionPaymentRequest> TuitionPaymentRequests { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ClassInfo
            modelBuilder.Entity<ClassInfo>(entity =>
            {
                entity.HasKey(e => e.ClassID);
                entity.Property(e => e.ClassName).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Branch).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Status).HasDefaultValue(1);
            });

            // User
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");
                entity.HasKey(e => e.UserId);
                entity.Property(e => e.Email).HasMaxLength(100).IsRequired();
                entity.HasIndex(e => e.Email).IsUnique();
                entity.Property(e => e.PasswordHash).HasMaxLength(200).IsRequired();
                entity.Property(e => e.FullName).HasMaxLength(150);
                entity.Property(e => e.IsActive).HasDefaultValue(true);
            });

            modelBuilder.Entity<Role>(entity =>
            {
                entity.ToTable("Role");
                entity.HasKey(r => r.RoleId);
                entity.Property(r => r.Name).HasMaxLength(50).IsRequired();
                entity.HasIndex(r => r.Name).IsUnique();
            });

            modelBuilder.Entity<UserRole>(entity =>
            {
                entity.ToTable("UserRole");
                entity.HasKey(x => new { x.UserId, x.RoleId });
                entity.HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
                entity.HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);
            });

            // TeacherInfo (1-1 với User)
            modelBuilder.Entity<TeacherInfo>(entity =>
            {
                entity.HasKey(e => e.TeacherId);
                entity.Property(e => e.status).HasDefaultValue(1);

                entity.HasOne(t => t.User)
                      .WithOne()
                      .HasForeignKey<TeacherInfo>(t => t.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(t => t.UserId).IsUnique();
            });

            // ClassStudent (bảng nối many-to-many)
            modelBuilder.Entity<ClassStudent>(entity =>
            {
                entity.HasKey(cs => new { cs.ClassID, cs.StudentId });

                entity.HasOne(cs => cs.Class)
                      .WithMany(c => c.ClassStudents)
                      .HasForeignKey(cs => cs.ClassID)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(cs => cs.Student)
                      .WithMany(s => s.ClassStudents)
                      .HasForeignKey(cs => cs.StudentId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ClassSchedule
            modelBuilder.Entity<ClassSchedule>(entity =>
            {
                entity.HasKey(s => s.ScheduleId);

                entity.Property(s => s.DayOfWeek).IsRequired();
                entity.Property(s => s.StartTime).IsRequired();
                entity.Property(s => s.EndTime).IsRequired();
                entity.Property(s => s.IsActive).HasDefaultValue(true);
                entity.Property(s => s.Note).HasMaxLength(200);

                entity.HasOne(s => s.Class)
                      .WithMany(c => c.Schedules)
                      .HasForeignKey(s => s.ClassID)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(s => new { s.ClassID, s.DayOfWeek, s.StartTime })
                      .IsUnique();

                // NEW: FK sang Teacher + index theo giáo viên
                entity.HasOne(e => e.Teacher)
                      .WithMany()
                      .HasForeignKey(e => e.TeacherId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.TeacherId, e.DayOfWeek, e.StartTime, e.EndTime });
            });

            // ClassSession (chỉ giữ 1 khối, bỏ bản lặp)
            modelBuilder.Entity<ClassSession>(entity =>
            {
                entity.HasKey(s => s.SessionId);

                entity.Property(s => s.SessionDate).IsRequired();
                entity.Property(s => s.StartTime).IsRequired();
                entity.Property(s => s.EndTime).IsRequired();
                entity.Property(s => s.Status).HasDefaultValue(SessionStatus.Planned);
                entity.Property(s => s.IsAutoGenerated).HasDefaultValue(true);
                entity.Property(s => s.Note).HasMaxLength(500);
                entity.Property(s => s.AccountingApplied).HasDefaultValue(false);
                entity.Property(s => s.AccountingAppliedAtUtc);

                entity.HasOne(s => s.Class)
                      .WithMany(c => c.Sessions)
                      .HasForeignKey(s => s.ClassID)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(s => s.Teacher)
                      .WithMany()
                      .HasForeignKey(s => s.TeacherId)
                      .OnDelete(DeleteBehavior.SetNull);

                entity.HasIndex(s => new { s.ClassID, s.SessionDate, s.StartTime }).IsUnique();
                entity.HasIndex("TeacherId", "SessionDate")
                      .HasFilter("[TeacherId] IS NOT NULL");
            });

            modelBuilder.Entity<Attendance>()
               .HasIndex(a => new { a.SessionId, a.StudentId })
               .IsUnique();

            modelBuilder.Entity<TeacherMonthlyStat>()
                .HasIndex(x => new { x.TeacherId, x.Year, x.Month })
                .IsUnique();

            // StudentInfo (giữ bản đầy đủ, có 1-1 với User)
            modelBuilder.Entity<StudentInfo>(entity =>
            {
                entity.HasKey(e => e.StudentId);
                entity.Property(e => e.Status).HasDefaultValue(1);
                entity.Property<DateTime?>("StatusChangedAt");

                entity.HasOne(s => s.User)
                      .WithOne()
                      .HasForeignKey<StudentInfo>(s => s.UserId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(s => s.UserId).IsUnique()
                      .HasFilter("[UserId] IS NOT NULL");
            });

            modelBuilder.Entity<PasswordResetOtp>(entity =>
            {
                entity.ToTable("PasswordResetOtp");
                entity.HasKey(e => e.OtpId);

                entity.Property(e => e.CodeHash).HasMaxLength(120).IsRequired();
                entity.Property(e => e.Purpose).HasMaxLength(20).HasDefaultValue("reset").IsRequired();
                entity.Property(e => e.ExpiresAtUtc).IsRequired();
                entity.Property(e => e.Attempts).HasDefaultValue(0);
                entity.Property(e => e.SendCount).HasDefaultValue(1);
                entity.Property(e => e.LastSentAtUtc).IsRequired();
                entity.Property(e => e.ClientIp).HasMaxLength(45);
                entity.Property(e => e.UserAgent).HasMaxLength(200);

                entity.HasOne(e => e.User)
                      .WithMany()
                      .HasForeignKey(e => e.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => e.LastSentAtUtc);
                entity.HasIndex(e => new { e.UserId, e.Purpose });

                entity.HasIndex(e => new { e.UserId, e.Purpose })
                      .IsUnique()
                      .HasFilter("[ConsumedAtUtc] IS NULL");
            });

            // TuitionPaymentRequest
            modelBuilder.Entity<TuitionPaymentRequest>(entity =>
            {
                entity.ToTable("TuitionPaymentRequests");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.ImagePath).HasMaxLength(260);
                entity.Property(e => e.ImageContentType).HasMaxLength(100);
                entity.Property(e => e.EmailSnapshot).HasMaxLength(120);
                entity.Property(e => e.RejectReason).HasMaxLength(300);
                entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("GETUTCDATE()");

                entity.HasOne(e => e.Student)
                      .WithMany()
                      .HasForeignKey(e => e.StudentId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(e => new { e.StudentId, e.Status })
                      .IsUnique()
                      .HasFilter("[Status] = 0");
            });

            // WEB REQUEST LOGS
            modelBuilder.Entity<WebRequestLog>(entity =>
            {
                entity.ToTable("WebRequestLogs");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Path).HasMaxLength(300).IsRequired();
                entity.Property(e => e.Method).HasMaxLength(10).IsRequired();
                entity.Property(e => e.Role).HasMaxLength(30);
                entity.Property(e => e.ClientId).HasMaxLength(64);
                entity.Property(e => e.UserAgent).HasMaxLength(512);
                entity.Property(e => e.Ip).HasMaxLength(64);

                entity.HasIndex(e => e.DateLocal);
                entity.HasIndex(e => new { e.Path, e.DateLocal });
            });

            // WEB TRAFFIC DAILY
            modelBuilder.Entity<WebTrafficDaily>(entity =>
            {
                entity.ToTable("WebTrafficDaily");
                entity.HasKey(e => new { e.Date, e.Path });

                entity.Property(e => e.Path).HasMaxLength(300).IsRequired();
                entity.Property(e => e.Hits).HasDefaultValue(0);
                entity.Property(e => e.UniqueVisitors).HasDefaultValue(0);

                entity.HasIndex(e => e.Date);
            });

            // WEB TRAFFIC MONTHLY
            modelBuilder.Entity<WebTrafficMonthly>(entity =>
            {
                entity.ToTable("WebTrafficMonthly");
                entity.HasKey(e => new { e.Year, e.Month, e.Path });

                entity.Property(e => e.Path).HasMaxLength(300).IsRequired();
                entity.Property(e => e.Hits).HasDefaultValue(0);
                entity.Property(e => e.UniqueVisitors).HasDefaultValue(0);

                entity.HasIndex(e => new { e.Year, e.Month });
            });

            // AUTH LOGIN LOGS
            modelBuilder.Entity<AuthLoginLog>(entity =>
            {
                entity.ToTable("AuthLoginLogs");
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Email).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Role).HasMaxLength(30).IsRequired();
                entity.Property(e => e.ClientId).HasMaxLength(64);
                entity.Property(e => e.UserAgent).HasMaxLength(512);
                entity.Property(e => e.Ip).HasMaxLength(64);

                entity.HasIndex(e => e.DateLocal);
                entity.HasIndex(e => new { e.Role, e.DateLocal });
                entity.HasIndex(e => new { e.UserId, e.DateLocal });
            });
        }
    }
}
