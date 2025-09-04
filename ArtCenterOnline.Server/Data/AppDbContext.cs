using ArtCenterOnline.Server.Model;
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
                entity.HasOne(c => c.MainTeacher)
          .WithMany()
          .HasForeignKey(c => c.MainTeacherId)
          .OnDelete(DeleteBehavior.SetNull);
            });

            // User
            // ... trong OnModelCreating(ModelBuilder modelBuilder)
            modelBuilder.Entity<User>(entity =>
            {
                entity.ToTable("Users");              // <— RÀNG TÊN BẢNG
                entity.HasKey(e => e.UserId);
                entity.Property(e => e.Email).HasMaxLength(100).IsRequired();
                entity.HasIndex(e => e.Email).IsUnique();
                entity.Property(e => e.PasswordHash).HasMaxLength(200).IsRequired();
                entity.Property(e => e.FullName).HasMaxLength(150);
                entity.Property(e => e.IsActive).HasDefaultValue(true);
            });

            modelBuilder.Entity<Role>(entity =>
            {
                entity.ToTable("Role");               // <— RÀNG TÊN BẢNG
                entity.HasKey(r => r.RoleId);
                entity.Property(r => r.Name).HasMaxLength(50).IsRequired();
                entity.HasIndex(r => r.Name).IsUnique();
            });

            modelBuilder.Entity<UserRole>(entity =>
            {
                entity.ToTable("UserRole");           // <— RÀNG TÊN BẢNG (số ÍT)
                entity.HasKey(x => new { x.UserId, x.RoleId });
                entity.HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
                entity.HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);
            });


            // StudentInfo
            modelBuilder.Entity<StudentInfo>(entity =>
            {
                entity.HasKey(e => e.StudentId);
                entity.Property(e => e.Status).HasDefaultValue(1);
                entity.Property<DateTime?>("StatusChangedAt");
            });


            // TeacherInfo (1-1 với User)
            modelBuilder.Entity<TeacherInfo>(entity =>
            {
                entity.HasKey(e => e.TeacherId);
                entity.Property(e => e.status).HasDefaultValue(1);

                entity.HasOne(t => t.User)
                      .WithOne() // không navigation ở phía User
                      .HasForeignKey<TeacherInfo>(t => t.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasIndex(t => t.UserId).IsUnique(); // đảm bảo 1-1
            });

            // ClassStudent (bảng nối many-to-many)
            modelBuilder.Entity<ClassStudent>(entity =>
            {
                // Khóa chính tổng hợp
                entity.HasKey(cs => new { cs.ClassID, cs.StudentId });

                // FK tới ClassInfo
                entity.HasOne(cs => cs.Class)
                      .WithMany(c => c.ClassStudents)
                      .HasForeignKey(cs => cs.ClassID)
                      .OnDelete(DeleteBehavior.Cascade);

                // FK tới StudentInfo
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

                // Tránh tạo trùng lịch cùng ngày/giờ cho cùng 1 lớp
                entity.HasIndex(s => new { s.ClassID, s.DayOfWeek, s.StartTime })
                      .IsUnique();
            });
            modelBuilder.Entity<ClassSession>(entity =>
            {
                entity.HasKey(s => s.SessionId);

                entity.Property(s => s.SessionDate).IsRequired();
                entity.Property(s => s.StartTime).IsRequired();
                entity.Property(s => s.EndTime).IsRequired();
                entity.Property(s => s.Status).HasDefaultValue(SessionStatus.Planned);
                entity.Property(s => s.IsAutoGenerated).HasDefaultValue(true);
                entity.Property(s => s.Note).HasMaxLength(500);
                // Trong OnModelCreating, phần mapping ClassSession — thêm 2 dòng dưới nếu muốn:
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

                // Không trùng buổi trong 1 lớp
                entity.HasIndex(s => new { s.ClassID, s.SessionDate, s.StartTime })
                      .IsUnique();

                // Tối ưu truy vấn theo giáo viên/ngày (chỉ index khi TeacherId không null)
                entity.HasIndex("TeacherId", "SessionDate")
                      .HasFilter("[TeacherId] IS NOT NULL");
            });
            modelBuilder.Entity<ClassInfo>(entity =>
            {
                entity.HasKey(e => e.ClassID);
                entity.Property(e => e.ClassName).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Branch).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Status).HasDefaultValue(1);


                // 👉 NEW: MainTeacher (SetNull nếu gv nghỉ/xoá)
                entity.HasOne(c => c.MainTeacher)
                .WithMany()
                .HasForeignKey(c => c.MainTeacherId)
                .OnDelete(DeleteBehavior.SetNull);
            });

            // 👉 NEW: ClassSession mapping
            modelBuilder.Entity<ClassSession>(entity =>
            {
                entity.HasKey(s => s.SessionId);
                entity.Property(s => s.SessionDate).IsRequired();
                entity.Property(s => s.StartTime).IsRequired();
                entity.Property(s => s.EndTime).IsRequired();
                entity.Property(s => s.Status).HasDefaultValue(SessionStatus.Planned);
                entity.Property(s => s.IsAutoGenerated).HasDefaultValue(true);
                entity.Property(s => s.Note).HasMaxLength(500);


                entity.HasOne(s => s.Class)
                .WithMany(c => c.Sessions)
                .HasForeignKey(s => s.ClassID)
                .OnDelete(DeleteBehavior.Cascade);


                entity.HasOne(s => s.Teacher)
                .WithMany()
                .HasForeignKey(s => s.TeacherId)
                .OnDelete(DeleteBehavior.SetNull);


                // Không trùng buổi trong 1 lớp (ngày + giờ bắt đầu)
                entity.HasIndex(s => new { s.ClassID, s.SessionDate, s.StartTime }).IsUnique();


                // Tối ưu tìm theo giáo viên và ngày
                entity.HasIndex("TeacherId", "SessionDate").HasFilter("[TeacherId] IS NOT NULL");
            });
            modelBuilder.Entity<Attendance>()
               .HasIndex(a => new { a.SessionId, a.StudentId })
               .IsUnique();

            modelBuilder.Entity<TeacherMonthlyStat>()
                .HasIndex(x => new { x.TeacherId, x.Year, x.Month })
                .IsUnique();
            modelBuilder.Entity<UserRole>().HasKey(x => new { x.UserId, x.RoleId });
            modelBuilder.Entity<UserRole>()
                .HasOne(x => x.User).WithMany(u => u.UserRoles).HasForeignKey(x => x.UserId);
            modelBuilder.Entity<UserRole>()
                .HasOne(x => x.Role).WithMany(r => r.UserRoles).HasForeignKey(x => x.RoleId);

        }
    }
}
