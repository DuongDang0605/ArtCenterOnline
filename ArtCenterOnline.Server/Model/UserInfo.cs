// Models/User.cs
namespace ArtCenterOnline.Server.Model
{
    public class User
    {
        public int UserId { get; set; }
        public string Email { get; set; } = "";        // unique
        public string PasswordHash { get; set; } = ""; // tạm thời chứa giá trị plain nếu DB đang plain
        public string FullName { get; set; } = "";
        public bool IsActive { get; set; } = true;

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }

    public class Role
    {
        public int RoleId { get; set; }
        public string Name { get; set; } = ""; // "Admin", "Teacher", ...
        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    }

    public class UserRole
    {
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        public int RoleId { get; set; }
        public Role Role { get; set; } = null!;
    }
}
