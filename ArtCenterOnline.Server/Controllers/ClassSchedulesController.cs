// Controllers/ClassSchedulesController.cs
using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using ArtCenterOnline.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Linq;

#nullable enable

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class ClassSchedulesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IStudentScheduleValidator _studentValidator;

    // constructor hiện có:
    public ClassSchedulesController(AppDbContext db, IStudentScheduleValidator studentValidator)
    {
        _db = db;
        _studentValidator = studentValidator;
    }



    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var sql = ex.GetBaseException() as SqlException;
        return sql != null && (sql.Number == 2601 || sql.Number == 2627);
    }

    private static string VNDayOfWeek(DayOfWeek d) => d switch
    {
        DayOfWeek.Monday => "Thứ 2",
        DayOfWeek.Tuesday => "Thứ 3",
        DayOfWeek.Wednesday => "Thứ 4",
        DayOfWeek.Thursday => "Thứ 5",
        DayOfWeek.Friday => "Thứ 6",
        DayOfWeek.Saturday => "Thứ 7",
        DayOfWeek.Sunday => "Chủ nhật",
        _ => d.ToString()
    };

    [HttpGet("by-class/{classId:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetByClass(int classId)
    {
        var items = await _db.ClassSchedules
            .Where(x => x.ClassID == classId)
            .OrderBy(x => x.DayOfWeek).ThenBy(x => x.StartTime)
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:int}")]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.ClassSchedules.FindAsync(id);
        return item is null ? Error(404, $"Schedule #{id} không tồn tại.") : Ok(item);
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] ClassSchedule input)
    {
        try
        {
            if (input.EndTime <= input.StartTime)
                return Error(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu.");

            var className = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync() ?? $"ID {input.ClassID}";
            var thu = VNDayOfWeek(input.DayOfWeek);

            // 1) Cùng lớp + cùng thứ: CẤM CHỒNG GIỜ (trả chi tiết)
            var overlapSameClass = await _db.ClassSchedules
                .Where(s => s.ClassID == input.ClassID
                         && s.DayOfWeek == input.DayOfWeek
                         && s.IsActive
                         && input.StartTime < s.EndTime
                         && s.StartTime < input.EndTime)
                .Select(s => new { s.StartTime, s.EndTime })
                .FirstOrDefaultAsync();
            if (overlapSameClass != null)
            {
                return Error(409,
                    $"Trong lớp {className}, lịch {thu} {input.StartTime:hh\\:mm}-{input.EndTime:hh\\:mm} " +
                    $"trùng với lịch {overlapSameClass.StartTime:hh\\:mm}-{overlapSameClass.EndTime:hh\\:mm}.");
            }

            // 2) Giáo viên chính của lớp này không được bận ở lớp khác (trả chi tiết)
            var teacherId = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.MainTeacherId)
                .FirstOrDefaultAsync();

            if (teacherId.HasValue)
            {
                var teacherBusy = await _db.ClassSchedules
                    .Include(s => s.Class)
                    .Where(s => s.ClassID != input.ClassID
                             && s.DayOfWeek == input.DayOfWeek
                             && s.IsActive
                             && s.Class!.MainTeacherId == teacherId.Value
                             && input.StartTime < s.EndTime
                             && s.StartTime < input.EndTime)
                    .Select(s => new
                    {
                        s.StartTime,
                        s.EndTime,
                        ClassName = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}"
                    })
                    .FirstOrDefaultAsync();

                if (teacherBusy != null)
                {
                    return Error(409,
                        $"Giáo viên chính của lớp {className} đang bận {thu} " +
                        $"{teacherBusy.StartTime:hh\\:mm}-{teacherBusy.EndTime:hh\\:mm} tại lớp {teacherBusy.ClassName}.");
                }
            }

            _db.ClassSchedules.Add(input);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = input.ScheduleId }, input);
        }
        catch (DbUpdateException ex)
        {
            var className = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync() ?? $"ID {input.ClassID}";
            var thu = VNDayOfWeek(input.DayOfWeek);

            if (IsUniqueViolation(ex))
                return Error(409,
                    $"Đã có lịch {thu} {input.StartTime:hh\\:mm} tại lớp {className} (trùng khoá Lớp+Thứ+Giờ bắt đầu).");
            throw;
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassSchedule input)
    {
        try
        {
            var item = await _db.ClassSchedules.FindAsync(id);
            if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

            if (input.EndTime <= input.StartTime)
                return Error(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu.");

            var className = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync() ?? $"ID {input.ClassID}";
            var thu = VNDayOfWeek(input.DayOfWeek);

            // 1) Cùng lớp + cùng thứ: CẤM CHỒNG GIỜ (loại trừ chính record, trả chi tiết)
            var overlapSameClass = await _db.ClassSchedules
                .Where(s => s.ScheduleId != id
                         && s.ClassID == input.ClassID
                         && s.DayOfWeek == input.DayOfWeek
                         && s.IsActive
                         && input.StartTime < s.EndTime
                         && s.StartTime < input.EndTime)
                .Select(s => new { s.StartTime, s.EndTime })
                .FirstOrDefaultAsync();
            if (overlapSameClass != null)
            {
                return Error(409,
                    $"Trong lớp {className}, lịch {thu} {input.StartTime:hh\\:mm}-{input.EndTime:hh\\:mm} " +
                    $"trùng với lịch {overlapSameClass.StartTime:hh\\:mm}-{overlapSameClass.EndTime:hh\\:mm}.");
            }

            // 2) Giáo viên chính bận ở lớp khác (loại trừ chính record, trả chi tiết)
            var teacherId = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.MainTeacherId)
                .FirstOrDefaultAsync();

            if (teacherId.HasValue)
            {
                var teacherBusy = await _db.ClassSchedules
                    .Include(s => s.Class)
                    .Where(s => s.ScheduleId != id
                             && s.ClassID != input.ClassID
                             && s.DayOfWeek == input.DayOfWeek
                             && s.IsActive
                             && s.Class!.MainTeacherId == teacherId.Value
                             && input.StartTime < s.EndTime
                             && s.StartTime < input.EndTime)
                    .Select(s => new
                    {
                        s.StartTime,
                        s.EndTime,
                        ClassName = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}"
                    })
                    .FirstOrDefaultAsync();

                if (teacherBusy != null)
                {
                    return Error(409,
                        $"Giáo viên chính của lớp {className} đang bận {thu} " +
                        $"{teacherBusy.StartTime:hh\\:mm}-{teacherBusy.EndTime:hh\\:mm} tại lớp {teacherBusy.ClassName}.");
                }
            }

            // Cập nhật
            item.ClassID = input.ClassID;
            item.DayOfWeek = input.DayOfWeek;
            item.StartTime = input.StartTime;
            item.EndTime = input.EndTime;
            item.IsActive = input.IsActive;
            item.Note = input.Note;

            await _db.SaveChangesAsync();
            return Ok(item);
        }
        catch (DbUpdateException ex)
        {
            var className = await _db.Classes
                .Where(c => c.ClassID == input.ClassID)
                .Select(c => c.ClassName)
                .FirstOrDefaultAsync() ?? $"ID {input.ClassID}";
            var thu = VNDayOfWeek(input.DayOfWeek);

            if (IsUniqueViolation(ex))
                return Error(409,
                    $"Đã có lịch {thu} {input.StartTime:hh\\:mm} tại lớp {className} (trùng khoá Lớp+Thứ+Giờ bắt đầu).");
            throw;
        }
    }
    // -------------------- PREFLIGHT: Cảnh báo trùng HS theo LỊCH MẪU --------------------
    [HttpPost("{id:int}/check-student-overlap")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> CheckStudentOverlapForSchedule(
        [FromRoute] int id,
        [FromBody] ClassSchedule input,
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        // Nếu FE gọi theo ID đang chỉnh, body "input" là bản draft sau khi người dùng đổi thứ/giờ
        var fromDate = DateOnly.TryParse(from, out var f) ? f : DateOnly.FromDateTime(DateTime.Now.Date);

        DateOnly toDate;
        if (DateOnly.TryParse(to, out var t))
        {
            toDate = t;
        }
        else
        {
            // mặc định: tới cuối tháng của fromDate
            var last = new DateTime(fromDate.Year, fromDate.Month, DateTime.DaysInMonth(fromDate.Year, fromDate.Month));
            toDate = DateOnly.FromDateTime(last);
        }

        if (input.EndTime <= input.StartTime)
            return Error(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu.");

        var warnings = await _studentValidator.CheckForScheduleAsync(
            input.ClassID, input.DayOfWeek, input.StartTime, input.EndTime, fromDate, toDate, HttpContext.RequestAborted);

        return Ok(warnings); // mảng chuỗi cảnh báo; rỗng nếu không có xung đột
    }


    [HttpPatch("{id:int}/toggle")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        try
        {
            var item = await _db.ClassSchedules
                .Include(s => s.Class)
                .FirstOrDefaultAsync(s => s.ScheduleId == id);
            if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

            // Nếu đang OFF và sắp bật ON → kiểm tra trước, trả lỗi chi tiết nếu trùng
            if (!item.IsActive)
            {
                var thu = VNDayOfWeek(item.DayOfWeek);
                var className = item.Class?.ClassName ?? $"ID {item.ClassID}";

                // Cùng lớp + cùng thứ → trùng (chi tiết)
                var sameClass = await _db.ClassSchedules
                    .Where(s => s.ScheduleId != id
                             && s.ClassID == item.ClassID
                             && s.DayOfWeek == item.DayOfWeek
                             && s.IsActive
                             && item.StartTime < s.EndTime
                             && s.StartTime < item.EndTime)
                    .Select(s => new { s.StartTime, s.EndTime })
                    .FirstOrDefaultAsync();
                if (sameClass != null)
                {
                    return Error(409,
                        $"Trong lớp {className}, lịch {thu} {item.StartTime:hh\\:mm}-{item.EndTime:hh\\:mm} " +
                        $"trùng với lịch {sameClass.StartTime:hh\\:mm}-{sameClass.EndTime:hh\\:mm}.");
                }

                // Giáo viên bận lớp khác (chi tiết)
                var teacherId = item.Class?.MainTeacherId;
                if (teacherId.HasValue)
                {
                    var busy = await _db.ClassSchedules
                        .Include(s => s.Class)
                        .Where(s => s.ClassID != item.ClassID
                                 && s.DayOfWeek == item.DayOfWeek
                                 && s.IsActive
                                 && s.Class!.MainTeacherId == teacherId.Value
                                 && item.StartTime < s.EndTime
                                 && s.StartTime < item.EndTime)
                        .Select(s => new
                        {
                            s.StartTime,
                            s.EndTime,
                            ClassName = s.Class != null ? s.Class.ClassName : $"ID {s.ClassID}"
                        })
                        .FirstOrDefaultAsync();

                    if (busy != null)
                    {
                        return Error(409,
                            $"Giáo viên chính của lớp {className} đang bận {thu} " +
                            $"{busy.StartTime:hh\\:mm}-{busy.EndTime:hh\\:mm} tại lớp {busy.ClassName}.");
                    }
                }
            }

            item.IsActive = !item.IsActive;
            await _db.SaveChangesAsync();
            return Ok(new { item.ScheduleId, item.IsActive });
        }
        catch (DbUpdateException ex)
        {
            // Nếu tới đây do unique key, trả thông điệp rõ hơn theo bản ghi hiện tại
            if (IsUniqueViolation(ex))
            {
                var item = await _db.ClassSchedules
                    .Include(s => s.Class)
                    .FirstOrDefaultAsync(s => s.ScheduleId == id);

                if (item != null)
                {
                    var thu = VNDayOfWeek(item.DayOfWeek);
                    var className = item.Class?.ClassName ?? $"ID {item.ClassID}";
                    return Error(409, $"Đã có lịch {thu} {item.StartTime:hh\\:mm} tại lớp {className} (trùng khoá).");
                }
                return Error(409, "Không thể chuyển trạng thái do trùng lịch.");
            }
            throw;
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var item = await _db.ClassSchedules.FindAsync(id);
            if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

            _db.ClassSchedules.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
        catch (DbUpdateException ex)
        {
            if (IsUniqueViolation(ex))
                return Error(409, "Không thể xoá do trùng lịch.");
            throw;
        }
    }
}
