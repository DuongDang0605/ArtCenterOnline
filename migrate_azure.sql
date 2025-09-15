IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820025112_BaselineEmpty'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250820025112_BaselineEmpty', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820030644_AddUsers'
)
BEGIN
    CREATE TABLE [Users] (
        [UserId] int NOT NULL IDENTITY,
        [UserEmail] nvarchar(100) NOT NULL,
        [Password] nvarchar(100) NOT NULL,
        [Status] int NOT NULL DEFAULT 1,
        CONSTRAINT [PK_Users] PRIMARY KEY ([UserId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820030644_AddUsers'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_UserEmail] ON [Users] ([UserEmail]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820030644_AddUsers'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250820030644_AddUsers', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820032915_InitialCreate'
)
BEGIN
    ALTER TABLE [Users] ADD [role] nvarchar(100) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820032915_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250820032915_InitialCreate', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820065636_InsertStudent'
)
BEGIN
    CREATE TABLE [Students] (
        [StudentId] int NOT NULL IDENTITY,
        [StudentName] nvarchar(max) NOT NULL,
        [ParentName] nvarchar(max) NOT NULL,
        [PhoneNumber] nvarchar(max) NOT NULL,
        [Adress] nvarchar(max) NOT NULL,
        [ngayBatDauHoc] date NOT NULL,
        [SoBuoiHocConLai] int NOT NULL,
        [SoBuoiHocDaHoc] int NOT NULL,
        [Status] nvarchar(max) NOT NULL DEFAULT N'1',
        CONSTRAINT [PK_Students] PRIMARY KEY ([StudentId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820065636_InsertStudent'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250820065636_InsertStudent', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820080554_InsertTeacher'
)
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Students]') AND [c].[name] = N'Status');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Students] DROP CONSTRAINT [' + @var + '];');
    ALTER TABLE [Students] ALTER COLUMN [Status] int NOT NULL;
    ALTER TABLE [Students] ADD DEFAULT 1 FOR [Status];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820080554_InsertTeacher'
)
BEGIN
    CREATE TABLE [Teachers] (
        [TeacherId] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [TeacherName] nvarchar(max) NOT NULL,
        [PhoneNumber] nvarchar(max) NOT NULL,
        [SoBuoiDayTrongThang] int NOT NULL,
        [status] int NOT NULL DEFAULT 1,
        CONSTRAINT [PK_Teachers] PRIMARY KEY ([TeacherId]),
        CONSTRAINT [FK_Teachers_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820080554_InsertTeacher'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Teachers_UserId] ON [Teachers] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250820080554_InsertTeacher'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250820080554_InsertTeacher', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822021153_FixTeacherUserRelation'
)
BEGIN

    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_Teachers_UserId'
          AND object_id = OBJECT_ID(N'[dbo].[Teachers]')
    )
        DROP INDEX [IX_Teachers_UserId] ON [dbo].[Teachers];

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822021153_FixTeacherUserRelation'
)
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = N'IX_Teachers_UserId'
          AND object_id = OBJECT_ID(N'[dbo].[Teachers]')
    )
        CREATE UNIQUE INDEX [IX_Teachers_UserId] ON [dbo].[Teachers]([UserId]);

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822021153_FixTeacherUserRelation'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250822021153_FixTeacherUserRelation', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822025847_Add_ClassStudent_M2M'
)
BEGIN
    CREATE TABLE [ClassStudents] (
        [ClassID] int NOT NULL,
        [StudentId] int NOT NULL,
        [JoinedDate] date NOT NULL,
        [IsActive] bit NOT NULL,
        [Note] nvarchar(max) NULL,
        CONSTRAINT [PK_ClassStudents] PRIMARY KEY ([ClassID], [StudentId]),
        CONSTRAINT [FK_ClassStudents_Classes_ClassID] FOREIGN KEY ([ClassID]) REFERENCES [Classes] ([ClassID]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClassStudents_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822025847_Add_ClassStudent_M2M'
)
BEGIN
    CREATE INDEX [IX_ClassStudents_StudentId] ON [ClassStudents] ([StudentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822025847_Add_ClassStudent_M2M'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250822025847_Add_ClassStudent_M2M', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822064843_Add_ClassSchedule'
)
BEGIN
    CREATE TABLE [ClassSchedules] (
        [ScheduleId] int NOT NULL IDENTITY,
        [ClassID] int NOT NULL,
        [DayOfWeek] int NOT NULL,
        [StartTime] time NOT NULL,
        [EndTime] time NOT NULL,
        [IsActive] bit NOT NULL DEFAULT CAST(1 AS bit),
        [Note] nvarchar(200) NULL,
        CONSTRAINT [PK_ClassSchedules] PRIMARY KEY ([ScheduleId]),
        CONSTRAINT [FK_ClassSchedules_Classes_ClassID] FOREIGN KEY ([ClassID]) REFERENCES [Classes] ([ClassID]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822064843_Add_ClassSchedule'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ClassSchedules_ClassID_DayOfWeek_StartTime] ON [ClassSchedules] ([ClassID], [DayOfWeek], [StartTime]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822064843_Add_ClassSchedule'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250822064843_Add_ClassSchedule', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    ALTER TABLE [Classes] ADD [MainTeacherId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    CREATE TABLE [ClassSessions] (
        [SessionId] int NOT NULL IDENTITY,
        [ClassID] int NOT NULL,
        [TeacherId] int NULL,
        [SessionDate] date NOT NULL,
        [StartTime] time NOT NULL,
        [EndTime] time NOT NULL,
        [Note] nvarchar(500) NULL,
        [Status] int NOT NULL DEFAULT 0,
        [IsAutoGenerated] bit NOT NULL DEFAULT CAST(1 AS bit),
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ClassSessions] PRIMARY KEY ([SessionId]),
        CONSTRAINT [FK_ClassSessions_Classes_ClassID] FOREIGN KEY ([ClassID]) REFERENCES [Classes] ([ClassID]) ON DELETE CASCADE,
        CONSTRAINT [FK_ClassSessions_Teachers_TeacherId] FOREIGN KEY ([TeacherId]) REFERENCES [Teachers] ([TeacherId]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    CREATE INDEX [IX_Classes_MainTeacherId] ON [Classes] ([MainTeacherId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ClassSessions_ClassID_SessionDate_StartTime] ON [ClassSessions] ([ClassID], [SessionDate], [StartTime]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    EXEC(N'CREATE INDEX [IX_ClassSessions_TeacherId_SessionDate] ON [ClassSessions] ([TeacherId], [SessionDate]) WHERE [TeacherId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    ALTER TABLE [Classes] ADD CONSTRAINT [FK_Classes_Teachers_MainTeacherId] FOREIGN KEY ([MainTeacherId]) REFERENCES [Teachers] ([TeacherId]) ON DELETE SET NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250822085116_Add_MainTeacher_And_ClassSession'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250822085116_Add_MainTeacher_And_ClassSession', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    CREATE TABLE [Attendances] (
        [AttendanceId] int NOT NULL IDENTITY,
        [SessionId] int NOT NULL,
        [StudentId] int NOT NULL,
        [IsPresent] bit NOT NULL DEFAULT CAST(0 AS bit),
        [Note] nvarchar(max) NULL,
        [TakenAtUtc] datetime2 NOT NULL,
        [TakenByUserId] int NOT NULL,
        CONSTRAINT [PK_Attendances] PRIMARY KEY ([AttendanceId]),
        CONSTRAINT [FK_Attendances_ClassSessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [ClassSessions] ([SessionId]) ON DELETE CASCADE,
        CONSTRAINT [FK_Attendances_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Attendances_SessionId_StudentId] ON [Attendances] ([SessionId], [StudentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    ALTER TABLE [ClassSessions] ADD [AccountingApplied] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    ALTER TABLE [ClassSessions] ADD [AccountingAppliedAtUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    CREATE TABLE [TeacherMonthlyStats] (
        [TeacherMonthlyStatId] int NOT NULL IDENTITY,
        [TeacherId] int NOT NULL,
        [Year] int NOT NULL,
        [Month] int NOT NULL,
        [TaughtCount] int NOT NULL DEFAULT 0,
        CONSTRAINT [PK_TeacherMonthlyStats] PRIMARY KEY ([TeacherMonthlyStatId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TeacherMonthlyStats_TeacherId_Year_Month] ON [TeacherMonthlyStats] ([TeacherId], [Year], [Month]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    ALTER TABLE [ClassStudents] ADD [RemainingSessions] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825040355_Add_Attendance_And_Accounting'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250825040355_Add_Attendance_And_Accounting', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    ALTER TABLE [Users] ADD [Email] nvarchar(max) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    ALTER TABLE [Users] ADD [FullName] nvarchar(max) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    ALTER TABLE [Users] ADD [IsActive] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    ALTER TABLE [Users] ADD [PasswordHash] nvarchar(max) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    CREATE TABLE [Role] (
        [RoleId] int NOT NULL IDENTITY,
        [Name] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Role] PRIMARY KEY ([RoleId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    CREATE TABLE [UserRole] (
        [UserId] int NOT NULL,
        [RoleId] int NOT NULL,
        CONSTRAINT [PK_UserRole] PRIMARY KEY ([UserId], [RoleId]),
        CONSTRAINT [FK_UserRole_Role_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [Role] ([RoleId]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserRole_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    CREATE INDEX [IX_UserRole_RoleId] ON [UserRole] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250825073917_Split_User_Role_RBAC'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250825073917_Split_User_Role_RBAC', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN

    IF COL_LENGTH('dbo.Users', 'UserEmail') IS NOT NULL
    BEGIN
        UPDATE dbo.Users
        SET Email = COALESCE(NULLIF(Email, ''), UserEmail)
        WHERE (Email IS NULL OR Email = '')
          AND UserEmail IS NOT NULL AND UserEmail <> '';
    END

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN

    IF OBJECT_ID('dbo.Role','U') IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Admin')
            INSERT INTO dbo.Role(Name) VALUES (N'Admin');
        IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Teacher')
            INSERT INTO dbo.Role(Name) VALUES (N'Teacher');
        IF NOT EXISTS (SELECT 1 FROM dbo.Role WHERE Name = 'Student')
            INSERT INTO dbo.Role(Name) VALUES (N'Student');
    END

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN

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

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN

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

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN

    IF EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'IX_Users_UserEmail' AND object_id = OBJECT_ID('dbo.Users')
    )
    BEGIN
        DROP INDEX IX_Users_UserEmail ON dbo.Users;
    END

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var1 sysname;
    SELECT @var1 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'Password');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var1 + '];');
    ALTER TABLE [Users] DROP COLUMN [Password];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var2 sysname;
    SELECT @var2 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'Status');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var2 + '];');
    ALTER TABLE [Users] DROP COLUMN [Status];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var3 sysname;
    SELECT @var3 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'UserEmail');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var3 + '];');
    ALTER TABLE [Users] DROP COLUMN [UserEmail];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var4 sysname;
    SELECT @var4 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'role');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var4 + '];');
    ALTER TABLE [Users] DROP COLUMN [role];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var5 sysname;
    SELECT @var5 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'PasswordHash');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var5 + '];');
    ALTER TABLE [Users] ALTER COLUMN [PasswordHash] nvarchar(200) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var6 sysname;
    SELECT @var6 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'IsActive');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var6 + '];');
    ALTER TABLE [Users] ADD DEFAULT CAST(1 AS bit) FOR [IsActive];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var7 sysname;
    SELECT @var7 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'FullName');
    IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var7 + '];');
    ALTER TABLE [Users] ALTER COLUMN [FullName] nvarchar(150) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var8 sysname;
    SELECT @var8 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Users]') AND [c].[name] = N'Email');
    IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [Users] DROP CONSTRAINT [' + @var8 + '];');
    ALTER TABLE [Users] ALTER COLUMN [Email] nvarchar(100) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    DECLARE @var9 sysname;
    SELECT @var9 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Role]') AND [c].[name] = N'Name');
    IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [Role] DROP CONSTRAINT [' + @var9 + '];');
    ALTER TABLE [Role] ALTER COLUMN [Name] nvarchar(50) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Role_Name] ON [Role] ([Name]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250827014156_Fix_UserRole_Table'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250827014156_Fix_UserRole_Table', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250828083850_Add_StatusChangedAt_To_Students'
)
BEGIN
    ALTER TABLE [Students] ADD [StatusChangedAt] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250828083850_Add_StatusChangedAt_To_Students'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250828083850_Add_StatusChangedAt_To_Students', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250904022621_AddAccountingFlagsToClassSession'
)
BEGIN
    DECLARE @var10 sysname;
    SELECT @var10 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ClassSessions]') AND [c].[name] = N'AccountingApplied');
    IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [ClassSessions] DROP CONSTRAINT [' + @var10 + '];');
    ALTER TABLE [ClassSessions] ADD DEFAULT CAST(0 AS bit) FOR [AccountingApplied];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250904022621_AddAccountingFlagsToClassSession'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250904022621_AddAccountingFlagsToClassSession', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250905014045_AddTeacherIdToClassSchedule'
)
BEGIN
    ALTER TABLE [ClassSchedules] ADD [TeacherId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250905014045_AddTeacherIdToClassSchedule'
)
BEGIN
    CREATE INDEX [IX_ClassSchedules_TeacherId_DayOfWeek_StartTime_EndTime] ON [ClassSchedules] ([TeacherId], [DayOfWeek], [StartTime], [EndTime]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250905014045_AddTeacherIdToClassSchedule'
)
BEGIN
    ALTER TABLE [ClassSchedules] ADD CONSTRAINT [FK_ClassSchedules_Teachers_TeacherId] FOREIGN KEY ([TeacherId]) REFERENCES [Teachers] ([TeacherId]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250905014045_AddTeacherIdToClassSchedule'
)
BEGIN

    UPDATE cs
    SET cs.TeacherId = c.MainTeacherId
    FROM dbo.ClassSchedules cs
    JOIN dbo.Classes c ON c.ClassId = cs.ClassID
    WHERE cs.TeacherId IS NULL
      AND c.MainTeacherId IS NOT NULL;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250905014045_AddTeacherIdToClassSchedule'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250905014045_AddTeacherIdToClassSchedule', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    ALTER TABLE [Classes] DROP CONSTRAINT [FK_Classes_Teachers_MainTeacherId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    DROP INDEX [IX_Classes_MainTeacherId] ON [Classes];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    DECLARE @var11 sysname;
    SELECT @var11 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Classes]') AND [c].[name] = N'MainTeacherId');
    IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [Classes] DROP CONSTRAINT [' + @var11 + '];');
    ALTER TABLE [Classes] DROP COLUMN [MainTeacherId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    ALTER TABLE [Students] ADD [UserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Students_UserId] ON [Students] ([UserId]) WHERE [UserId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    ALTER TABLE [Students] ADD CONSTRAINT [FK_Students_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250910024335_AddUserIdToStudentInfo'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250910024335_AddUserIdToStudentInfo', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250912015708_AddPasswordResetOtp'
)
BEGIN
    CREATE TABLE [PasswordResetOtp] (
        [OtpId] uniqueidentifier NOT NULL,
        [UserId] int NOT NULL,
        [CodeHash] nvarchar(120) NOT NULL,
        [Purpose] nvarchar(20) NOT NULL DEFAULT N'reset',
        [ExpiresAtUtc] datetime2 NOT NULL,
        [ConsumedAtUtc] datetime2 NULL,
        [Attempts] int NOT NULL DEFAULT 0,
        [SendCount] int NOT NULL DEFAULT 1,
        [LastSentAtUtc] datetime2 NOT NULL,
        [ClientIp] nvarchar(45) NULL,
        [UserAgent] nvarchar(200) NULL,
        CONSTRAINT [PK_PasswordResetOtp] PRIMARY KEY ([OtpId]),
        CONSTRAINT [FK_PasswordResetOtp_Users_UserId] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250912015708_AddPasswordResetOtp'
)
BEGIN
    CREATE INDEX [IX_PasswordResetOtp_LastSentAtUtc] ON [PasswordResetOtp] ([LastSentAtUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250912015708_AddPasswordResetOtp'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_PasswordResetOtp_UserId_Purpose] ON [PasswordResetOtp] ([UserId], [Purpose]) WHERE [ConsumedAtUtc] IS NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250912015708_AddPasswordResetOtp'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250912015708_AddPasswordResetOtp', N'9.0.8');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE TABLE [AuthLoginLogs] (
        [Id] bigint NOT NULL IDENTITY,
        [OccurredAtUtc] datetime2 NOT NULL,
        [DateLocal] date NOT NULL,
        [UserId] int NOT NULL,
        [Email] nvarchar(100) NOT NULL,
        [Role] nvarchar(30) NOT NULL,
        [ClientId] nvarchar(64) NULL,
        [UserAgent] nvarchar(512) NULL,
        [Ip] nvarchar(64) NULL,
        CONSTRAINT [PK_AuthLoginLogs] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE TABLE [WebRequestLogs] (
        [Id] bigint NOT NULL IDENTITY,
        [OccurredAtUtc] datetime2 NOT NULL,
        [DateLocal] date NOT NULL,
        [Path] nvarchar(300) NOT NULL,
        [Method] nvarchar(10) NOT NULL,
        [StatusCode] int NOT NULL,
        [UserId] int NULL,
        [Role] nvarchar(30) NULL,
        [ClientId] nvarchar(64) NULL,
        [DurationMs] int NULL,
        [UserAgent] nvarchar(512) NULL,
        [Ip] nvarchar(64) NULL,
        CONSTRAINT [PK_WebRequestLogs] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE TABLE [WebTrafficDaily] (
        [Date] date NOT NULL,
        [Path] nvarchar(300) NOT NULL,
        [Hits] int NOT NULL DEFAULT 0,
        [UniqueVisitors] int NOT NULL DEFAULT 0,
        CONSTRAINT [PK_WebTrafficDaily] PRIMARY KEY ([Date], [Path])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE TABLE [WebTrafficMonthly] (
        [Year] int NOT NULL,
        [Month] int NOT NULL,
        [Path] nvarchar(300) NOT NULL,
        [Hits] int NOT NULL DEFAULT 0,
        [UniqueVisitors] int NOT NULL DEFAULT 0,
        CONSTRAINT [PK_WebTrafficMonthly] PRIMARY KEY ([Year], [Month], [Path])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_AuthLoginLogs_DateLocal] ON [AuthLoginLogs] ([DateLocal]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_AuthLoginLogs_Role_DateLocal] ON [AuthLoginLogs] ([Role], [DateLocal]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_AuthLoginLogs_UserId_DateLocal] ON [AuthLoginLogs] ([UserId], [DateLocal]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_WebRequestLogs_DateLocal] ON [WebRequestLogs] ([DateLocal]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_WebRequestLogs_Path_DateLocal] ON [WebRequestLogs] ([Path], [DateLocal]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_WebTrafficDaily_Date] ON [WebTrafficDaily] ([Date]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    CREATE INDEX [IX_WebTrafficMonthly_Year_Month] ON [WebTrafficMonthly] ([Year], [Month]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20250915035151_AddWebTrafficAndLoginLogs'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20250915035151_AddWebTrafficAndLoginLogs', N'9.0.8');
END;

COMMIT;
GO

