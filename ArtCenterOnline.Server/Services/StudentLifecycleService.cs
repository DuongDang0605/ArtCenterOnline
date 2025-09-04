// Services/StudentLifecycleService.cs
using ArtCenterOnline.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Services
{
    public interface IStudentLifecycleService
    {
        /// <summary>
        /// Đặt Student.Status = 0 và tắt toàn bộ liên kết lớp (ClassStudent.IsActive = false).
        /// Trả về số bản ghi ClassStudent bị tắt.
        /// </summary>
        Task<int> DeactivateStudentAsync(int studentId);

        /// <summary>
        /// Trả về true nếu học sinh có thể tham gia lớp (Status == 1).
        /// </summary>
        Task<bool> CanJoinAnyClassAsync(int studentId);
    }

    public sealed class StudentLifecycleService : IStudentLifecycleService
    {
        private readonly AppDbContext _db;

        public StudentLifecycleService(AppDbContext db) => _db = db;

        public async Task<int> DeactivateStudentAsync(int studentId)
        {
            var student = await _db.Students.FirstOrDefaultAsync(s => s.StudentId == studentId);
            if (student == null) return 0;

            // Cập nhật trạng thái học sinh
            if (student.Status != 0)
            {
                student.Status = 0;
                student.StatusChangedAt = DateTime.UtcNow;
            }

            // Tắt toàn bộ liên kết lớp còn đang active
            var links = await _db.ClassStudents
                                 .Where(cs => cs.StudentId == studentId && cs.IsActive)
                                 .ToListAsync();

            foreach (var cs in links)
            {
                cs.IsActive = false;
            }

            await _db.SaveChangesAsync();
            return links.Count;
        }

        public async Task<bool> CanJoinAnyClassAsync(int studentId)
        {
            var st = await _db.Students
                              .AsNoTracking()
                              .FirstOrDefaultAsync(s => s.StudentId == studentId);
            return st != null && st.Status == 1;
        }
    }
}
