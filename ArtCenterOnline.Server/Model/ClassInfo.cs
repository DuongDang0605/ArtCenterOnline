using ArtCenterOnline.Server.Model;

public class ClassInfo
{
    public int ClassID { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public DateTime DayStart { get; set; }
    public string Branch { get; set; } = string.Empty;
    public int Status { get; set; }


    // 👉 NEW


    public ICollection<ClassStudent> ClassStudents { get; set; } = new List<ClassStudent>();
    public ICollection<ClassSchedule> Schedules { get; set; } = new List<ClassSchedule>();


    // 👉 NEW
    public ICollection<ClassSession> Sessions { get; set; } = new List<ClassSession>();
}