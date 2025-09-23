namespace ArtCenterOnline.Server.Model.DTO
{
    public class WithdrawListItemDto
    {
        public int StudentId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public int ActiveClassCount { get; set; }
        public string Note { get; set; } = "";
        public bool Selectable { get; set; } // true nếu chỉ học lớp hiện tại
    }

    public class ActiveStudentsForWithdrawDto
    {
        public int ClassId { get; set; }
        public string ClassName { get; set; } = "";
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int Total { get; set; }                 // tổng bản ghi sau search (trong lớp này)
        public int TotalActiveInClass { get; set; }    // tổng HS status=1 của lớp (không tính search)
        public List<WithdrawListItemDto> Items { get; set; } = new();
    }

    public class BulkWithdrawRequestDto
    {
        public List<int> StudentIds { get; set; } = new();
    }

    public class BulkWithdrawItemResult
    {
        public int StudentId { get; set; }
        public bool Ok { get; set; }
        public bool DeactivatedAll { get; set; } // true = đã tắt Student + User
        public string? Error { get; set; }
    }

    public class BulkWithdrawResultDto
    {
        public List<BulkWithdrawItemResult> Processed { get; set; } = new();
        public List<BulkWithdrawItemResult> Failed { get; set; } = new();

        public object Summary => new
        {
            requested = (Processed?.Count ?? 0) + (Failed?.Count ?? 0),
            succeeded = Processed?.Count ?? 0,
            failed = Failed?.Count ?? 0
        };
    }
}
