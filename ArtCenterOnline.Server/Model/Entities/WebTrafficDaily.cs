namespace ArtCenterOnline.Server.Model.Entities
{
    public class WebTrafficDaily
    {
        public DateOnly Date { get; set; }
        public string? Path { get; set; }              // null = toàn site
        public int Hits { get; set; }
        public int UniqueVisitors { get; set; }
    }

}
