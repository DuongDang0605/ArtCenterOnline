using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArtCenterOnline.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddWebTrafficAndLoginLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuthLoginLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateLocal = table.Column<DateOnly>(type: "date", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ClientId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Ip = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuthLoginLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WebRequestLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OccurredAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DateLocal = table.Column<DateOnly>(type: "date", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    StatusCode = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ClientId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    DurationMs = table.Column<int>(type: "int", nullable: true),
                    UserAgent = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Ip = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebRequestLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WebTrafficDaily",
                columns: table => new
                {
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Hits = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    UniqueVisitors = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebTrafficDaily", x => new { x.Date, x.Path });
                });

            migrationBuilder.CreateTable(
                name: "WebTrafficMonthly",
                columns: table => new
                {
                    Year = table.Column<int>(type: "int", nullable: false),
                    Month = table.Column<int>(type: "int", nullable: false),
                    Path = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Hits = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    UniqueVisitors = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebTrafficMonthly", x => new { x.Year, x.Month, x.Path });
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuthLoginLogs_DateLocal",
                table: "AuthLoginLogs",
                column: "DateLocal");

            migrationBuilder.CreateIndex(
                name: "IX_AuthLoginLogs_Role_DateLocal",
                table: "AuthLoginLogs",
                columns: new[] { "Role", "DateLocal" });

            migrationBuilder.CreateIndex(
                name: "IX_AuthLoginLogs_UserId_DateLocal",
                table: "AuthLoginLogs",
                columns: new[] { "UserId", "DateLocal" });

            migrationBuilder.CreateIndex(
                name: "IX_WebRequestLogs_DateLocal",
                table: "WebRequestLogs",
                column: "DateLocal");

            migrationBuilder.CreateIndex(
                name: "IX_WebRequestLogs_Path_DateLocal",
                table: "WebRequestLogs",
                columns: new[] { "Path", "DateLocal" });

            migrationBuilder.CreateIndex(
                name: "IX_WebTrafficDaily_Date",
                table: "WebTrafficDaily",
                column: "Date");

            migrationBuilder.CreateIndex(
                name: "IX_WebTrafficMonthly_Year_Month",
                table: "WebTrafficMonthly",
                columns: new[] { "Year", "Month" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuthLoginLogs");

            migrationBuilder.DropTable(
                name: "WebRequestLogs");

            migrationBuilder.DropTable(
                name: "WebTrafficDaily");

            migrationBuilder.DropTable(
                name: "WebTrafficMonthly");
        }
    }
}
