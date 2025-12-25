#!/bin/bash
# Quick cache test - verifies cache works without waiting for TTL

echo "🧪 Quick Cache Functionality Test"
echo "=================================="
echo ""

# 1. Check current metrics
echo "1️⃣  Current cache metrics:"
curl -s http://localhost:1880/metrics/json | jq '.cache'
echo ""

# 2. Check Redis keys
echo "2️⃣  Redis keys (weather patterns):"
docker exec compose-redis-1 redis-cli KEYS "weather:*"
echo ""

# 3. Check TTL of weather cache
echo "3️⃣  TTL of weather:current key:"
ttl=$(docker exec compose-redis-1 redis-cli TTL "weather:current:48.1486:17.1077")
echo "   ${ttl} seconds remaining (max 600s = 10 min)"
echo ""

# 4. Get cached value
echo "4️⃣  Cached weather data:"
docker exec compose-redis-1 redis-cli GET "weather:current:48.1486:17.1077" | head -c 200
echo "..."
echo ""

# 5. Check modes config cache
echo "5️⃣  Modes config cached:"
exists=$(docker exec compose-redis-1 redis-cli EXISTS "config:modes")
if [ "$exists" == "1" ]; then
    echo "   ✅ config:modes exists in Redis"
else
    echo "   ❌ config:modes NOT found"
fi
echo ""

# 6. Summary
echo "=================================="
echo "📊 Summary:"
echo ""
curl -s http://localhost:1880/metrics/json | jq '{
  cache_enabled: .cache.hits > 0 or .cache.misses > 0,
  total_requests: (.cache.hits + .cache.misses),
  cache_hit_rate: .cache.hitRate,
  keys_stored: .cache.size
}'

echo ""
echo "✅ Test Complete!"
