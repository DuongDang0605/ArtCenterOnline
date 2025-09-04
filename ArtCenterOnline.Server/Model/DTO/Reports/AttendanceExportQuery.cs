// Model/DTO/Reports/AttendanceExportQuery.cs
using System;

namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class AttendanceExportQuery
    {
        public int ClassId { get; set; }
        public DateOnly From { get; set; }
        public DateOnly To { get; set; }
        public bool IncludeCanceled { get; set; } = true;
    }
}
