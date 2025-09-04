namespace ArtCenterOnline.Server.Services.Reports
{
    public interface IAttendanceExportService
    {
        Task<(byte[] content, string fileName, string contentType)> ExportAttendanceMatrixAsync(
            ArtCenterOnline.Server.Model.DTO.Reports.AttendanceExportQuery query,
            CancellationToken ct = default);
    }
}
