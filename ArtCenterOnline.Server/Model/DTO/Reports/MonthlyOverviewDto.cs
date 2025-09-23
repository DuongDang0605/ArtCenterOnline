// Model/DTO/Reports/MonthlyOverviewDto.cs
namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class MonthlyOverviewDto
    {
        // ====== đã có từ trước (giữ nguyên các field cũ) ======
        public string Month { get; set; } = "";

        public int NewStudents { get; set; }
        public int NewStudentsPrev { get; set; }
        public double NewStudentsDeltaPct { get; set; }

        public int LeftStudents { get; set; }
        public int LeftStudentsPrev { get; set; }
        public double LeftStudentsDeltaPct { get; set; }

        public double AttendanceRate { get; set; }
        public double AttendanceRatePrev { get; set; }
        public double AttendanceRateDeltaPct { get; set; }

        public int SessionsThisMonth { get; set; }
        public int SessionsCanceled { get; set; }
        public int SessionsThisMonthPrev { get; set; }
        public int SessionsCanceledPrev { get; set; }
        public int SessionsTotalThisMonth { get; set; }
        public double CancelRate { get; set; }

        public List<SeriesPoint> AttendanceSeries { get; set; } = new();
        public List<SeriesPoint> AttendanceSeriesPrev { get; set; } = new();
        public List<NameValue> TopClassesByAttendance { get; set; } = new();
        public List<NameValue> TopTeachersByAttendance { get; set; } = new();

        // ====== MỚI: 4 cặp KPI tổng quan ======
        public int ActiveStudents { get; set; }
        public int TotalStudents { get; set; }

        public int ActiveClasses { get; set; }
        public int TotalClasses { get; set; }

        public int ActiveTeachers { get; set; }
        public int TotalTeachers { get; set; }

        public int ActiveUsers { get; set; }
        public int TotalUsers { get; set; }
    }

    public class SeriesPoint
    {
        public string Label { get; set; } = "";
        public double Value { get; set; }
    }

    public class NameValue
    {
        public string Name { get; set; } = "";
        public double Value { get; set; }
    }
}
