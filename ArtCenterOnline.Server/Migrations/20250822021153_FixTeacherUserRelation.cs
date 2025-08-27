using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArtCenterOnline.Server.Migrations
{
    public partial class FixTeacherUserRelation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // (1) Nếu đã có index cũ, drop trước (đề phòng index cũ là non-unique)
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Teachers_UserId'
      AND object_id = OBJECT_ID(N'[dbo].[Teachers]')
)
    DROP INDEX [IX_Teachers_UserId] ON [dbo].[Teachers];
");

            // (2) Tạo lại index unique nếu chưa có
            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Teachers_UserId'
      AND object_id = OBJECT_ID(N'[dbo].[Teachers]')
)
    CREATE UNIQUE INDEX [IX_Teachers_UserId] ON [dbo].[Teachers]([UserId]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_Teachers_UserId'
      AND object_id = OBJECT_ID(N'[dbo].[Teachers]')
)
    DROP INDEX [IX_Teachers_UserId] ON [dbo].[Teachers];
");
            // (Tuỳ chọn) tạo lại index non-unique nếu bạn muốn revert đúng y hệt
            // migrationBuilder.Sql("CREATE INDEX [IX_Teachers_UserId] ON [dbo].[Teachers]([UserId]);");
        }
    }
}
