namespace ArtCenterOnline.Server.Model.Entities
{
    public class WebTrafficMonthly
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public string? Path { get; set; }
        public int Hits { get; set; }
        public int UniqueVisitors { get; set; }
    }

}
