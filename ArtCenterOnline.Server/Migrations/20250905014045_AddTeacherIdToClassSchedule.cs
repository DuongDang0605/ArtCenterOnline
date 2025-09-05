using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArtCenterOnline.Server.Migrations
{
    public partial class AddTeacherIdToClassSchedule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Thêm cột TeacherId (nullable) vào ClassSchedules
            migrationBuilder.AddColumn<int>(
                name: "TeacherId",
                table: "ClassSchedules",
                type: "int",
                nullable: true);

            // 2) Tạo index hỗ trợ kiểm trùng GV theo lịch
            migrationBuilder.CreateIndex(
                name: "IX_ClassSchedules_TeacherId_DayOfWeek_StartTime_EndTime",
                table: "ClassSchedules",
                columns: new[] { "TeacherId", "DayOfWeek", "StartTime", "EndTime" });

            // 3) Thêm FK sang Teachers(TeacherId) — Restrict khi xoá
            migrationBuilder.AddForeignKey(
                name: "FK_ClassSchedules_Teachers_TeacherId",
                table: "ClassSchedules",
                column: "TeacherId",
                principalTable: "Teachers",
                principalColumn: "TeacherId",
                onDelete: ReferentialAction.Restrict);

            // 4) Backfill: nếu lịch chưa có GV, dùng MainTeacherId của lớp (tạm thời, sẽ xoá MainTeacherId ở bước sau)
            migrationBuilder.Sql(@"
UPDATE cs
SET cs.TeacherId = c.MainTeacherId
FROM dbo.ClassSchedules cs
JOIN dbo.Classes c ON c.ClassId = cs.ClassID
WHERE cs.TeacherId IS NULL
  AND c.MainTeacherId IS NOT NULL;
");

        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClassSchedules_Teachers_TeacherId",
                table: "ClassSchedules");

            migrationBuilder.DropIndex(
                name: "IX_ClassSchedules_TeacherId_DayOfWeek_StartTime_EndTime",
                table: "ClassSchedules");

            migrationBuilder.DropColumn(
                name: "TeacherId",
                table: "ClassSchedules");
        }
    }
}
