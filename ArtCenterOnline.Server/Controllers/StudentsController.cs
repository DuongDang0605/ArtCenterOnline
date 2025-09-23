using ArtCenterOnline.Server.Controllers; // để dùng AuthController.HashPassword
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO;
using ArtCenterOnline.Server.Services; // service vòng đời HS
using Azure;
using ExcelDataReader;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using System.Collections.Concurrent;
using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Net.Mime;
using Microsoft.Net.Http.Headers;
using ClosedXML.Excel;

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStudentLifecycleService _lifecycle;

    public StudentsController(AppDbContext db, IStudentLifecycleService lifecycle)
    {
        _db = db;
        _lifecycle = lifecycle;
    }

    // ===== Helpers =====
    private async Task<Role> EnsureRoleAsync(string roleName, CancellationToken ct = default)
    {
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == roleName, ct);
        if (role == null)
        {
            role = new Role { Name = roleName };
            _db.Roles.Add(role);
            await _db.SaveChangesAsync(ct);
        }
        return role;
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var rows = await _db.Students
            .AsNoTracking()
            .Include(s => s.User)
            .Select(s => new {
                studentId = s.StudentId,
                userId = s.UserId,
                studentName = s.StudentName,
                parentName = s.ParentName,
                phoneNumber = s.PhoneNumber,
                adress = s.Adress,
                ngayBatDauHoc = s.ngayBatDauHoc,
                soBuoiHocDaHoc = s.SoBuoiHocDaHoc,
                soBuoiHocConLai = s.SoBuoiHocConLai,
                status = s.Status,
                userEmail = s.User != null ? s.User.Email : ""
            })
            .ToListAsync();
        return Ok(rows);
    }


    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken ct)
    {
        var item = await _db.Students
            .AsNoTracking()
            .Include(s => s.User)
            .Where(s => s.StudentId == id)
            .Select(s => new
            {
                studentId = s.StudentId,
                userId = s.UserId,
                userEmail = s.User != null ? s.User.Email : string.Empty,

                studentName = s.StudentName,
                parentName = s.ParentName,
                phoneNumber = s.PhoneNumber,
                adress = s.Adress,
                ngayBatDauHoc = s.ngayBatDauHoc,      // DateOnly
                soBuoiHocDaHoc = s.SoBuoiHocDaHoc,
                soBuoiHocConLai = s.SoBuoiHocConLai,
                status = s.Status,
                statusChangedAt = s.StatusChangedAt
            })
            .FirstOrDefaultAsync(ct);

        return item is null ? NotFound() : Ok(item);
    }


    [HttpGet("not-in-class/{classId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<object>>> GetActiveNotInClass(int classId)
    {
        var studentIdsInClass = await _db.ClassStudents
            .Where(cs => cs.ClassID == classId)
            .Select(cs => cs.StudentId)
            .ToListAsync();

        var rows = await _db.Students
            .AsNoTracking()
            .Include(s => s.User)
            .Where(s => s.Status == 1 && !studentIdsInClass.Contains(s.StudentId))
            .Select(s => new {
                studentId = s.StudentId,
                studentName = s.StudentName,
                parentName = s.ParentName,
                phoneNumber = s.PhoneNumber,
                adress = s.Adress,
                ngayBatDauHoc = s.ngayBatDauHoc,
                status = s.Status,
                userEmail = s.User != null ? s.User.Email : ""
            })
            .ToListAsync();

        return Ok(rows);
    }


    // StudentsController.cs  (thêm DTO ngay trước action Create)
    public sealed class CreateStudentWithAccountDto : StudentInfo
    {
        public string? Email { get; set; }      // tùy chọn
        public string? Password { get; set; }   // bắt buộc nếu có Email
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        return System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$");
    }

    // REPLACE toàn bộ action [HttpPost] hiện tại bằng action dưới:
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<object>> Create([FromBody] CreateStudentWithAccountDto input, CancellationToken ct)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var strategy = _db.Database.CreateExecutionStrategy();

        try
        {
            return await strategy.ExecuteAsync<ActionResult<object>>(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(ct);

                var useCustomEmail = !string.IsNullOrWhiteSpace(input.Email);
                string finalEmailForReturn;
                string rawPasswordForReturn;

                // 1) Tạo USER
                string emailToUse;
                string passwordHash;

                if (useCustomEmail)
                {
                    var email = input.Email!.Trim();
                    if (!IsValidEmail(email))
                        return BadRequest(new { message = "Email không hợp lệ." });

                    var existed = await _db.Users.AnyAsync(u => u.Email == email, ct);
                    if (existed)
                        return Conflict(new { message = $"Email '{email}' đã tồn tại." });

                    // Bắt buộc có password hợp lệ khi chọn email tùy chỉnh
                    if (string.IsNullOrWhiteSpace(input.Password) || input.Password!.Length < 6)
                        return BadRequest(new { message = "Mật khẩu phải có ít nhất 6 ký tự khi bạn nhập email." });

                    emailToUse = email;
                    passwordHash = BCrypt.Net.BCrypt.HashPassword(input.Password);
                    rawPasswordForReturn = input.Password!;
                }
                else
                {
                    // Cơ chế cũ: email tạm + mật khẩu mặc định
                    emailToUse = $"studenttmp-{Guid.NewGuid():N}@example.com";
                    passwordHash = BCrypt.Net.BCrypt.HashPassword("123456");
                    rawPasswordForReturn = "123456";
                }

                var user = new User
                {
                    Email = emailToUse,
                    PasswordHash = passwordHash,
                    FullName = (input.StudentName ?? string.Empty).Trim(),
                    IsActive = (input.Status == 1)
                };
                _db.Users.Add(user);
                await _db.SaveChangesAsync(ct); // có UserId

                // 2) Gán ROLE Student (tạo nếu chưa có)
                var studentRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Student", ct);
                if (studentRole == null)
                {
                    studentRole = new Role { Name = "Student" };
                    _db.Roles.Add(studentRole);
                    await _db.SaveChangesAsync(ct);
                }
                _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = studentRole.RoleId });

                // 3) Tạo STUDENT liên kết User vừa tạo
                var student = new StudentInfo
                {
                    StudentName = input.StudentName,
                    ParentName = input.ParentName,
                    PhoneNumber = input.PhoneNumber,
                    Adress = input.Adress,
                    ngayBatDauHoc = input.ngayBatDauHoc,
                    SoBuoiHocDaHoc = input.SoBuoiHocDaHoc,
                    SoBuoiHocConLai = input.SoBuoiHocConLai,
                    Status = input.Status,
                    UserId = user.UserId
                };
                _db.Students.Add(student);
                await _db.SaveChangesAsync(ct); // có StudentId

                // 4) Nếu là auto mode → cập nhật email cuối cùng dựa theo StudentId (giữ nguyên hành vi cũ)
                if (!useCustomEmail)
                {
                    var finalEmail = $"student{student.StudentId}@example.com";
                    var taken = await _db.Users.AnyAsync(u => u.Email == finalEmail && u.UserId != user.UserId, ct);
                    if (taken)
                    {
                        await tx.RollbackAsync(ct);
                        return Conflict(new { message = $"Email {finalEmail} đã tồn tại, không thể tạo tài khoản cho học sinh #{student.StudentId}." });
                    }
                    user.Email = finalEmail;
                    await _db.SaveChangesAsync(ct);
                    finalEmailForReturn = finalEmail;
                }
                else
                {
                    finalEmailForReturn = emailToUse; // đã là email tùy chỉnh
                }

                await tx.CommitAsync(ct);

                // 5) Kết quả
                return Ok(new
                {
                    studentId = student.StudentId,
                    email = finalEmailForReturn,
                    tempPassword = rawPasswordForReturn
                });
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Tạo học viên + tài khoản đăng nhập thất bại.",
                detail = ex.Message
            });
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, StudentInfo input)
    {
        if (id != input.StudentId) return BadRequest();

        var existing = await _db.Students.FindAsync(id);
        if (existing == null) return NotFound();

        existing.StudentName = input.StudentName;
        existing.ParentName = input.ParentName;
        existing.PhoneNumber = input.PhoneNumber;
        existing.Adress = input.Adress;
        existing.ngayBatDauHoc = input.ngayBatDauHoc;
        existing.SoBuoiHocConLai = input.SoBuoiHocConLai;
        existing.SoBuoiHocDaHoc = input.SoBuoiHocDaHoc;

        if (existing.Status != input.Status)
        {
            if (input.Status == 0)
            {
                var affected = await _lifecycle.DeactivateStudentAsync(id);
                return Ok(new { message = $"Đã chuyển học sinh sang nghỉ học, tắt {affected} liên kết lớp." });
            }
            else
            {
                existing.Status = input.Status;
                existing.StatusChangedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Students.FindAsync(id);
        if (item is null) return NotFound();
        _db.Students.Remove(item);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(uidStr, out var myUserId)) return Unauthorized();

        var me = await _db.Students.AsNoTracking()
            .Where(s => s.UserId == myUserId)
            .Select(s => new {
                s.StudentId,
                s.StudentName,
                s.ParentName,
                s.PhoneNumber,
                s.Adress,
                s.ngayBatDauHoc,
                s.SoBuoiHocDaHoc,
                s.SoBuoiHocConLai,
                s.Status,
                s.StatusChangedAt
            })
            .FirstOrDefaultAsync(ct);

        if (me == null) return NotFound(new { message = "Không tìm thấy hồ sơ học sinh gắn với tài khoản này." });
        return Ok(me);
    }

    [HttpPut("me")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> UpdateMe([FromBody] StudentSelfUpdateDto input, CancellationToken ct)
    {
        var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(uidStr, out var myUserId)) return Unauthorized();

        var st = await _db.Students.FirstOrDefaultAsync(s => s.UserId == myUserId, ct);
        if (st == null) return NotFound(new { message = "Không tìm thấy hồ sơ học sinh gắn với tài khoản này." });

        static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

        if (input.StudentName != null) st.StudentName = Clean(input.StudentName)!;
        if (input.ParentName != null) st.ParentName = Clean(input.ParentName)!;
        if (input.PhoneNumber != null) st.PhoneNumber = Clean(input.PhoneNumber)!;
        if (input.Adress != null) st.Adress = Clean(input.Adress)!;

        await _db.SaveChangesAsync(ct);

        var me = await _db.Students.AsNoTracking()
            .Where(s => s.StudentId == st.StudentId)
            .Select(s => new {
                s.StudentId,
                s.StudentName,
                s.ParentName,
                s.PhoneNumber,
                s.Adress,
                s.ngayBatDauHoc,
                s.SoBuoiHocDaHoc,
                s.SoBuoiHocConLai,
                s.Status,
                s.StatusChangedAt
            })
            .FirstAsync(ct);

        return Ok(me);
    }
    // ───── Student tự đổi mật khẩu ────────────────────────────────────────────────
    public sealed class ChangePasswordReq
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    [HttpPost("me/change-password")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> ChangeMyPassword([FromBody] ChangePasswordReq req, CancellationToken ct)
    {
        var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(uidStr, out var myUserId)) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.CurrentPassword))
            return BadRequest(new { message = "Vui lòng nhập mật khẩu hiện tại." });

        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { message = "Mật khẩu mới phải có ít nhất 6 ký tự." });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == myUserId, ct);
        if (user == null) return NotFound(new { message = "Không tìm thấy tài khoản." });

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return StatusCode(403, new { message = "Mật khẩu hiện tại không đúng." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Đổi mật khẩu thành công." });
    }

    // =========================
    // DTO dùng cho import
    // =========================
    public sealed class ImportStudentRow
    {
        public string StudentName { get; set; } = "";
        public string? ParentName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Adress { get; set; }
        public string? ngayBatDauHoc { get; set; } // ISO yyyy-MM-dd
        public int SoBuoiHocDaHoc { get; set; }
        public int SoBuoiHocConLai { get; set; }
        public int Status { get; set; } = 1;
        public string? Email { get; set; }           // optional
        public string? Password { get; set; }        // required if Email present (>=6)
    }

    private static readonly ConcurrentDictionary<string, (int UserId, List<ImportStudentRow> Rows, DateTime ExpireAt)> _staging
        = new ConcurrentDictionary<string, (int, List<ImportStudentRow>, DateTime)>();

    private static string? DmyToIso(string? dmy)
    {
        if (string.IsNullOrWhiteSpace(dmy)) return null;
        var m = Regex.Match(dmy.Trim(), @"^(\d{2})/(\d{2})/(\d{4})$");
        if (!m.Success) return null;
        var dd = int.Parse(m.Groups[1].Value);
        var mm = int.Parse(m.Groups[2].Value);
        var yyyy = int.Parse(m.Groups[3].Value);
        try
        {
            var dt = new DateTime(yyyy, mm, dd);
            return dt.ToString("yyyy-MM-dd");
        }
        catch { return null; }
    }

   
    private record ImportError(int row, string message);

    // Ánh xạ tên cột (VN/EN) -> các alias có thể gặp
    // Lưu ý: tên VN khớp file mẫu: "Tên học sinh", "Tên phụ huynh", ...
    private static readonly Dictionary<string, string[]> ColumnAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["StudentName"] = new[] { "StudentName", "Tên học sinh", "Ten hoc sinh" },
        ["ParentName"] = new[] { "ParentName", "Tên phụ huynh", "Ten phu huynh" },
        ["PhoneNumber"] = new[] { "PhoneNumber", "Số điện thoại", "So dien thoai" },
        ["Adress"] = new[] { "Adress", "Địa chỉ", "Dia chi", "Address" },
        ["ngayBatDauHoc"] = new[] { "ngayBatDauHoc", "Ngày nhập học", "Ngay nhap hoc", "Ngày bắt đầu học", "Ngay bat dau hoc" },
        ["SoBuoiHocDaHoc"] = new[] { "SoBuoiHocDaHoc", "Số buổi đã học", "So buoi da hoc" },
        ["SoBuoiHocConLai"] = new[] {"SoBuoiHocConLai", "Số buổi đã đóng", "So buoi da dong"},
        ["Status"] = new[] { "Status", "Trạng thái", "Trang thai" },
        ["Email"] = new[] { "Email" },
        ["Password"] = new[] { "Password", "Mật khẩu", "Mat khau" },
    };

    // Tìm cột theo alias (không phân biệt hoa thường, bỏ khoảng trắng dư)
    private static DataColumn? FindColumnByAliases(DataTable table, string[] aliases)
    {
        // Ưu tiên tên cột trùng khớp (case-insensitive)
        foreach (var alias in aliases)
        {
            if (table.Columns.Contains(alias)) return table.Columns[alias];
        }
        // Nếu không có trùng tên trực tiếp, duyệt qua tất cả cột để so sánh không phân biệt hoa thường
        foreach (DataColumn c in table.Columns)
        {
            foreach (var alias in aliases)
            {
                if (string.Equals(c.ColumnName?.Trim(), alias.Trim(), StringComparison.OrdinalIgnoreCase))
                    return c;
            }
        }
        return null;
    }

    // Lấy giá trị ô theo alias cột (trả về "" nếu không có)
    private static string GetColValue(DataRow row, DataTable table, string logicalName)
    {
        if (!ColumnAliases.TryGetValue(logicalName, out var aliases)) return "";
        var col = FindColumnByAliases(table, aliases);
        return col == null ? "" : (row[col]?.ToString() ?? "");
    }

    // ===== [POST] /api/Students/import/excel =====
    // ===== [POST] /api/Students/import/excel =====
    [HttpPost("import/excel")]
    [Authorize(Policy = "AdminOnly")]
    [RequestSizeLimit(10_000_000)] // 10MB tuỳ chỉnh
    public async Task<ActionResult> ImportExcel(IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "File trống." });

        // ExcelDataReader cần đăng ký codepages khi đọc .xls (BIFF)
        System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

        var rows = new List<ImportStudentRow>();
        var errors = new List<ImportError>();

        try
        {
            using var stream = file.OpenReadStream();
            using var reader = ExcelReaderFactory.CreateReader(stream);

            var ds = reader.AsDataSet(new ExcelDataSetConfiguration
            {
                ConfigureDataTable = _ => new ExcelDataTableConfiguration
                {
                    UseHeaderRow = true
                }
            });
            if (ds.Tables.Count == 0)
                return BadRequest(new { message = "Không tìm thấy sheet dữ liệu." });

            var table = ds.Tables[0];

            // Kiểm tra các cột bắt buộc phải có trong file
            var requiredLogicalCols = new Dictionary<string, string>
            {
                ["StudentName"] = "Tên học sinh",
                ["ParentName"] = "Tên phụ huynh",
                ["PhoneNumber"] = "Số điện thoại",
                ["Adress"] = "Địa chỉ",
                ["ngayBatDauHoc"] = "Ngày nhập học",
                ["Email"] = "Email",
                ["Password"] = "Mật khẩu"
            };
            foreach (var kv in requiredLogicalCols)
            {
                var logical = kv.Key;
                var vnName = kv.Value;
                var col = FindColumnByAliases(table, ColumnAliases[logical]);
                if (col == null)
                {
                    errors.Add(new ImportError(1, $"Thiếu cột bắt buộc: \"{vnName}\"."));
                }
            }

            if (errors.Count > 0)
            {
                var orderedErrors = errors
                    .OrderBy(e => e.row)
                    .ThenBy(e => e.message)
                    .ToList();
                return BadRequest(new { errors = orderedErrors });
            }

            // Duyệt từng dòng dữ liệu
            for (int i = 0; i < table.Rows.Count; i++)
            {
                var r = table.Rows[i];
                var rowIndex = i + 2;

                var item = new ImportStudentRow
                {
                    StudentName = GetColValue(r, table, "StudentName").Trim(),
                    ParentName = string.IsNullOrWhiteSpace(GetColValue(r, table, "ParentName")) ? null : GetColValue(r, table, "ParentName").Trim(),
                    PhoneNumber = string.IsNullOrWhiteSpace(GetColValue(r, table, "PhoneNumber")) ? null : GetColValue(r, table, "PhoneNumber").Trim(),
                    Adress = string.IsNullOrWhiteSpace(GetColValue(r, table, "Adress")) ? null : GetColValue(r, table, "Adress").Trim(),
                    SoBuoiHocDaHoc = int.TryParse(GetColValue(r, table, "SoBuoiHocDaHoc"), out var sbdh) ? Math.Max(0, sbdh) : 0,
                    SoBuoiHocConLai = int.TryParse(GetColValue(r,table,"SoBuoiHocConLai"), out var sbdd) ? Math.Max(0, sbdd) :0,
                    Status = int.TryParse(GetColValue(r, table, "Status"), out var st) ? (st == 1 ? 1 : 0) : 1,
                    Email = string.IsNullOrWhiteSpace(GetColValue(r, table, "Email")) ? null : GetColValue(r, table, "Email").Trim(),
                    Password = string.IsNullOrWhiteSpace(GetColValue(r, table, "Password")) ? null : GetColValue(r, table, "Password"),
                };

                // Ngày nhập học
                var dmy = GetColValue(r, table, "ngayBatDauHoc").Trim();
                var iso = DmyToIso(dmy);
                if (string.IsNullOrWhiteSpace(dmy) || iso == null)
                    errors.Add(new ImportError(rowIndex, "Ngày nhập học không hợp lệ (định dạng dd/MM/yyyy)."));
                item.ngayBatDauHoc = iso;

                // Validate Tên học sinh
                if (string.IsNullOrWhiteSpace(item.StudentName) || item.StudentName.Length < 1 || item.StudentName.Length >= 60)
                    errors.Add(new ImportError(rowIndex, "Thiếu tên học sinh hoặc tên không phù hợp."));

                // Validate Tên phụ huynh
                if (string.IsNullOrWhiteSpace(item.ParentName) || item.ParentName.Length < 1 || item.ParentName.Length >= 60)
                    errors.Add(new ImportError(rowIndex, "Thiếu tên phụ huynh hoặc tên không phù hợp."));

                // Validate Số điện thoại
                if (string.IsNullOrWhiteSpace(item.PhoneNumber))
                {
                    errors.Add(new ImportError(rowIndex, "Thiếu Số điện thoại."));
                }
                else if (!Regex.IsMatch(item.PhoneNumber, @"^\+?\d{7,15}$"))
                {
                    errors.Add(new ImportError(rowIndex, $"Số điện thoại không hợp lệ: {item.PhoneNumber}"));
                }

                // Validate Địa chỉ
                if (string.IsNullOrWhiteSpace(item.Adress) || item.Adress.Length < 1 || item.Adress.Length > 40)
                    errors.Add(new ImportError(rowIndex, "Thiếu Địa chỉ hoặc Địa chỉ không phù hợp."));

                // Validate Email (bắt buộc)
                if (string.IsNullOrWhiteSpace(item.Email))
                {
                    errors.Add(new ImportError(rowIndex, "Thiếu Email."));
                }
                else if (!IsValidEmail(item.Email))
                {
                    errors.Add(new ImportError(rowIndex, $"Email không hợp lệ: {item.Email}"));
                }

                // Validate Password (bắt buộc nếu có email)
                if (string.IsNullOrWhiteSpace(item.Password) || item.Password!.Length < 6)
                    errors.Add(new ImportError(rowIndex, "Password tối thiểu 6 ký tự."));

                rows.Add(item);
            }

            // Kiểm tra trùng email trong file
            var dupEmails = rows.Where(x => !string.IsNullOrWhiteSpace(x.Email))
                                .GroupBy(x => x.Email!, StringComparer.OrdinalIgnoreCase)
                                .Where(g => g.Count() > 1)
                                .Select(g => g.Key)
                                .ToList();
            foreach (var em in dupEmails)
            {
                for (int i = 0; i < rows.Count; i++)
                    if (string.Equals(rows[i].Email, em, StringComparison.OrdinalIgnoreCase))
                        errors.Add(new ImportError(i + 2, $"Email bị trùng trong file: {em}"));
            }

            // Kiểm tra trùng email với DB
            var emails = rows.Where(x => !string.IsNullOrWhiteSpace(x.Email))
                             .Select(x => x.Email!)
                             .Distinct(StringComparer.OrdinalIgnoreCase)
                             .ToList();
            if (emails.Count > 0)
            {
                var existed = await _db.Users
                    .Where(u => emails.Contains(u.Email))
                    .Select(u => u.Email)
                    .ToListAsync(ct);

                foreach (var exm in existed)
                {
                    for (int i = 0; i < rows.Count; i++)
                        if (string.Equals(rows[i].Email, exm, StringComparison.OrdinalIgnoreCase))
                            errors.Add(new ImportError(i + 2, $"Email đã tồn tại: {exm}"));
                }
            }

            if (errors.Count > 0)
            {
                var orderedErrors = errors
                    .OrderBy(e => e.row)
                    .ThenBy(e => e.message)
                    .ToList();

                return BadRequest(new { errors = orderedErrors });
            }

            // Lưu staging trong bộ nhớ (30 phút)
            var uidStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            _ = int.TryParse(uidStr, out var myUserId);
            var sid = Guid.NewGuid().ToString("N");
            _staging[sid] = (myUserId, rows, DateTime.UtcNow.AddMinutes(30));

            return Ok(new { stagingId = sid, items = rows });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Không đọc được tệp Excel/CSV.", detail = ex.Message });
        }
    }

    // ===== [POST] /api/Students/import/{sid}/commit =====
    // (giữ nguyên phần commit của bạn; chỉ sửa message sang tiếng Việt nếu còn tiếng Anh)
    [HttpPost("import/{sid}/commit")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> CommitImport(string sid, CancellationToken ct)
    {
        if (!_staging.TryGetValue(sid, out var pack) || pack.ExpireAt < DateTime.UtcNow)
            return NotFound(new { message = "Staging đã hết hạn hoặc không tồn tại." });

        var (ownerUserId, rows, _) = pack;

        var strategy = _db.Database.CreateExecutionStrategy();
        try
        {
            return await strategy.ExecuteAsync<ActionResult>(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(ct);

                var studentRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Student", ct);
                if (studentRole == null)
                {
                    studentRole = new Role { Name = "Student" };
                    _db.Roles.Add(studentRole);
                    await _db.SaveChangesAsync(ct);
                }

                int inserted = 0;
                for (int i = 0; i < rows.Count; i++)
                {
                    var r = rows[i];

                    // 1) Tạo user
                    string emailToUse, passwordHash, rawPw;
                    if (!string.IsNullOrWhiteSpace(r.Email))
                    {
                        emailToUse = r.Email!;
                        if (!IsValidEmail(emailToUse))
                            return BadRequest(new { message = $"Dòng {i + 2}: Email không hợp lệ {emailToUse}." });
                        if (string.IsNullOrWhiteSpace(r.Password) || r.Password!.Length < 6)
                            return BadRequest(new { message = $"Dòng {i + 2}: Password tối thiểu 6 ký tự." });

                        var exists = await _db.Users.AnyAsync(u => u.Email == emailToUse, ct);
                        if (exists)
                            return Conflict(new { message = $"Dòng {i + 2}: Email đã tồn tại {emailToUse}." });

                        passwordHash = BCrypt.Net.BCrypt.HashPassword(r.Password);
                        rawPw = r.Password!;
                    }
                    else
                    {
                        emailToUse = $"studenttmp-{Guid.NewGuid():N}@example.com";
                        passwordHash = BCrypt.Net.BCrypt.HashPassword("123456");
                        rawPw = "123456";
                    }

                    var user = new User
                    {
                        Email = emailToUse,
                        PasswordHash = passwordHash,
                        FullName = (r.StudentName ?? "").Trim(),
                        IsActive = (r.Status == 1)
                    };
                    _db.Users.Add(user);
                    await _db.SaveChangesAsync(ct);

                    _db.UserRoles.Add(new UserRole { UserId = user.UserId, RoleId = studentRole.RoleId });

                    // 2) Parse ngayBatDauHoc -> DateOnly (non-nullable vì model của bạn đang là DateOnly)
                    if (string.IsNullOrWhiteSpace(r.ngayBatDauHoc) ||
                        !DateOnly.TryParseExact(r.ngayBatDauHoc, "yyyy-MM-dd", out var startDate))
                    {
                        await tx.RollbackAsync(ct);
                        return BadRequest(new { message = $"Dòng {i + 2}: Ngày nhập học không hợp lệ (yyyy-MM-dd)." });
                    }

                    // 3) Tạo Student
                    var st = new StudentInfo
                    {
                        StudentName = r.StudentName,
                        ParentName = r.ParentName,
                        PhoneNumber = r.PhoneNumber,
                        Adress = r.Adress,
                        ngayBatDauHoc = startDate,
                        SoBuoiHocDaHoc = r.SoBuoiHocDaHoc,
                        SoBuoiHocConLai = r.SoBuoiHocConLai,
                        Status = r.Status,
                        UserId = user.UserId
                    };
                    _db.Students.Add(st);
                    await _db.SaveChangesAsync(ct);

                    // 4) Nếu auto mode → đổi email thành student{Id}@example.com
                    if (string.IsNullOrWhiteSpace(r.Email))
                    {
                        var finalEmail = $"student{st.StudentId}@example.com";
                        var taken = await _db.Users.AnyAsync(u => u.Email == finalEmail && u.UserId != user.UserId, ct);
                        if (taken)
                        {
                            await tx.RollbackAsync(ct);
                            return Conflict(new { message = $"Dòng {i + 2}: Email {finalEmail} đã tồn tại." });
                        }
                        user.Email = finalEmail;
                        await _db.SaveChangesAsync(ct);
                    }

                    inserted++;
                }

                await tx.CommitAsync(ct);
                _staging.TryRemove(sid, out _);
                return Ok(new { inserted });
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Lưu thất bại, đã rollback.", detail = ex.Message });
        }
    }

    // ===== [DELETE] /api/Students/import/{sid} =====
    [HttpDelete("import/{sid}")]
    [Authorize(Policy = "AdminOnly")]
    public IActionResult RollbackImport(string sid)
    {
        _staging.TryRemove(sid, out _);
        return NoContent();
    }

    // ===== [GET] /api/Students/import/template =====
    [HttpGet("import/template")]
    [Authorize(Policy = "AdminOnly")]
    public IActionResult DownloadImportTemplate()
    {
        // 1) Tạo workbook .xlsx bằng ClosedXML
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Students");

        // Header TIẾNG VIỆT khớp BE đang parse khi import
        ws.Cell(1, 1).Value = "Tên học sinh";
        ws.Cell(1, 2).Value = "Tên phụ huynh";
        ws.Cell(1, 3).Value = "Số điện thoại";
        ws.Cell(1, 4).Value = "Địa chỉ";
        ws.Cell(1, 5).Value = "Ngày nhập học";   // dd/MM/yyyy
        ws.Cell(1, 6).Value = "Số buổi đã học";
        ws.Cell(1, 7).Value = "Số buổi đã đóng";
        ws.Cell(1, 8).Value = "Trạng thái";      // 0/1
        ws.Cell(1, 9).Value = "Email";
        ws.Cell(1, 10).Value = "Password";        // >=6 nếu có Email

        // Ví dụ 1–2 dòng mẫu
        ws.Cell(2, 1).Value = "Nguyen Van A";
        ws.Cell(2, 2).Value = "Nguyen Van B";
        ws.Cell(2, 3).Value = "0901234567";
        ws.Cell(2, 4).Value = "123 Duong ABC";
        ws.Cell(2, 5).Value = "01/10/2025"; // dd/MM/yyyy
        ws.Cell(2, 6).Value = 0;
        ws.Cell(2, 7).Value = 3;
        ws.Cell(2, 8).Value = 1;

        ws.Cell(3, 1).Value = "Tran Thi C";
        ws.Cell(3, 2).Value = "Tran Van D";
        ws.Cell(3, 3).Value = "0912345678";
        ws.Cell(3, 4).Value = "45 Pho XYZ";
        ws.Cell(3, 5).Value = "15/10/2025";
        ws.Cell(3, 6).Value = 2;
        ws.Cell(3, 7).Value = 3;
        ws.Cell(2, 8).Value = 1;
        ws.Cell(3, 9).Value = "user@example.com";
        ws.Cell(3, 10).Value = "abc123";

        // Format cơ bản
        ws.Columns().AdjustToContents();

        // 3) Xuất ra memory stream
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;

        // 4) Set Content-Disposition chỉ với filename= để tránh 'filename*=' dài dòng
        Response.Headers.Remove(HeaderNames.ContentDisposition);
        Response.Headers.Append(
            HeaderNames.ContentDisposition,
            "attachment; filename=\"mau-import-hocvien.xlsx\""
        );

        // 5) Trả file .xlsx
        return File(
            ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

}
