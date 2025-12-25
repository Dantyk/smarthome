#!/bin/bash
#
# SmartHome Performance Profiling Script
# 
# Analyzuje:
# - CPU usage per service
# - Memory usage
# - MQTT message throughput
# - API response times
# - Database query performance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PROFILE_DIR="$PROJECT_ROOT/performance-profiles"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

mkdir -p "$PROFILE_DIR"

log_section "Performance Profiling - $TIMESTAMP"

# 1. Docker Container Stats
log_section "1. Container Resource Usage"

log_info "Collecting 30s sample..."
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" > "$PROFILE_DIR/container-stats-${TIMESTAMP}.txt" 2>&1 &
STATS_PID=$!

sleep 30
kill $STATS_PID 2>/dev/null || true

cat "$PROFILE_DIR/container-stats-${TIMESTAMP}.txt"

# 2. MQTT Metrics Analysis
log_section "2. MQTT Metrics"

log_info "Querying MQTT metrics..."
MQTT_METRICS=$(curl -s http://localhost:1880/metrics/json | jq '{
  mqtt: .mqtt,
  rateLimiter: .rateLimiter,
  circuitBreaker: .circuitBreaker
}')

echo "$MQTT_METRICS" | tee "$PROFILE_DIR/mqtt-metrics-${TIMESTAMP}.json"

# Extract key values
MSG_RATE=$(echo "$MQTT_METRICS" | jq -r '.mqtt.messages | to_entries | length')
QUEUE_SIZE=$(echo "$MQTT_METRICS" | jq -r '.mqtt.queueSize')
REJECTION_RATE=$(echo "$MQTT_METRICS" | jq -r '.rateLimiter.rejectionRate')

echo ""
log_info "Message types: $MSG_RATE"
log_info "Queue size: $QUEUE_SIZE"
log_info "Rejection rate: $REJECTION_RATE"

# 3. API Response Time
log_section "3. API Performance"

log_info "Testing API endpoints..."

# Node-RED metrics
START=$(date +%s%N)
curl -s http://localhost:1880/metrics > /dev/null
END=$(date +%s%N)
NR_METRICS_MS=$(( (END - START) / 1000000 ))

# UI metrics
START=$(date +%s%N)
curl -s http://localhost:3000/api/metrics > /dev/null
END=$(date +%s%N)
UI_METRICS_MS=$(( (END - START) / 1000000 ))

echo "Node-RED /metrics:    ${NR_METRICS_MS}ms"
echo "UI /api/metrics:      ${UI_METRICS_MS}ms"

# 4. Prometheus Metrics Snapshot
log_section "4. Prometheus Metrics"

log_info "Querying key metrics..."

# MQTT throughput
MQTT_RATE=$(curl -s 'http://localhost:9090/api/v1/query?query=rate(mqtt_messages_total[5m])' | \
  jq -r '.data.result[0].value[1] // "0"')

# Error rate
ERROR_RATE=$(curl -s 'http://localhost:9090/api/v1/query?query=rate(mqtt_errors_total[5m])' | \
  jq -r '.data.result[0].value[1] // "0"')

# p95 latency
P95_LATENCY=$(curl -s 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,rate(mqtt_message_duration_ms_bucket[5m]))' | \
  jq -r '.data.result[0].value[1] // "0"')

echo "MQTT msg/s:     $MQTT_RATE"
echo "Error rate:     $ERROR_RATE"
echo "p95 latency:    ${P95_LATENCY}ms"

# 5. Top processes by CPU
log_section "5. System Processes"

log_info "Top CPU consumers..."
ps aux --sort=-pcpu | head -10 > "$PROFILE_DIR/top-cpu-${TIMESTAMP}.txt"
cat "$PROFILE_DIR/top-cpu-${TIMESTAMP}.txt"

# 6. Memory breakdown
log_section "6. Memory Analysis"

log_info "Memory usage..."
free -h | tee "$PROFILE_DIR/memory-${TIMESTAMP}.txt"

# 7. Network connections
log_section "7. Network Connections"

log_info "Active connections..."
netstat -tn | grep ESTABLISHED | wc -l | xargs echo "Established connections:"

# MQTT connections
MQTT_CONN=$(netstat -tn | grep :1883 | grep ESTABLISHED | wc -l)
echo "MQTT connections: $MQTT_CONN"

# 8. Generate Report
log_section "8. Performance Report"

cat > "$PROFILE_DIR/report-${TIMESTAMP}.md" << EOF
# Performance Profile Report

**Date:** $(date -Iseconds)  
**Duration:** 30 seconds sampling

## Summary

### MQTT Performance
- Message rate: ${MQTT_RATE} msg/s
- Error rate: ${ERROR_RATE} errors/s
- p95 latency: ${P95_LATENCY} ms
- Queue size: ${QUEUE_SIZE}
- Rejection rate: ${REJECTION_RATE}
- Active connections: ${MQTT_CONN}

### API Performance
- Node-RED /metrics: ${NR_METRICS_MS}ms
- UI /api/metrics: ${UI_METRICS_MS}ms

### Resource Usage
See \`container-stats-${TIMESTAMP}.txt\` for details.

## Recommendations

EOF

# Add recommendations based on metrics
if (( $(echo "$REJECTION_RATE > 0.05" | bc -l) )); then
  echo "- ⚠️ High rate limit rejection ($REJECTION_RATE) - consider increasing limits" >> "$PROFILE_DIR/report-${TIMESTAMP}.md"
fi

if (( $(echo "$QUEUE_SIZE > 5000" | bc -l) )); then
  echo "- ⚠️ High queue size ($QUEUE_SIZE) - may need to increase processing speed" >> "$PROFILE_DIR/report-${TIMESTAMP}.md"
fi

if (( NR_METRICS_MS > 200 )); then
  echo "- ⚠️ Slow metrics endpoint (${NR_METRICS_MS}ms) - optimize collector" >> "$PROFILE_DIR/report-${TIMESTAMP}.md"
fi

if (( $(echo "$P95_LATENCY > 100" | bc -l) )); then
  echo "- ⚠️ High p95 latency (${P95_LATENCY}ms) - profile MQTT handlers" >> "$PROFILE_DIR/report-${TIMESTAMP}.md"
fi

echo "- ✓ Profile complete - review detailed stats in $PROFILE_DIR/" >> "$PROFILE_DIR/report-${TIMESTAMP}.md"

log_info "Report generated: $PROFILE_DIR/report-${TIMESTAMP}.md"
cat "$PROFILE_DIR/report-${TIMESTAMP}.md"

log_section "Profiling Complete"
log_info "All results saved to: $PROFILE_DIR"
