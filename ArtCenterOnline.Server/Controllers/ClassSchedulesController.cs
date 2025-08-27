using ArtCenterOnline.Server.Data;
using ArtCenterOnline.Server.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Linq;

[ApiController]
[Route("api/[controller]")]
[Authorize] // yêu cầu đăng nhập
public class ClassSchedulesController : ControllerBase
{
    private readonly AppDbContext _db;
    public ClassSchedulesController(AppDbContext db) => _db = db;

    private IActionResult Error(int status, string message) => StatusCode(status, new { message });

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var sql = ex.GetBaseException() as SqlException;
        return sql != null && (sql.Number == 2601 || sql.Number == 2627);
    }

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
        if (input.EndTime <= input.StartTime)
            return Error(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu.");

        bool conflict = await _db.ClassSchedules.AnyAsync(s =>
            s.ClassID == input.ClassID &&
            s.DayOfWeek == input.DayOfWeek &&
            s.StartTime == input.StartTime);
        if (conflict)
            return Error(409, "Lịch này đã tồn tại (trùng Lớp + Thứ + Giờ bắt đầu).");

        _db.ClassSchedules.Add(input);

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException ex) { if (IsUniqueViolation(ex)) return Error(409, "Lịch này đã tồn tại (trùng Lớp + Thứ + Giờ bắt đầu)."); throw; }

        return CreatedAtAction(nameof(GetById), new { id = input.ScheduleId }, input);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Update(int id, [FromBody] ClassSchedule input)
    {
        var item = await _db.ClassSchedules.FindAsync(id);
        if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

        if (input.EndTime <= input.StartTime)
            return Error(400, "Giờ kết thúc phải lớn hơn giờ bắt đầu.");

        var willDuplicate = await _db.ClassSchedules.AnyAsync(s =>
            s.ScheduleId != id &&
            s.ClassID == input.ClassID &&
            s.DayOfWeek == input.DayOfWeek &&
            s.StartTime == input.StartTime);
        if (willDuplicate) return Error(409, "Lịch này đã tồn tại (trùng Lớp + Thứ + Giờ bắt đầu).");

        item.ClassID = input.ClassID;
        item.DayOfWeek = input.DayOfWeek;
        item.StartTime = input.StartTime;
        item.EndTime = input.EndTime;
        item.IsActive = input.IsActive;
        item.Note = input.Note;

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException ex) { if (IsUniqueViolation(ex)) return Error(409, "Lịch này đã tồn tại (trùng Lớp + Thứ + Giờ bắt đầu)."); throw; }

        return Ok(item);
    }

    [HttpPatch("{id:int}/toggle")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> ToggleActive(int id)
    {
        var item = await _db.ClassSchedules.FindAsync(id);
        if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

        item.IsActive = !item.IsActive;

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException ex) { if (IsUniqueViolation(ex)) return Error(409, "Không thể chuyển trạng thái do trùng lịch."); throw; }

        return Ok(new { item.ScheduleId, item.IsActive });
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.ClassSchedules.FindAsync(id);
        if (item is null) return Error(404, $"Schedule #{id} không tồn tại.");

        _db.ClassSchedules.Remove(item);

        try { await _db.SaveChangesAsync(); }
        catch (DbUpdateException ex) { if (IsUniqueViolation(ex)) return Error(409, "Không thể xoá do ràng buộc dữ liệu."); throw; }

        return NoContent();
    }
}
