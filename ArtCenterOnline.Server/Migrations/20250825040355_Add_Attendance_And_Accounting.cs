using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArtCenterOnline.Server.Migrations
{
    public partial class Add_Attendance_And_Accounting : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Attendances
            migrationBuilder.CreateTable(
                name: "Attendances",
                columns: table => new
                {
                    AttendanceId = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SessionId = table.Column<int>(nullable: false),
                    StudentId = table.Column<int>(nullable: false),
                    IsPresent = table.Column<bool>(nullable: false, defaultValue: false),
                    Note = table.Column<string>(nullable: true),
                    TakenAtUtc = table.Column<DateTime>(nullable: false),
                    TakenByUserId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attendances", x => x.AttendanceId);
                    table.ForeignKey(
                        name: "FK_Attendances_ClassSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "ClassSessions",
                        principalColumn: "SessionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Attendances_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "StudentId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_SessionId_StudentId",
                table: "Attendances",
                columns: new[] { "SessionId", "StudentId" },
                unique: true);

            // Accounting flags on ClassSessions
            migrationBuilder.AddColumn<bool>(
                name: "AccountingApplied",
                table: "ClassSessions",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "AccountingAppliedAtUtc",
                table: "ClassSessions",
                type: "datetime2",
                nullable: true);

            // TeacherMonthlyStats
            migrationBuilder.CreateTable(
                name: "TeacherMonthlyStats",
                columns: table => new
                {
                    TeacherMonthlyStatId = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TeacherId = table.Column<int>(nullable: false),
                    Year = table.Column<int>(nullable: false),
                    Month = table.Column<int>(nullable: false),
                    TaughtCount = table.Column<int>(nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeacherMonthlyStats", x => x.TeacherMonthlyStatId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeacherMonthlyStats_TeacherId_Year_Month",
                table: "TeacherMonthlyStats",
                columns: new[] { "TeacherId", "Year", "Month" },
                unique: true);

            // RemainingSessions on ClassStudents
            migrationBuilder.AddColumn<int>(
                name: "RemainingSessions",
                table: "ClassStudents",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "Attendances");
            migrationBuilder.DropTable(name: "TeacherMonthlyStats");

            migrationBuilder.DropColumn(
                name: "AccountingApplied",
                table: "ClassSessions");
            migrationBuilder.DropColumn(
                name: "AccountingAppliedAtUtc",
                table: "ClassSessions");

            migrationBuilder.DropColumn(
                name: "RemainingSessions",
                table: "ClassStudents");
        }
    }
}
