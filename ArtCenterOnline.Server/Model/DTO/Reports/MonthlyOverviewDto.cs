using System.Collections.Generic;

namespace ArtCenterOnline.Server.Model.DTO.Reports
{
    public class MonthlyOverviewDto
    {
        public string Month { get; set; } = "";

        // Học viên đăng ký mới (dựa StudentInfo.ngayBatDauHoc)
        public int NewStudents { get; set; }
        public int NewStudentsPrev { get; set; }
        public double NewStudentsDeltaPct { get; set; }

        // Học viên rời lớp (nếu có cột DeactivatedAt sẽ chính xác; chưa có thì = 0)
        public int LeftStudents { get; set; }
        public int LeftStudentsPrev { get; set; }
        public double LeftStudentsDeltaPct { get; set; }

        // Attendance tổng
        public double AttendanceRate { get; set; }          // %
        public double AttendanceRatePrev { get; set; }      // %
        public double AttendanceRateDeltaPct { get; set; }  // chênh lệch điểm %

        // Sessions (tháng này + tháng trước)
        public int SessionsThisMonth { get; set; }
        public int SessionsCanceled { get; set; }
        public int SessionsThisMonthPrev { get; set; }   // NEW
        public int SessionsCanceledPrev { get; set; }    // NEW
        public double CancelRate { get; set; }              // %

        // Series cho biểu đồ theo ngày trong tháng
        public List<SeriesPoint> AttendanceSeries { get; set; } = new();
        public List<SeriesPoint> AttendanceSeriesPrev { get; set; } = new();

        // BXH lớp / giáo viên theo tỉ lệ điểm danh (ý tưởng 1)
        public List<NameValue> TopClassesByAttendance { get; set; } = new();
        public List<NameValue> TopTeachersByAttendance { get; set; } = new();
    }

    public class SeriesPoint
    {
        public string Label { get; set; } = ""; // "01","02",...
        public double Value { get; set; }
    }

    public class NameValue
    {
        public string Name { get; set; } = "";
        public double Value { get; set; } // %
    }
}
