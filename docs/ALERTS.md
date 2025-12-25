# Alert Management Guide

Kompletný sprievodca Prometheus alertami a Alertmanager notifikáciami.

## 📋 Obsah

- [Alert Rules Overview](#alert-rules-overview)
- [Critical Alerts](#critical-alerts)
- [Performance Alerts](#performance-alerts)
- [System Alerts](#system-alerts)
- [Business Alerts](#business-alerts)
- [Alertmanager Configuration](#alertmanager-configuration)
- [Notification Channels](#notification-channels)
- [Alert Response Procedures](#alert-response-procedures)
- [Tuning & Customization](#tuning--customization)

---

## 🚨 Alert Rules Overview

**Location**: `compose/config/prometheus/alerts.yml`

### Alert Groups

| Group | Rules | Severity | Purpose |
|-------|-------|----------|---------|
| **smarthome_critical** | 5 | CRITICAL | System-breaking issues |
| **smarthome_performance** | 4 | WARNING | Performance degradation |
| **smarthome_system** | 3 | WARNING/INFO | System health |
| **smarthome_business** | 2 | WARNING/INFO | Business metrics |

### Severity Levels

| Severity | Response Time | Notification | Example |
|----------|---------------|--------------|---------|
| **CRITICAL** | Immediate (0s) | Discord 🚨 + Email | CircuitBreakerOpen, ServiceDown |
| **WARNING** | 30s batching | Discord ⚠️ | HighMQTTErrorRate, SlowAPIResponses |
| **INFO** | 5m batching, 24h repeat | Local webhook | FrequentConfigReloads |

---

## 🔴 Critical Alerts

### CircuitBreakerOpen

**Trigger**: `circuit_breaker_state > 1` for 1 minute

```yaml
alert: CircuitBreakerOpen
expr: circuit_breaker_state{component!=""} > 1
for: 1m
labels:
  severity: critical
annotations:
  summary: "Circuit breaker open for {{ $labels.component }}"
  description: "Circuit breaker {{ $labels.component }} is OPEN (state={{ $value }}). Service is rejecting requests."
  action: "Check {{ $labels.component }} logs, restart service if needed"
```

**Meaning**: Circuit breaker tripped, service is unstable

**Response**:
1. Check logs: `docker compose logs {{ component }}`
2. Identify failing dependency (MQTT, API, database)
3. Fix dependency issue
4. Circuit will auto-reset after success threshold

**Example**:
```bash
# Check Node-RED circuit breaker
docker compose logs nodered | grep -i "circuit"

# Force reset (if safe)
curl -X POST http://localhost:1880/admin/circuit-breaker/reset
```

---

### DLQCritical

**Trigger**: `dlq_messages > 500` for 2 minutes

```yaml
alert: DLQCritical
expr: dlq_messages > 500
for: 2m
labels:
  severity: critical
annotations:
  summary: "Dead Letter Queue critical ({{ $value }} messages)"
  description: "DLQ has {{ $value }} messages. Message processing severely degraded."
  action: "Investigate DLQ messages, fix processing errors, purge if necessary"
```

**Meaning**: Too many failed messages, system cannot recover

**Response**:
1. Check DLQ: `docker compose exec nodered cat /data/context/global/dlq.json`
2. Identify error pattern (malformed messages, dependency failures)
3. Fix root cause
4. Purge DLQ if messages are unrecoverable:
   ```bash
   docker compose exec nodered node -e "
     const context = require('/data/context/global/global.json');
     context.dlq = [];
     require('fs').writeFileSync('/data/context/global/global.json', JSON.stringify(context));
   "
   docker compose restart nodered
   ```

---

### RateLimitCritical

**Trigger**: `rate(rate_limit_rejected[1m]) > 50` for 1 minute

```yaml
alert: RateLimitCritical
expr: rate(rate_limit_rejected[1m]) > 50
for: 1m
labels:
  severity: critical
annotations:
  summary: "Rate limiting critical ({{ $value | humanize }}/s rejected)"
  description: "Rate limiter rejecting {{ $value | humanize }} requests/sec. System overload."
  action: "Identify source of traffic spike, block malicious clients, increase rate limit if legitimate"
```

**Meaning**: Rate limiter overwhelmed, likely attack or runaway client

**Response**:
1. Check rejected sources:
   ```bash
   docker compose logs nodered | grep "rate limit" | tail -100
   ```
2. Identify top offenders:
   ```bash
   docker compose logs mosquitto | grep "Client" | sort | uniq -c | sort -rn | head -20
   ```
3. Block malicious clients:
   ```bash
   # Add to mosquitto ACL
   echo "deny <client_id>" >> compose/config/mosquitto/acl.conf
   docker compose restart mosquitto
   ```
4. Increase rate limit if legitimate:
   ```javascript
   // flows/nodered/lib/rate-limiter.js
   maxTokens: 200,  // Increase from 100
   refillRate: 20,  // Increase from 10
   ```

---

### QueueOverflow

**Trigger**: `mqtt_queue_size > 9500` for 1 minute

```yaml
alert: QueueOverflow
expr: mqtt_queue_size > 9500
for: 1m
labels:
  severity: critical
annotations:
  summary: "MQTT queue near capacity ({{ $value }}/10000)"
  description: "MQTT message queue at {{ $value }} messages. About to drop messages."
  action: "Increase queue size, optimize message processing, check for slow consumers"
```

**Meaning**: Message queue full, will start dropping messages

**Response**:
1. Check queue size:
   ```bash
   curl -s http://localhost:1880/metrics/json | jq '.mqtt.queueSize'
   ```
2. Identify slow consumers:
   ```bash
   docker compose logs nodered | grep "processing time" | sort -rn | head -20
   ```
3. Increase queue size (temporary):
   ```javascript
   // flows/nodered/init.js
   global.mqttQueue = {
     maxSize: 20000,  // Increase from 10000
   };
   ```
4. Optimize processing:
   - Parallelize slow flows
   - Add async/await patterns
   - Cache frequent lookups

---

### ServiceDown

**Trigger**: `up == 0` for 2 minutes

```yaml
alert: ServiceDown
expr: up{job!=""} == 0
for: 2m
labels:
  severity: critical
annotations:
  summary: "Service {{ $labels.job }} is down"
  description: "{{ $labels.job }} failed healthcheck for 2 minutes."
  action: "Check container status, restart if needed, investigate crash cause"
```

**Meaning**: Service container down or unhealthy

**Response**:
1. Check status:
   ```bash
   docker compose ps
   ```
2. View logs:
   ```bash
   docker compose logs {{ job }} | tail -200
   ```
3. Restart:
   ```bash
   docker compose restart {{ job }}
   ```
4. If persistent:
   ```bash
   docker compose down {{ job }}
   docker compose up -d {{ job }}
   ```

---

## ⚠️ Performance Alerts

### HighMQTTErrorRate

**Trigger**: `rate(mqtt_errors_total[5m]) > 0.1` for 5 minutes

```yaml
alert: HighMQTTErrorRate
expr: rate(mqtt_errors_total[5m]) > 0.1
for: 5m
labels:
  severity: warning
annotations:
  summary: "High MQTT error rate ({{ $value | humanize }}/s)"
  description: "MQTT errors at {{ $value | humanize }} errors/sec over 5min."
  action: "Check MQTT broker logs, verify client connections, review ACL rules"
```

**Meaning**: Persistent MQTT errors, likely configuration issue

**Response**:
1. Check error types:
   ```bash
   docker compose logs mosquitto | grep -i error | tail -100
   ```
2. Common issues:
   - ACL permissions (check `acl.conf`)
   - Invalid topics (null bytes, wildcards in publish)
   - QoS mismatches
   - Retained message conflicts
3. Fix and monitor

---

### DLQBacklog

**Trigger**: `dlq_messages > 100` for 5 minutes

```yaml
alert: DLQBacklog
expr: dlq_messages > 100
for: 5m
labels:
  severity: warning
```

**Meaning**: DLQ growing, non-critical but needs attention

**Response**:
1. Check DLQ size trend (Grafana dashboard)
2. Sample DLQ messages to identify pattern
3. Fix root cause (schema validation, API errors, etc.)
4. Monitor recovery

---

### SlowAPIResponses

**Trigger**: `histogram_quantile(0.95, http_request_duration) > 2000` for 5 minutes

```yaml
alert: SlowAPIResponses
expr: histogram_quantile(0.95, rate(http_request_duration_bucket[5m])) > 2000
for: 5m
labels:
  severity: warning
```

**Meaning**: 95th percentile API latency >2s

**Response**:
1. Profile slow endpoints:
   ```bash
   ./scripts/profile-performance.sh
   ```
2. Check database queries (InfluxDB slow log)
3. Enable caching for slow endpoints
4. Optimize N+1 queries

---

### SlowMQTTProcessing

**Trigger**: `histogram_quantile(0.95, mqtt_message_duration) > 500` for 5 minutes

**Meaning**: MQTT message processing slow

**Response**:
1. Identify slow flow nodes:
   ```bash
   docker compose logs nodered | grep "flow duration" | sort -rn
   ```
2. Optimize flows:
   - Use async functions
   - Cache lookups
   - Batch operations
3. Profile Node-RED flows (enable debug mode)

---

## 🟡 System Alerts

### HighQueueSize

**Trigger**: `mqtt_queue_size > 8000` for 3 minutes

**Meaning**: Queue growing, performance degrading

**Response**:
1. Monitor queue trend
2. Check consumer health
3. Scale processing if needed

---

### HighRetryRate

**Trigger**: `rate(retry_attempts[5m]) > 5` for 5 minutes

**Meaning**: Too many retries, upstream dependency unstable

**Response**:
1. Check retry reasons (logs)
2. Verify dependency health (API, MQTT, DB)
3. Adjust retry backoff strategy

---

### HighTraceCount

**Trigger**: `active_traces > 800` for 5 minutes

**Meaning**: Too many active traces, memory concern

**Response**:
1. Check Jaeger UI (http://localhost:16686)
2. Reduce tracing sample rate:
   ```javascript
   // flows/nodered/lib/tracing.js
   sampleRate: 0.1,  // Reduce from 1.0
   ```

---

## ℹ️ Business Alerts

### LowMessageThroughput

**Trigger**: `rate(mqtt_messages_total[10m]) < 0.1` for 10 minutes

**Meaning**: Abnormally low activity, potential issue

**Response**:
1. Verify devices online
2. Check MQTT broker connectivity
3. Review automation schedules

---

### LowMQTTSuccessRate

**Trigger**: `mqtt_success_ratio < 0.95` for 5 minutes

**Meaning**: Too many failed messages

**Response**:
1. Check error rate alert (above)
2. Review message validation rules
3. Verify schema compatibility

---

## 📢 Alertmanager Configuration

**Location**: `compose/config/alertmanager/alertmanager.yml`

### Routing

```yaml
route:
  receiver: 'default'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  
  routes:
    - match:
        severity: critical
      receiver: critical
      group_wait: 0s
      repeat_interval: 10m
    
    - match:
        severity: warning
      receiver: warning
      group_wait: 30s
      repeat_interval: 1h
    
    - match:
        severity: info
      receiver: info
      group_wait: 5m
      repeat_interval: 24h
```

### Receivers

#### Critical (Discord + Email)

```yaml
receivers:
  - name: critical
    discord_configs:
      - webhook_url: '${DISCORD_WEBHOOK_URL}'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        message: |
          **Summary**: {{ .CommonAnnotations.summary }}
          
          **Description**: {{ .CommonAnnotations.description }}
          
          **Action**: {{ .CommonAnnotations.action }}
    
    email_configs:
      - to: 'admin@smarthome.local'
        from: 'alertmanager@smarthome.local'
        subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
```

#### Warning (Discord)

```yaml
  - name: warning
    discord_configs:
      - webhook_url: '${DISCORD_WEBHOOK_URL}'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
```

#### Info (Local Webhook)

```yaml
  - name: info
    webhook_configs:
      - url: 'http://localhost:1880/alertmanager-webhook'
```

### Inhibition Rules

```yaml
inhibit_rules:
  # ServiceDown silences performance warnings
  - source_match:
      severity: critical
      alertname: ServiceDown
    target_match:
      severity: warning
    equal: ['job']
  
  # CircuitBreakerOpen silences retry warnings
  - source_match:
      alertname: CircuitBreakerOpen
    target_match:
      alertname: HighRetryRate
    equal: ['component']
```

---

## 📬 Notification Channels

### Discord Setup

```bash
# 1. Create Discord webhook
# Discord Server → Settings → Integrations → Webhooks → New Webhook

# 2. Copy webhook URL
# https://discord.com/api/webhooks/123456789/abcdefg...

# 3. Add to .env
echo "DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/..." >> compose/.env

# 4. Restart Alertmanager
docker compose restart alertmanager

# 5. Test
curl -X POST "${DISCORD_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test alert from SmartHome"}'
```

### Email Setup

```yaml
# compose/config/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'smarthome@example.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'
  smtp_require_tls: true

receivers:
  - name: email
    email_configs:
      - to: 'admin@example.com'
```

**Gmail App Password**:
1. Google Account → Security → 2-Step Verification
2. App passwords → Generate
3. Use generated password in config

---

## 🛠️ Alert Response Procedures

### Critical Alert Workflow

1. **Receive notification** (Discord/Email immediately)
2. **Acknowledge** (reply in Discord thread)
3. **Assess impact**:
   - Check Grafana dashboards
   - View Prometheus metrics
   - Review service logs
4. **Mitigate**:
   - Restart failing service
   - Increase resource limits
   - Rollback recent changes
5. **Resolve root cause**:
   - Fix code/config issue
   - Deploy hotfix
   - Update documentation
6. **Post-mortem**:
   - Document incident
   - Update alert thresholds
   - Prevent recurrence

### Warning Alert Workflow

1. **Receive notification** (batched, 30s-1h delay)
2. **Triage** (assess severity)
3. **Schedule fix** (if non-urgent)
4. **Monitor** (check if auto-resolves)
5. **Fix proactively** (before becomes critical)

---

## 🔧 Tuning & Customization

### Adjust Thresholds

```yaml
# Example: Increase DLQ threshold
alert: DLQBacklog
expr: dlq_messages > 200  # Changed from 100
for: 10m                  # Changed from 5m
```

### Change Notification Timing

```yaml
# Example: Less frequent warnings
routes:
  - match:
      severity: warning
    repeat_interval: 6h  # Changed from 1h
```

### Add Custom Alert

```yaml
groups:
  - name: custom_alerts
    interval: 30s
    rules:
      - alert: HighEnergyUsage
        expr: power_consumption_watts > 5000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High energy usage ({{ $value }}W)"
          action: "Check device power consumption"
```

### Silence Alerts

```bash
# Silence specific alert for 2 hours
curl -X POST http://localhost:9093/api/v1/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [
      {"name": "alertname", "value": "HighMQTTErrorRate", "isRegex": false}
    ],
    "startsAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "endsAt": "'$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%S.000Z)'",
    "createdBy": "admin",
    "comment": "Maintenance window"
  }'

# View silences
curl http://localhost:9093/api/v1/silences | jq

# Delete silence
curl -X DELETE http://localhost:9093/api/v1/silence/<silence_id>
```

---

## 📊 Metrics Reference

| Metric | Type | Description |
|--------|------|-------------|
| `circuit_breaker_state` | Gauge | 0=Closed, 1=Half-Open, 2=Open |
| `mqtt_messages_total` | Counter | Total MQTT messages processed |
| `mqtt_errors_total` | Counter | Total MQTT errors |
| `dlq_messages` | Gauge | Current DLQ size |
| `rate_limit_rejected` | Counter | Rate limit rejections |
| `mqtt_queue_size` | Gauge | Current queue size |
| `http_request_duration` | Histogram | API response times |
| `mqtt_message_duration` | Histogram | MQTT processing times |
| `retry_attempts` | Counter | Retry attempts |
| `up` | Gauge | Service health (1=up, 0=down) |
| `active_traces` | Gauge | Active Jaeger traces |

---

## 🔗 Quick Links

- **Prometheus UI**: http://localhost:9090
- **Alertmanager UI**: http://localhost:9093
- **Grafana Dashboards**: http://localhost:3001
- **Jaeger Tracing**: http://localhost:16686

---

**Poznámka**: Pre production deployment odporúčame:
- PagerDuty/OpsGenie pre on-call rotation
- Slack integration pre team notifications
- Webhook pre ticketing system (Jira, ServiceNow)
- Alert analytics (trend analysis, false positive detection)
