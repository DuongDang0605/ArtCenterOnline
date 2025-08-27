using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ArtCenterOnline.Server.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ArtCenterOnline.Server.Services
{
    public interface IJwtTokenService
    {
        string GenerateAccessToken(User user, string[] roles);
        string GenerateRefreshToken(User user);
    }

    public class JwtTokenService : IJwtTokenService
    {
        private readonly string _key;
        private readonly string _issuer;
        private readonly string _audience;
        private readonly int _accessMinutes;

        public JwtTokenService(IConfiguration cfg)
        {
            _key = cfg["Jwt:Key"] ?? throw new ArgumentNullException("Jwt:Key");
            _issuer = cfg["Jwt:Issuer"] ?? throw new ArgumentNullException("Jwt:Issuer");
            _audience = cfg["Jwt:Audience"] ?? throw new ArgumentNullException("Jwt:Audience");
            _accessMinutes = int.Parse(cfg["Jwt:AccessTokenMinutes"] ?? "60");
        }

        public string GenerateAccessToken(User user, string[] roles)
        {
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                 new Claim(ClaimTypes.Name, user.FullName ?? user.Email) // thêm full name
            };
            foreach (var r in roles) claims.Add(new Claim(ClaimTypes.Role, r));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var jwt = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(_accessMinutes),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(jwt);
        }

        public string GenerateRefreshToken(User user)
        {
            // Có thể thay bằng random 32 bytes + lưu DB nếu bạn quản lý refresh token
            return Guid.NewGuid().ToString("N");
        }
    }
}
