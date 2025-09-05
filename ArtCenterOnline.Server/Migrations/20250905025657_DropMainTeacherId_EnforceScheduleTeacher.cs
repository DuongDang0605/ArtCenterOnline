using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

public partial class DropMainTeacherId_EnforceScheduleTeacher : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1) Backfill lần cuối phòng schedule còn null
        migrationBuilder.Sql(@"
UPDATE cs
SET cs.TeacherId = c.MainTeacherId
FROM dbo.ClassSchedules cs
JOIN dbo.Classes c ON c.ClassId = cs.ClassID
WHERE cs.TeacherId IS NULL AND c.MainTeacherId IS NOT NULL;
");

        // 2) Chặn nếu vẫn còn schedule chưa có GV
        migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM dbo.ClassSchedules WHERE TeacherId IS NULL)
    THROW 51000, 'Cannot enforce NOT NULL: some ClassSchedules.TeacherId are NULL. Please assign teachers to all schedules first.', 1;
");

        // 3) Ép NOT NULL cho Schedule.TeacherId
        migrationBuilder.AlterColumn<int>(
            name: "TeacherId",
            table: "ClassSchedules",
            type: "int",
            nullable: false,
            oldClrType: typeof(int),
            oldType: "int",
            oldNullable: true);

        // 4) Gỡ FK/IX liên quan đến Classes.MainTeacherId nếu có (tên ràng buộc có thể khác nhau → drop động)
        migrationBuilder.Sql(@"
DECLARE @fk NVARCHAR(128);
SELECT TOP 1 @fk = fk.name
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID(N'dbo.Classes')
  AND EXISTS (
    SELECT 1 FROM sys.foreign_key_columns fkc
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.constraint_object_id = fk.object_id AND c.name = 'MainTeacherId'
  );
IF @fk IS NOT NULL EXEC('ALTER TABLE dbo.Classes DROP CONSTRAINT ' + QUOTENAME(@fk));

DECLARE @ix NVARCHAR(128);
SELECT TOP 1 @ix = i.name
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.Classes') AND c.name = 'MainTeacherId' AND i.is_hypothetical = 0;
IF @ix IS NOT NULL EXEC('DROP INDEX ' + QUOTENAME(@ix) + ' ON dbo.Classes');
");

        // 5) Drop cột Classes.MainTeacherId
        migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Classes','MainTeacherId') IS NOT NULL
    ALTER TABLE dbo.Classes DROP COLUMN MainTeacherId;
");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Khôi phục MainTeacherId (NULLABLE) nếu rollback
        migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.Classes','MainTeacherId') IS NULL
    ALTER TABLE dbo.Classes ADD MainTeacherId int NULL;
");

        // Cho phép NULL lại trên Schedule.TeacherId (rollback)
        migrationBuilder.AlterColumn<int>(
            name: "TeacherId",
            table: "ClassSchedules",
            type: "int",
            nullable: true,
            oldClrType: typeof(int),
            oldType: "int");

        // (Không tự tạo lại FK/IX cho MainTeacherId vì tên có thể khác nhau)
    }
}
