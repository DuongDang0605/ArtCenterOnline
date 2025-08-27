using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArtCenterOnline.Server.Migrations
{
    /// <inheritdoc />
    public partial class Fix_UserRole_Table : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ==========================================
            // 0) BACKFILL dữ liệu trước khi đổi schema
            // ==========================================

            // 0.1) Backfill Email từ UserEmail (nếu còn cột)
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Users', 'UserEmail') IS NOT NULL
BEGIN
    UPDATE dbo.Users
    SET Email = COALESCE(NULLIF(Email, ''), UserEmail)
    WHERE (Email IS NULL OR Email = '')
      AND UserEmail IS NOT NULL AND UserEmail <> '';
END
");

            // 0.2) Seed 3 role cơ bản (nếu chưa có)
            migrationBuilder.Sql(@"
IF OBJECT_ID('dbo.Role','U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Admin')
        INSERT INTO dbo.Role(Name) VALUES (N'Admin');
    IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Teacher')
        INSERT INTO dbo.Role(Name) VALUES (N'Teacher');
    IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Student')
        INSERT INTO dbo.Role(Name) VALUES (N'Student');
END
");

            // 0.3) Tạo lại bảng UserRole nếu đã lỡ xóa
            migrationBuilder.Sql(@"
IF OBJECT_ID('dbo.UserRole','U') IS NULL
BEGIN
    CREATE TABLE dbo.UserRole (
        UserId INT NOT NULL,
        RoleId INT NOT NULL,
        CONSTRAINT PK_UserRole PRIMARY KEY (UserId, RoleId),
        CONSTRAINT FK_UserRole_User FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_UserRole_Role FOREIGN KEY (RoleId) REFERENCES dbo.Role(RoleId) ON DELETE CASCADE
    );
END
");

            // 0.4) Gán UserRole từ cột legacy [role] (nếu cột còn)
            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Users', 'role') IS NOT NULL
BEGIN
    ;WITH src AS (
        SELECT u.UserId, LTRIM(RTRIM(u.[role])) AS RoleName
        FROM dbo.Users u
        WHERE u.[role] IS NOT NULL AND LTRIM(RTRIM(u.[role])) <> ''
    )
    INSERT INTO dbo.UserRole(UserId, RoleId)
    SELECT s.UserId, r.RoleId
    FROM src s
    JOIN dbo.Role r ON r.Name = s.RoleName
    LEFT JOIN dbo.UserRole ur ON ur.UserId = s.UserId AND ur.RoleId = r.RoleId
    WHERE ur.UserId IS NULL;
END
");

            // 0.5) Gỡ index cũ phụ thuộc UserEmail (nếu còn)
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Users_UserEmail' AND object_id = OBJECT_ID('dbo.Users')
)
BEGIN
    DROP INDEX IX_Users_UserEmail ON dbo.Users;
END
");

            // ==========================================
            // 1) XÓA cột legacy (đã backfill & drop index)
            // ==========================================
            migrationBuilder.DropColumn(
                name: "Password",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UserEmail",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "role",
                table: "Users");

            // ==========================================
            // 2) CHUẨN HÓA schema Users & Role
            // ==========================================
            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<bool>(
                name: "IsActive",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Users",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Role",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            // ==========================================
            // 3) Index chuẩn (unique)
            // ==========================================
            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Role_Name",
                table: "Role",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Hoàn tác index chuẩn
            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Role_Name",
                table: "Role");

            // Trả về kích thước cột cũ
            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<bool>(
                name: "IsActive",
                table: "Users",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: true);

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(150)",
                oldMaxLength: 150);

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            // Thêm lại cột legacy (trạng thái trước sửa)
            migrationBuilder.AddColumn<string>(
                name: "Password",
                table: "Users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "UserEmail",
                table: "Users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "role",
                table: "Users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Name",
                table: "Role",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            // (Tuỳ chọn) Drop bảng UserRole khi rollback
            migrationBuilder.Sql(@"
IF OBJECT_ID('dbo.UserRole','U') IS NOT NULL
BEGIN
    DROP TABLE dbo.UserRole;
END
");
        }
    }
}
