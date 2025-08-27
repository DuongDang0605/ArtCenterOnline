using System.Security.Claims;

namespace ArtCenterOnline.Server.Services
{
    public static class ClaimsExt
    {
        public static int GetUserId(this ClaimsPrincipal user)
            => int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

        public static string GetRole(this ClaimsPrincipal user)
            => user.FindFirstValue(ClaimTypes.Role) ?? "";
    }
}
