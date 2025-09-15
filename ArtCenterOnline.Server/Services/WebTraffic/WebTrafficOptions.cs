using System.Collections.Generic;

namespace ArtCenterOnline.Server.Services
{
    public class WebTrafficOptions
    {
        public bool Enabled { get; set; } = true;
        public string CookieName { get; set; } = "aco_tid";  // cookie định danh client
        public double SampleRate { get; set; } = 1.0;        // 0..1: tỉ lệ lấy mẫu request
        public List<string> IgnorePathPrefixes { get; set; } = new()
        {
            "/favicon.ico",
            "/assets",
            "/AdminLTE",
            "/images",
            "/css",
            "/js"
        };
    }
}
