#!/bin/bash
# Test cache TTL expiration

echo "🧪 Testing cache TTL expiration..."
echo "=================================="
echo ""

# 1. Flush Redis to start fresh
echo "1️⃣  Flushing Redis..."
docker exec compose-redis-1 redis-cli FLUSHALL
echo "   ✅ Redis flushed"
echo ""

# 2. Wait for weather trigger (next :00 second)
current_sec=$(date +%S)
wait_sec=$((60 - current_sec + 5))
echo "2️⃣  Waiting ${wait_sec}s for next weather trigger..."
sleep $wait_sec

# 3. Check metrics - should have 1 MISS, 1 SET
echo ""
echo "3️⃣  Metrics after first weather fetch (expecting MISS):"
curl -s http://localhost:1880/metrics/json | jq '.cache'
echo ""

# 4. Wait 65s for second trigger - should HIT
echo "4️⃣  Waiting 65s for second weather trigger (should HIT cache)..."
sleep 65

echo ""
echo "   Metrics after second fetch (expecting HIT):"
curl -s http://localhost:1880/metrics/json | jq '.cache'
echo ""

# 5. Check Redis keys and TTL
echo "5️⃣  Checking Redis keys and TTL:"
docker exec compose-redis-1 redis-cli KEYS "weather:*"
echo ""
echo "   TTL remaining:"
docker exec compose-redis-1 redis-cli TTL "weather:current:48.1486:17.1077"
echo ""

# 6. Wait for TTL expiration (10 min = 600s, already waited ~130s, so wait 480s more)
echo "6️⃣  Waiting 8 more minutes for TTL expiration (600s total)..."
for i in {1..8}; do
    echo "   ... ${i}/8 minutes elapsed"
    sleep 60
done

# 7. Trigger one more weather fetch - should MISS again
echo ""
echo "7️⃣  Waiting for weather trigger after expiration..."
current_sec=$(date +%S)
wait_sec=$((60 - current_sec + 5))
sleep $wait_sec

echo ""
echo "   Final metrics (expecting MISS after TTL expiration):"
curl -s http://localhost:1880/metrics/json | jq '.cache'
echo ""

# 8. Check Redis - key should be gone
echo "8️⃣  Checking if key expired:"
exists=$(docker exec compose-redis-1 redis-cli EXISTS "weather:current:48.1486:17.1077")
if [ "$exists" == "0" ]; then
    echo "   ✅ Key expired correctly!"
else
    echo "   ❌ Key still exists (TTL may not have expired)"
    docker exec compose-redis-1 redis-cli TTL "weather:current:48.1486:17.1077"
fi

echo ""
echo "=================================="
echo "✅ TTL Test Complete!"
