using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace ArtCenterOnline.Server.Model.DTO.Tuition
{
    public sealed class TuitionRequestListItemDto
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? ReviewedAtUtc { get; set; }
    }

    public sealed class TuitionRequestDetailDto
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Status { get; set; } = "";
        public DateTime CreatedAtUtc { get; set; }
        public DateTime? ReviewedAtUtc { get; set; }
        public int? ReviewedByUserId { get; set; }
        public string? RejectReason { get; set; }

        public string ImageContentType { get; set; } = "";
        public long ImageSizeBytes { get; set; }
        public string ImageUrl { get; set; } = "";   // gợi ý FE: GET /api/tuition-requests/{id}/image
    }

    public sealed class ApproveTuitionRequestDto
    {
        [Range(1, 200, ErrorMessage = "Số buổi phải từ 1 đến 200")]
        public int SessionsToAdd { get; set; }
    }

    public sealed class RejectTuitionRequestDto
    {
        [StringLength(300)]
        public string? Reason { get; set; }
    }

    public class TuitionUploadForm
    {
        [Required]
        public IFormFile file { get; set; } = default!;
    }
}
