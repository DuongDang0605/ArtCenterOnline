// Controllers/ClassesController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Model.DTO;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

#nullable enable

[ApiController]
[Route("api/[controller]")]
[Authorize] // giữ nguyên yêu cầu đăng nhập
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClassesController(AppDbContext db)
    {
        _db = db;
    }

    // ====== DTO (KHÔNG còn trường GV chính) ======
    public record ClassDto(
        int ClassID,
        string ClassName,
        DateTime? DayStart,
        string Branch,
        int Status
    );

    private static ClassDto ToDto(ClassInfo c)
        => new(
            c.ClassID,
            c.ClassName,
            c.DayStart, // Fix: handle nullable DateTime
            c.Branch,
            c.Status
        );

    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    // ====== LIST ======
    [HttpGet]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<IEnumerable<ClassDto>>> GetAll()
    {
        var items = await _db.Classes
            .AsNoTracking()
            .Select(c => new ClassDto(
                c.ClassID,
                c.ClassName,
                c.DayStart ?? default, // Fix: handle nullable DateTime
                c.Branch,
                c.Status))
            .ToListAsync();

        return Ok(items);
    }

    // ====== DETAIL ======
    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<ActionResult<ClassDto>> Get(int id)
    {
        var item = await _db.Classes
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.ClassID == id);

        return item is null ? NotFound() : Ok(ToDto(item));
    }

    // ====== CREATE ======
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ClassDto>> Create([FromBody] ClassDto input, CancellationToken ct)
    {
        var entity = new ClassInfo
        {
            ClassName = input.ClassName?.Trim(),
            Branch = input.Branch?.Trim(),
            Status = input.Status,
            DayStart = (input.DayStart?.Date) ?? DateTime.Today // mặc định hôm nay
        };

        _db.Classes.Add(entity);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = entity.ClassID }, ToDto(entity));
    }


    // ====== UPDATE (KHÔNG còn logic đổi GV chính) ======
    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassInfo payload, CancellationToken ct)
    {
        var strategy = _db.Database.CreateExecutionStrategy();

        // Bọc toàn bộ thao tác (kể cả transaction) trong execution strategy để có thể retry an toàn
        return await strategy.ExecuteAsync<IActionResult>(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var item = await _db.Classes.FirstOrDefaultAsync(c => c.ClassID == id, ct);
            if (item is null)
            {
                // Không có thay đổi nào; transaction sẽ tự dispose.
                return NotFound();
            }

            var oldStatus = item.Status;

            // Cập nhật các trường…
            item.ClassName = payload.ClassName?.Trim() ?? item.ClassName;
            item.Branch = payload.Branch?.Trim() ?? item.Branch;
            item.DayStart = payload.DayStart == default ? item.DayStart : payload.DayStart;
            item.Status = payload.Status; // 0=dừng, 1=đang hoạt động, …

            await _db.SaveChangesAsync(ct);

            int cancelled = 0;
            if (oldStatus == 1 && item.Status == 0)
            {
                // QUAN TRỌNG: phương thức này nên dùng CÙNG DbContext (_db) và KHÔNG tự mở transaction riêng.
                cancelled = await CancelFutureSessionsForClassAsync(item.ClassID, ct);

                // Nếu CancelFutureSessionsForClassAsync KHÔNG gọi SaveChanges bên trong, hãy giữ dòng dưới:
                // await _db.SaveChangesAsync(ct);
            }

            await tx.CommitAsync(ct);

            if (oldStatus == 1 && item.Status == 0)
            {
                return Ok(new
                {
                    message = $"Đã cập nhật lớp và huỷ {cancelled} buổi từ thời điểm tắt.",
                    classId = item.ClassID,
                    cancelled
                });
            }

            return Ok(new { message = "Đã cập nhật lớp.", classId = item.ClassID });
        });
    }



    // Hủy tất cả buổi của lớp từ "bây giờ" trở đi (tính theo local time).
    private async Task<int> CancelFutureSessionsForClassAsync(int classId, CancellationToken ct = default)
    {
        var nowLocal = DateTime.Now;
        var today = DateOnly.FromDateTime(nowLocal);
        var nowSpan = new TimeSpan(nowLocal.Hour, nowLocal.Minute, 0);

        var sessions = await _db.ClassSessions
            .Where(s => s.ClassID == classId
                        && s.Status != SessionStatus.Cancelled
                        && (s.SessionDate > today
                            || (s.SessionDate == today && s.StartTime >= nowSpan)))
            .ToListAsync(ct);

        if (sessions.Count == 0) return 0;

        string stamp = $"{nowLocal:dd/MM/yyyy HH:mm}";
        foreach (var s in sessions)
        {
            s.Status = SessionStatus.Cancelled;
            s.Note = string.IsNullOrWhiteSpace(s.Note)
                ? $"(Huỷ do lớp bị tắt lúc {stamp})"
                : $"{s.Note} | Huỷ do lớp bị tắt lúc {stamp}";
        }

        await _db.SaveChangesAsync(ct);
        return sessions.Count;
    }

    [HttpGet("{classId}/active-students-for-withdraw")]
    public async Task<ActionResult<ActiveStudentsForWithdrawDto>> GetActiveStudentsForWithdraw(
       int classId,
       [FromQuery] string? search,
       [FromQuery] int page = 1,
       [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize <= 0 || pageSize > 100) pageSize = 20;

        // Lấy tổng HS đang active trong lớp (không áp dụng search để tính y)
        var baseInClassQuery = _db.ClassStudents
            .Where(cs => cs.ClassID == classId && cs.IsActive);

        var totalActiveInClass = await baseInClassQuery.CountAsync();

        // Join sang StudentInfo và UserInfo để lấy email
        var q = from cs in _db.ClassStudents
                where cs.ClassID == classId && cs.IsActive
                join s in _db.Students on cs.StudentId equals s.StudentId
                join u in _db.Users on s.UserId equals u.UserId
                select new
                {
                    StudentId = s.StudentId,
                    FullName = s.StudentName,    // hoặc StudentName nếu bạn đã rename
                    Email = u.Email
                };


        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            q = q.Where(x => x.FullName.ToLower().Contains(term));
        }

        var totalAfterSearch = await q.CountAsync();

        var pageItems = await q
            .OrderBy(x => x.FullName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Lấy danh sách id để tính số lớp active
        var ids = pageItems.Select(i => i.StudentId).ToList();

        var counts = await _db.ClassStudents
            .Where(cs => ids.Contains(cs.StudentId) && cs.IsActive)
            .GroupBy(cs => cs.StudentId)
            .Select(g => new { StudentId = g.Key, Cnt = g.Count() })
            .ToDictionaryAsync(x => x.StudentId, x => x.Cnt);

        var items = pageItems.Select(i =>
        {
            var cnt = counts.TryGetValue(i.StudentId, out var c) ? c : 0;
            return new WithdrawListItemDto
            {
                StudentId = i.StudentId,
                FullName = i.FullName ?? "",
                Email = i.Email ?? "",
                ActiveClassCount = cnt,
                Note = cnt > 1 ? $"Còn học lớp khác ({cnt} lớp) — rời lớp hiện tại, KHÔNG rời trung tâm" : "Sẽ rời trung tâm (không còn lớp nào khác)",
                Selectable = true   // <-- luôn có thể chọn để rời lớp hiện tại
            }
       ;
        }).ToList();

        var className = await _db.Classes
            .Where(c => c.ClassID == classId)
            .Select(c => c.ClassName)
            .FirstOrDefaultAsync() ?? "";

        return Ok(new ActiveStudentsForWithdrawDto
        {
            ClassId = classId,
            ClassName = className,
            Page = page,
            PageSize = pageSize,
            Total = totalAfterSearch,
            TotalActiveInClass = totalActiveInClass,
            Items = items
        });
    }

    [HttpPost("{classId}/bulk-withdraw")]
    public async Task<ActionResult<BulkWithdrawResultDto>> BulkWithdraw(
    int classId,
    [FromBody] BulkWithdrawRequestDto req)
    {
        var res = new BulkWithdrawResultDto();

        if (req?.StudentIds == null || req.StudentIds.Count == 0)
            return Ok(res);

        // Chỉ lấy những học sinh còn active trong lớp này
        var validIds = await _db.ClassStudents
            .Where(cs => cs.ClassID == classId && cs.IsActive && req.StudentIds.Contains(cs.StudentId))
            .Select(cs => cs.StudentId)
            .Distinct()
            .ToListAsync();

        foreach (var studentId in req.StudentIds.Distinct())
        {
            if (!validIds.Contains(studentId))
            {
                res.Failed.Add(new BulkWithdrawItemResult
                {
                    StudentId = studentId,
                    Ok = false,
                    Error = "Student not active in this class"
                });
                continue;
            }

            try
            {
                // 1. Tắt ClassStudent của lớp hiện tại (idempotent)
                var inThisClass = await _db.ClassStudents
                    .Where(cs => cs.ClassID == classId && cs.StudentId == studentId && cs.IsActive)
                    .ToListAsync();

                foreach (var cs in inThisClass)
                    cs.IsActive = false;

                await _db.SaveChangesAsync();

                // 2. Kiểm tra còn lớp active nào khác không
                var stillActiveElsewhere = await _db.ClassStudents
                    .AnyAsync(cs => cs.StudentId == studentId && cs.IsActive);

                bool deactivatedAll = false;

                if (!stillActiveElsewhere)
                {
                    // Tắt Student (Status=0) và User (IsActive=false)
                    var stu = await _db.Students.FirstOrDefaultAsync(s => s.StudentId == studentId);
                    if (stu != null) stu.Status = 0;

                    if (stu != null && stu.UserId != 0)
                    {
                        var usr = await _db.Users.FirstOrDefaultAsync(u => u.UserId == stu.UserId);
                        if (usr != null) usr.IsActive = false;
                    }

                    await _db.SaveChangesAsync();
                    deactivatedAll = true;
                }

                res.Processed.Add(new BulkWithdrawItemResult
                {
                    StudentId = studentId,
                    Ok = true,
                    DeactivatedAll = deactivatedAll
                });
            }
            catch (DbUpdateConcurrencyException)
            {
                res.Failed.Add(new BulkWithdrawItemResult
                {
                    StudentId = studentId,
                    Ok = false,
                    Error = "Concurrency conflict"
                });
            }
            catch (Exception ex)
            {
                res.Failed.Add(new BulkWithdrawItemResult
                {
                    StudentId = studentId,
                    Ok = false,
                    Error = ex.Message
                });
            }
        }
        var cls = await _db.Classes.FirstOrDefaultAsync(c => c.ClassID == classId);
        if (cls != null && cls.Status != 0)
        {
            cls.Status = 0;
            await _db.SaveChangesAsync();
        }

        return Ok(res);
    }



}
