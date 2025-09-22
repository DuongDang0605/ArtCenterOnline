using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using ArtCenterOnline.Server.Model;

namespace ArtCenterOnline.Server.Model.Entities
{
    public enum TuitionRequestStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2,
        Canceled = 3
    }

    public class TuitionPaymentRequest
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int StudentId { get; set; }
        public StudentInfo Student { get; set; } = default!;

        // Ảnh & metadata
        [MaxLength(260)]
        public string ImagePath { get; set; } = string.Empty;

        [MaxLength(100)]
        public string ImageContentType { get; set; } = string.Empty;

        public long ImageSizeBytes { get; set; }

        // Email snapshot tại thời điểm nộp (không phụ thuộc đồng bộ với StudentInfo/User)
        [MaxLength(120)]
        public string EmailSnapshot { get; set; } = string.Empty;

        // Trạng thái & thời điểm
        [Required]
        public TuitionRequestStatus Status { get; set; } = TuitionRequestStatus.Pending;

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

        public DateTime? ReviewedAtUtc { get; set; }
        public int? ReviewedByUserId { get; set; }

        [MaxLength(300)]
        public string? RejectReason { get; set; }
    }
}
