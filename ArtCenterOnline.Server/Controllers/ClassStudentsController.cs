using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClosedXML.Excel;
using System.IO;
using Microsoft.Net.Http.Headers;

namespace ArtCenterOnline.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize] // bắt buộc đăng nhập
public class ClassStudentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ClassStudentsController(AppDbContext db) => _db = db;

    private bool IsAdmin => User.IsInRole("Admin");
    private IActionResult Msg(int status, string message) => StatusCode(status, new { message });

    public sealed class ClassStudentBatchAddDto
    {
        public int ClassID { get; set; }
        public List<int> StudentIds { get; set; } = new();
    }

    public sealed class ClassStudentSetActiveDto
    {
        public bool IsActive { get; set; }
    }

    // Thêm 1 học viên vào lớp — yêu cầu Admin; Teacher sẽ nhận message rõ ràng (409 + message)
    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Add([FromBody] ClassStudent? input)
    {
        if (!IsAdmin)
            return Msg(409, "Chỉ Admin được thêm học viên vào lớp.");

        var errors = new List<string>();
        if (input is null)
        {
            errors.Add("Thiếu body.");
        }
        else
        {
            var cls = await _db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.ClassID == input.ClassID);
            if (cls is null) errors.Add($"Không tồn tại lớp #{input.ClassID}.");

            var stu = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.StudentId == input.StudentId);
            if (stu is null) errors.Add($"Không tìm thấy học viên #{input.StudentId}.");
            else if (stu.Status == 0) errors.Add("Học viên đang nghỉ hệ thống (Status=0), không thể thêm vào lớp.");

            var exists = await _db.ClassStudents
                .AnyAsync(x => x.ClassID == input.ClassID && x.StudentId == input.StudentId);
            if (exists) errors.Add("Học viên đã có trong lớp.");
        }

        if (errors.Count > 0)
        {
            var pd = new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["General"] = errors.ToArray()
            });
            return ValidationProblem(pd);
        }

        if (input!.JoinedDate == default)
            input.JoinedDate = DateOnly.FromDateTime(DateTime.UtcNow);
        input.IsActive = true;

        _db.ClassStudents.Add(input);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // Thêm nhiều học viên — Admin; Teacher nhận message
    [HttpPost("batch")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> BatchAdd([FromBody] ClassStudentBatchAddDto? dto)
    {
        if (!IsAdmin)
            return Msg(409, "Chỉ Admin được thêm học viên vào lớp.");

        if (dto is null || dto.StudentIds.Count == 0)
            return BadRequest(new { message = "Danh sách học viên trống." });

        var cls = await _db.Classes.FindAsync(dto.ClassID);
        if (cls == null) return NotFound(new { message = "Không tìm thấy lớp." });

        // Lọc học sinh đang active toàn hệ thống
        var activeStudents = await _db.Students
            .Where(s => dto.StudentIds.Contains(s.StudentId) && s.Status == 1)
            .Select(s => s.StudentId)
            .ToListAsync();

        var existingIds = await _db.ClassStudents
            .Where(x => x.ClassID == dto.ClassID && activeStudents.Contains(x.StudentId))
            .Select(x => x.StudentId)
            .ToListAsync();

        var toAddIds = activeStudents.Except(existingIds).ToList();
        if (toAddIds.Count == 0)
            return Ok(new { added = 0, note = "Không có học viên hợp lệ để thêm." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rows = toAddIds.Select(id => new ClassStudent
        {
            ClassID = dto.ClassID,
            StudentId = id,
            JoinedDate = today,
            IsActive = true,
        });

        _db.ClassStudents.AddRange(rows);
        await _db.SaveChangesAsync();
        return Ok(new { added = toAddIds.Count });
    }

    // Danh sách học viên trong lớp — Admin & Teacher
    // Danh sách học viên trong lớp — Admin & Teacher
    [HttpGet("in-class/{classId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<object>>> GetInClass(int classId)
    {
        var q =
            from cs in _db.ClassStudents
            join s in _db.Students on cs.StudentId equals s.StudentId
            join c in _db.Classes on cs.ClassID equals c.ClassID
            where cs.ClassID == classId
            orderby s.StudentName
            select new
            {
                cs.ClassID,
                cs.StudentId,

                // Thông tin lớp + học viên
                ClassName = c.ClassName,
                StudentName = s.StudentName,

                // ✅ Trả đủ các trường “ở giữa” mà bảng đang hiển thị
                ParentName = s.ParentName,
                PhoneNumber = s.PhoneNumber,
                Adress = s.Adress,          // (đúng chính tả theo model)
                ngayBatDauHoc = s.ngayBatDauHoc, // (giữ tên y hệt model để FE đọc được)

                // Trạng thái trong lớp
                cs.IsActive,
                cs.JoinedDate,
                cs.Note
            };

        var data = await q.AsNoTracking().ToListAsync();
        return Ok(data);
    }

    // Bật/tắt IsActive — Admin; Teacher nhận message rõ ràng
    [HttpPut("{classId:int}/{studentId:int}/active")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> SetActive(int classId, int studentId, [FromBody] ClassStudentSetActiveDto? dto)
    {
        if (!IsAdmin)
            return Msg(409, "Chỉ Admin được bật/tắt trạng thái học viên trong lớp.");

        if (dto is null) return BadRequest(new { message = "Thiếu body { isActive }." });

        var row = await _db.ClassStudents
            .SingleOrDefaultAsync(x => x.ClassID == classId && x.StudentId == studentId);
        if (row == null) return NotFound(new { message = "Không tìm thấy liên kết lớp–học viên." });

        var student = await _db.Students.AsNoTracking().FirstOrDefaultAsync(s => s.StudentId == studentId);
        if (student == null) return NotFound(new { message = "Không tìm thấy học viên." });
        if (dto.IsActive && student.Status == 0)
            return Conflict(new { message = "Học viên đã nghỉ hệ thống (Status=0). Không thể kích hoạt trong lớp." });

        if (dto.IsActive == row.IsActive)
            return Ok(new { ok = false, isActive = row.IsActive, note = "Trạng thái không thay đổi." });

        row.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return Ok(new { ok = true, isActive = row.IsActive });
    }

    // Loại học viên khỏi lớp — Admin; Teacher nhận message
    [HttpDelete("{classId:int}/{studentId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Remove(int classId, int studentId)
    {
        if (!IsAdmin)
            return Msg(409, "Chỉ Admin được xoá học viên khỏi lớp.");

        var row = await _db.ClassStudents
            .SingleOrDefaultAsync(x => x.ClassID == classId && x.StudentId == studentId);

        if (row == null) return NotFound(new { message = "Không tìm thấy liên kết lớp–học viên." });
        _db.ClassStudents.Remove(row);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    // DTO Import Excel
    public sealed class ImportClassStudentRow
    {
        public int Row { get; set; }
        public string ClassName { get; set; } = "";
        public string Branch { get; set; } = "";
        public string Email { get; set; } = "";
        public string StudentName { get; set; } = "";
        public string Note { get; set; } = "";     // Ghi chú (Đỏ: đã có, Xanh: tái kích hoạt)
        public string Error { get; set; } = "";    // Lỗi nếu có
        public int? StudentId { get; set; }        // Id học viên nếu tìm thấy
    }

    // ===== [POST] /api/ClassStudents/import-excel/{classId} =====
    [HttpPost("import-excel/{classId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ImportExcel(int classId, IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return Ok(new { errors = new[] { new { row = 1, error = "Không có file Excel." } } });
        }

        var cls = await _db.Classes.AsNoTracking().FirstOrDefaultAsync(c => c.ClassID == classId);
        if (cls == null)
        {
            return Ok(new { errors = new[] { new { row = 1, error = $"Không tìm thấy lớp #{classId}." } } });
        }

        var rows = new List<ImportClassStudentRow>();
        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream);
            stream.Position = 0;
            using var workbook = new XLWorkbook(stream);
            var ws = workbook.Worksheets.First();

            string classNameFromFile = ws.Cell(1, 2).GetString().Trim();
            string branchFromFile = ws.Cell(2, 2).GetString().Trim();

            if (!string.Equals(classNameFromFile, cls.ClassName, StringComparison.OrdinalIgnoreCase))
                return Ok(new { errors = new[] { new { row = 1, error = "Tên lớp trong file không khớp DB." } } });

            if (!string.Equals(branchFromFile, cls.Branch ?? "", StringComparison.OrdinalIgnoreCase))
                return Ok(new { errors = new[] { new { row = 2, error = "Cơ sở trong file không khớp DB." } } });

            int rowIndex = 5;
            while (!ws.Cell(rowIndex, 1).IsEmpty())
            {
                rows.Add(new ImportClassStudentRow
                {
                    Row = rowIndex,
                    ClassName = classNameFromFile,
                    Branch = branchFromFile,
                    Email = ws.Cell(rowIndex, 1).GetString().Trim(),
                    StudentName = ws.Cell(rowIndex, 2).GetString().Trim()
                });
                rowIndex++;
            }
        }
        catch (Exception ex)
        {
            return Ok(new { errors = new[] { new { row = 1, error = "File Excel không hợp lệ: " + ex.Message } } });
        }

        var errors = new List<ImportClassStudentRow>();
        var pending = new List<ImportClassStudentRow>();

        foreach (var r in rows)
        {
            if (string.IsNullOrWhiteSpace(r.Email) || !r.Email.Contains("@"))
            {
                r.Error = "Email rỗng hoặc sai định dạng";
                errors.Add(r); continue;
            }

            var stu = await _db.Students
                .AsNoTracking()
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.User != null && s.User.Email == r.Email);

            if (stu == null) { r.Error = "Không tìm thấy học viên"; errors.Add(r); continue; }
            r.StudentId = stu.StudentId;

            if (stu.Status == 0) { r.Error = "Học viên đã nghỉ học"; errors.Add(r); continue; }

            if (!string.Equals(stu.StudentName?.Trim(), r.StudentName, StringComparison.OrdinalIgnoreCase))
            { r.Error = "Tên không khớp với hệ thống"; errors.Add(r); continue; }

            var exists = await _db.ClassStudents
                .FirstOrDefaultAsync(x => x.ClassID == classId && x.StudentId == stu.StudentId);

            if (exists != null)
            {
                if (exists.IsActive) r.Note = "Đã có trong lớp";
                else r.Note = "Cập nhật lại trạng thái học sinh trong lớp";
            }

            pending.Add(r);
        }

        if (errors.Count > 0) return Ok(new { errors });
        return Ok(new { pending });
    }

    // ===== [POST] /api/ClassStudents/import-excel/{classId}/commit =====
    [HttpPost("import-excel/{classId:int}/commit")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CommitImportExcel(int classId, [FromBody] List<ImportClassStudentRow> rows)
    {
        if (rows == null || rows.Count == 0)
            return BadRequest(new { message = "Không có dữ liệu để lưu." });

        int added = 0, reactivated = 0;

        foreach (var r in rows)
        {
            if (r.StudentId == null) continue;

            var existing = await _db.ClassStudents
                .FirstOrDefaultAsync(x => x.ClassID == classId && x.StudentId == r.StudentId);

            if (existing != null)
            {
                if (!existing.IsActive && r.Note == "Cập nhật lại trạng thái học sinh trong lớp")
                {
                    existing.IsActive = true;
                    reactivated++;
                }
            }
            else
            {
                _db.ClassStudents.Add(new ClassStudent
                {
                    ClassID = classId,
                    StudentId = r.StudentId.Value,
                    IsActive = true
                });
                added++;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { added, reactivated });
    }
    [HttpGet("import/template/{classId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DownloadImportTemplate(int classId)
    {
        var cls = await _db.Classes
            .FirstOrDefaultAsync(c => c.ClassID == classId);

        if (cls == null)
        {
            return NotFound(new { message = $"Không tìm thấy lớp #{classId}" });
        }

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("ImportClassStudents");

        // --- Tiêu đề lớp & cơ sở ---
        ws.Cell(1, 1).Value = "Tên lớp:";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 2).Value = cls.ClassName;
        ws.Cell(1, 2).Style.Font.Bold = true;

        ws.Cell(2, 1).Value = "Cơ sở:";
        ws.Cell(2, 1).Style.Font.Bold = true;
        ws.Cell(2, 2).Value = cls.Branch ?? "N/A";
        ws.Cell(2, 2).Style.Font.Bold = true;

        // --- Hướng dẫn ---
        ws.Cell(3, 1).Value = "Bắt đầu nhập danh sách học viên từ dòng 5 ↓";
        ws.Range(3, 1, 3, 2).Merge();
        ws.Cell(3, 1).Style.Font.Italic = true;
        ws.Cell(3, 1).Style.Font.FontColor = XLColor.DarkGray;

        // --- Header ---
        ws.Cell(4, 1).Value = "Email";
        ws.Cell(4, 2).Value = "Tên học viên";
        var headerRange = ws.Range(4, 1, 4, 2);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
        headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        // --- Ví dụ ---
        ws.Cell(5, 1).Value = "hocvien1@example.com";
        ws.Cell(5, 2).Value = "Nguyen Van A";

        ws.Cell(6, 1).Value = "hocvien2@example.com";
        ws.Cell(6, 2).Value = "Tran Thi B";

        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;

        Response.Headers.Remove(HeaderNames.ContentDisposition);
        Response.Headers.Append(
            HeaderNames.ContentDisposition,
            $"attachment; filename=\"mau-import-hocvien-lop-{cls.ClassID}.xlsx\""
        );

        return File(
            ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }




}
