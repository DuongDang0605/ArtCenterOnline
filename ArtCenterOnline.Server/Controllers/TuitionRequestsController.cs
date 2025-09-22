using System.Security.Claims;
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO.Tuition;
using ArtCenterOnline.Server.Model.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArtCenterOnline.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TuitionRequestsController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public TuitionRequestsController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        private int? GetUserId()
        {
            var v = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("uid")
                ?? User.FindFirstValue("UserId");
            return int.TryParse(v, out var id) ? id : null;
        }

        // ========== STUDENT ==========

        /// <summary>Student: tạo yêu cầu mới (multipart: file = image)</summary>
        [HttpPost]
        [Authorize(Roles = "Student")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(6_000_000)] // 6MB trần để có thông báo đẹp hơn
        public async Task<IActionResult> Create([FromForm] TuitionUploadForm form, CancellationToken ct)
            {
            var file = form.file;                              // LẤY FILE TỪ FORM
            if (file == null) return BadRequest("Thiếu ảnh minh chứng (file).");
            if (file.Length == 0) return BadRequest("File rỗng.");
            if (file.Length > 5_000_000) return BadRequest("Ảnh vượt quá 5MB.");

            var contentType = file.ContentType?.ToLowerInvariant() ?? "";
            var okType = contentType == "image/jpeg" || contentType == "image/jpg" || contentType == "image/png";
            if (!okType) return BadRequest("Chỉ chấp nhận ảnh JPG/PNG.");

            // Xác định Student
            var userId = GetUserId();
            if (userId == null) return Forbid();

            var student = await _db.Students
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.UserId == userId, ct);

            if (student == null) return NotFound("Không tìm thấy học viên tương ứng tài khoản.");

            // Chặn nếu đã có Pending
            var hasPending = await _db.TuitionPaymentRequests
                .AnyAsync(x => x.StudentId == student.StudentId && x.Status == TuitionRequestStatus.Pending, ct);
            if (hasPending) return Conflict("Bạn đang có yêu cầu Chờ duyệt.");

            // Lưu file
            var uploadsDir = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
                                          "uploads", "tuition");
            Directory.CreateDirectory(uploadsDir);

            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrWhiteSpace(ext))
                ext = contentType.Contains("png") ? ".png" : ".jpg";
            var fileName = $"{Guid.NewGuid():N}{ext}";
            var absPath = Path.Combine(uploadsDir, fileName);

            await using (var fs = System.IO.File.Create(absPath))
            {
                await file.CopyToAsync(fs, ct);
            }

            var req = new TuitionPaymentRequest
            {
                StudentId = student.StudentId,
                EmailSnapshot = student.User?.Email ?? "",
                ImagePath = $"/uploads/tuition/{fileName}",
                ImageContentType = contentType,
                ImageSizeBytes = file.Length,
                Status = TuitionRequestStatus.Pending,
                CreatedAtUtc = DateTime.UtcNow
            };

            _db.TuitionPaymentRequests.Add(req);
            await _db.SaveChangesAsync(ct);

            return Ok(new { id = req.Id, message = "Đã tạo yêu cầu. Vui lòng chờ duyệt." });
        }

        /// <summary>Student: danh sách yêu cầu của chính mình</summary>
        [HttpGet("my")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> MyList(CancellationToken ct)
        {
            var userId = GetUserId();
            if (userId == null) return Forbid();

            var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
            if (student == null) return NotFound("Không tìm thấy học viên.");

            var data = await _db.TuitionPaymentRequests
                .Where(x => x.StudentId == student.StudentId)
                .OrderByDescending(x => x.CreatedAtUtc)
                .Select(x => new TuitionRequestListItemDto
                {
                    Id = x.Id,
                    StudentId = x.StudentId,
                    StudentName = "", // FE có thể hiển thị tên từ profile hiện tại
                    Email = x.EmailSnapshot,
                    Status = x.Status.ToString(),
                    CreatedAtUtc = x.CreatedAtUtc,
                    ReviewedAtUtc = x.ReviewedAtUtc
                })
                .ToListAsync(ct);

            return Ok(data);
        }

        /// <summary>Student: tự hủy khi còn Pending</summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> Cancel(int id, CancellationToken ct)
        {
            var userId = GetUserId();
            if (userId == null) return Forbid();

            var student = await _db.Students.FirstOrDefaultAsync(s => s.UserId == userId, ct);
            if (student == null) return NotFound();

            var req = await _db.TuitionPaymentRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (req == null) return NotFound();

            if (req.StudentId != student.StudentId) return Forbid();
            if (req.Status != TuitionRequestStatus.Pending) return Conflict("Chỉ hủy được khi đang Chờ duyệt.");

            req.Status = TuitionRequestStatus.Canceled;
            req.ReviewedAtUtc = DateTime.UtcNow;

            await _db.SaveChangesAsync(ct);
            return Ok(new { message = "Đã hủy yêu cầu." });
        }

        /// <summary>Student/Admin: xem ảnh</summary>
        [HttpGet("{id:int}/image")]
        [Authorize] // cả Admin & chủ sở hữu xem được
        public async Task<IActionResult> GetImage(int id, CancellationToken ct)
        {
            var req = await _db.TuitionPaymentRequests
                .Include(r => r.Student)
                .ThenInclude(s => s.User)
                .FirstOrDefaultAsync(x => x.Id == id, ct);
            if (req == null) return NotFound();

            var isAdmin = User.IsInRole("Admin");
            var userId = GetUserId();

            if (!isAdmin)
            {
                if (req.Student.UserId != userId) return Forbid();
            }

            if (string.IsNullOrWhiteSpace(req.ImagePath))
                return NotFound("Không có ảnh.");

            var physical = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
                                        req.ImagePath.TrimStart('/').Replace("/", Path.DirectorySeparatorChar.ToString()));
            if (!System.IO.File.Exists(physical)) return NotFound("Ảnh không tồn tại trên máy chủ.");

            var stream = System.IO.File.OpenRead(physical);
            return File(stream, req.ImageContentType ?? "application/octet-stream");
        }

        // ========== ADMIN ==========

        /// <summary>Admin: danh sách theo status</summary>
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> List([FromQuery] string? status, CancellationToken ct)
        {
            IQueryable<TuitionPaymentRequest> q = _db.TuitionPaymentRequests
                .Include(x => x.Student);

            if (!string.IsNullOrWhiteSpace(status))
            {
                var s = status.Trim().ToLowerInvariant();
                if (s != "all")
                {
                    if (Enum.TryParse<TuitionRequestStatus>(status, ignoreCase: true, out var st))
                        q = q.Where(x => x.Status == st);
                    else if (s == "notpending")
                        q = q.Where(x => x.Status != TuitionRequestStatus.Pending);
                    else if (s == "pending")
                        q = q.Where(x => x.Status == TuitionRequestStatus.Pending);
                }
            }

            var data = await q.OrderByDescending(x => x.CreatedAtUtc)
                .Select(x => new TuitionRequestListItemDto
                {
                    Id = x.Id,
                    StudentId = x.StudentId,
                    StudentName = x.Student.StudentName,
                    Email = x.EmailSnapshot,
                    Status = x.Status.ToString(),
                    CreatedAtUtc = x.CreatedAtUtc,
                    ReviewedAtUtc = x.ReviewedAtUtc
                })
                .ToListAsync(ct);

            return Ok(data);
        }

        /// <summary>Admin: chi tiết 1 yêu cầu</summary>
        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Detail(int id, CancellationToken ct)
        {
            var x = await _db.TuitionPaymentRequests
                .Include(r => r.Student)
                .FirstOrDefaultAsync(r => r.Id == id, ct);
            if (x == null) return NotFound();

            var dto = new TuitionRequestDetailDto
            {
                Id = x.Id,
                StudentId = x.StudentId,
                StudentName = x.Student.StudentName,
                Email = x.EmailSnapshot,
                Status = x.Status.ToString(),
                CreatedAtUtc = x.CreatedAtUtc,
                ReviewedAtUtc = x.ReviewedAtUtc,
                ReviewedByUserId = x.ReviewedByUserId,
                RejectReason = x.RejectReason,
                ImageContentType = x.ImageContentType,
                ImageSizeBytes = x.ImageSizeBytes,
                ImageUrl = $"/api/tuitionrequests/{x.Id}/image"
            };
            return Ok(dto);
        }

        /// <summary>Admin: duyệt & cộng số buổi đã đóng (SoBuoiHocConLai)</summary>
        // using Microsoft.EntityFrameworkCore;  // chắc chắn đã có

        [HttpPost("{id:int}/approve")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Approve(int id, [FromBody] ApproveTuitionRequestDto body, CancellationToken ct)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            var strategy = _db.Database.CreateExecutionStrategy();
            IActionResult? result = null;

            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(ct);

                var req = await _db.TuitionPaymentRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (req == null) { result = NotFound(); return; }

                if (req.Status != TuitionRequestStatus.Pending) { result = Conflict("Yêu cầu đã được xử lý."); return; }

                var student = await _db.Students.FirstOrDefaultAsync(s => s.StudentId == req.StudentId, ct);
                if (student == null) { result = NotFound("Không tìm thấy học viên."); return; }

                student.SoBuoiHocConLai += body.SessionsToAdd;

                req.Status = TuitionRequestStatus.Approved;
                req.ReviewedAtUtc = DateTime.UtcNow;
                req.ReviewedByUserId = GetUserId();

                await _db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                result = Ok(new { message = $"Đã duyệt và cộng {body.SessionsToAdd} buổi." });
            });

            return result!;
        }

        [HttpPost("{id:int}/reject")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Reject(int id, [FromBody] RejectTuitionRequestDto body, CancellationToken ct)
        {
            var strategy = _db.Database.CreateExecutionStrategy();
            IActionResult? result = null;

            await strategy.ExecuteAsync(async () =>
            {
                await using var tx = await _db.Database.BeginTransactionAsync(ct);

                var req = await _db.TuitionPaymentRequests.FirstOrDefaultAsync(x => x.Id == id, ct);
                if (req == null) { result = NotFound(); return; }

                if (req.Status != TuitionRequestStatus.Pending) { result = Conflict("Yêu cầu đã được xử lý."); return; }

                req.Status = TuitionRequestStatus.Rejected;
                req.ReviewedAtUtc = DateTime.UtcNow;
                req.ReviewedByUserId = GetUserId();
                req.RejectReason = string.IsNullOrWhiteSpace(body?.Reason) ? null : body!.Reason!.Trim();

                await _db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);

                result = Ok(new { message = "Đã từ chối yêu cầu." });
            });

            return result!;
        }

    }
}
