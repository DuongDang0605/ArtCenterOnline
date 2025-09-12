using System;
using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace ArtCenterOnline.Server.Services
{
    public class InMemoryResetTokenStore : IResetTokenStore
    {
        private readonly ConcurrentDictionary<string, ResetTokenData> _map = new();

        public string Issue(int userId, Guid otpId, TimeSpan ttl)
        {
            // RST_<36 hex> (ngẫu nhiên, khó đoán)
            var token = "RST_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(18));
            _map[token] = new ResetTokenData(userId, otpId, DateTime.UtcNow.Add(ttl));
            return token;
        }

        public bool TryTake(string token, out ResetTokenData data)
        {
            data = default!;
            if (string.IsNullOrWhiteSpace(token)) return false;
            if (!_map.TryRemove(token, out var found)) return false;            // 1 lần dùng
            if (DateTime.UtcNow > found.ExpiresAtUtc) return false;            // hết hạn
            data = found;
            return true;
        }
    }
}
