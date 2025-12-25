# Production Readiness - Implementované Features

## ✅ Fáza 3: Reliability & Config Management

### Config Hot Reload (2h)
**Umiestnenie:** `flows/nodered/lib/config-watcher.js`

- ✅ Chokidar file watcher sleduje zmeny v `config/modes.yaml`
- ✅ Automatická validácia pomocou JSON Schema pred reloadom
- ✅ Detekcia zmien (pridané/odstránené/upravené režimy)
- ✅ Debouncing (1s) pre viacnásobné zmeny
- ✅ Publikovanie `config:reloaded` eventu do MQTT
- ✅ Žiadne reštarty Node-RED potrebné

**Použitie:**
```javascript
// Config watcher je automaticky spustený v init.js
global.configWatcher.start();

// Subscribe to reload events
RED.events.on('config:reloaded', ({ config, changes }) => {
  logger.info('Config changed:', changes.summary);
});
```

### Rate Limiting & Backpressure (4h)
**Umiestnenie:** `flows/nodered/lib/rate-limiter.js`

- ✅ Token bucket algoritmus s konfigurovateľnou kapacitou
- ✅ Per-topic rate limiting (cmd/#: 5msg/s, virt/#: 10msg/s, stat/#: 20msg/s)
- ✅ Queue monitor s warning (80%) a critical (95%) thresholds
- ✅ Automatické zahodenie správ pri pretečení fronty
- ✅ Metriky pre Prometheus

**Použitie:**
```javascript
// Check if message should be rate limited
if (!global.rateLimiter.allow(topic)) {
  logger.warn('Rate limit exceeded', { topic });
  return null;
}

// Check queue health
const status = global.queueMonitor.checkQueue(currentSize);
if (status.action === 'drop') {
  logger.error('Queue overflow, dropping messages');
}
```

---

## ✅ Fáza 5: Observability & Monitoring

### Distributed Tracing - Jaeger (8h)
**Umiestnenie:** `flows/nodered/lib/tracing.js` + Docker container

- ✅ Jaeger all-in-one container (UI na :16686)
- ✅ TracingService s 128-bit trace IDs a 64-bit span IDs
- ✅ In-memory trace storage (max 1000 traces)
- ✅ Zipkin JSON formát pre Jaeger ingest
- ✅ MQTT handler wrapper pre automatický tracing
- ✅ Trace propagation cez payloads

**Použitie:**
```javascript
const tracing = require('./lib/tracing');

// Start a trace
const traceId = tracing.startTrace('handle_command', {
  topic: msg.topic,
  payload: msg.payload
});

// Log events
tracing.logToSpan(traceId, 'validation_passed');

// Finish trace
tracing.finishSpan(traceId);

// Or wrap MQTT handler
const wrappedHandler = tracing.wrapMqttHandler(handler, 'command_handler');
```

**Jaeger UI:** http://localhost:16686

### Metrics Endpoint - Prometheus (4h)
**Umiestnenie:** 
- Node-RED: `flows/nodered/lib/metrics.js`
- UI: `ui/smarthome-ui/src/app/api/metrics/route.ts`
- Config: `compose/config/prometheus/prometheus.yml`

- ✅ Prometheus container (UI na :9090)
- ✅ Custom metrics collector pre Node-RED
- ✅ Exportované metriky: mqtt_messages_total, circuit_breaker_state, rate_limit_rejected, retry_attempts, dlq_messages
- ✅ Histogram metriky s percentilami (p50, p95, p99)
- ✅ Scrape konfigurácia pre všetky služby (nodered, ui, mosquitto)
- ✅ JSON endpoint pre debugging (/metrics/json)

**Endpoints:**
- Node-RED: http://localhost:1880/metrics
- UI: http://localhost:3000/api/metrics
- Prometheus UI: http://localhost:9090

**Príklad metrík:**
```
# HELP mqtt_messages_total Total MQTT messages processed
# TYPE mqtt_messages_total counter
mqtt_messages_total{topic="cmd/living_room/light",status="success"} 1234

# HELP circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)
# TYPE circuit_breaker_state gauge
circuit_breaker_state{name="mqtt_broker"} 0

# HELP rate_limit_rejected Messages rejected by rate limiter
# TYPE rate_limit_rejected counter
rate_limit_rejected 42
```

---

## ✅ Fáza 6: Production Hardening

### Automated Backups (3h)
**Umiestnenie:** `scripts/backup.sh`, `scripts/restore.sh`, `scripts/verify-backup.sh`

**Čo sa zálohuje:**
- ✅ modes.yaml + schema
- ✅ Node-RED flows.json + credentials
- ✅ Node-RED context (persistent state)
- ✅ MQTT retained messages (export cez mosquitto_sub)
- ✅ Grafana dashboards a data
- ✅ InfluxDB snapshots
- ✅ Zigbee2MQTT konfigurácia
- ✅ Backup manifest s checksum validáciou

**GitHub Actions:** `.github/workflows/backup.yml`
- Denné zálohy o 3:00 UTC
- Automatická verifikácia
- Upload do GitHub Artifacts (30 dní)
- Voliteľný S3 upload
- Cleanup starých záloh

**Použitie:**
```bash
# Manuálny backup
./scripts/backup.sh

# Backup s custom destinaciou
./scripts/backup.sh /mnt/usb/backups

# Verifikácia zálohy
./scripts/verify-backup.sh backups/smarthome_backup_20241225_120000.tar.gz

# Restore
./scripts/restore.sh backups/smarthome_backup_20241225_120000.tar.gz
```

### Security Audit (6h)
**Umiestnenie:** `scripts/security-audit.sh`

**Čo audit kontroluje:**
- ✅ npm audit pre Node-RED dependencies
- ✅ npm audit pre UI dependencies
- ✅ Trivy scan všetkých Docker images
- ✅ Filesystem permissions (world-writable files)
- ✅ Credential files (kontrola .gitignore)
- ✅ MQTT security (anonymous access, TLS, ACL)
- ✅ Network exposure (exposed ports)
- ✅ Automatický report s odporúčaniami

**Použitie:**
```bash
# Spustiť audit
./scripts/security-audit.sh

# Výsledky v security-reports/
ls security-reports/
# npm-audit-nodered-20241225_120000.json
# npm-audit-ui-20241225_120000.json
# trivy-mosquitto-20241225_120000.json
# summary-20241225_120000.md
```

### Load Testing (1h)
**Umiestnenie:** `tests/load/`

**API Stress Test:** `api-stress.js`
- ✅ 5-fázový test (warm up → normal → high → stress → cool down)
- ✅ Testuje homepage, weather API, metrics endpoint
- ✅ Thresholdy: p95 < 2s, p99 < 5s, error rate < 5%
- ✅ HTML report generátor

**MQTT Flood Test:** `mqtt-flood.js`
- ✅ Simuluje 100 concurrent VUs
- ✅ Testuje rôzne MQTT topics (cmd, event, virt, stat)
- ✅ Rate limiting verification
- ✅ Thresholdy: p95 < 500ms, p99 < 1s, error rate < 10%

**Použitie:**
```bash
# Inštalácia K6
sudo apt-get install k6

# Spustiť všetky testy
./tests/load/run-load-tests.sh

# Samostatné testy
k6 run --vus 100 --duration 3m tests/load/api-stress.js
k6 run --vus 50 --duration 2m tests/load/mqtt-flood.js
```

---

## 🎯 Kompletný Tech Stack

### Infrastructure
- **Docker Compose:** Orchestrácia všetkých služieb
- **Jaeger:** Distributed tracing (port 16686)
- **Prometheus:** Metrics collection (port 9090)
- **Grafana:** Dashboarding (port 3001)
- **InfluxDB:** Time-series data

### Node-RED Libraries
```
flows/nodered/lib/
├── logger.js              # Winston logger with rotation
├── error-handler.js       # Retry, Circuit Breaker, DLQ
├── graceful-shutdown.js   # SIGTERM handling
├── config-watcher.js      # Hot reload with Chokidar
├── rate-limiter.js        # Token bucket + queue monitor
├── tracing.js             # Jaeger integration
├── metrics.js             # Prometheus exporter
└── init.js                # Initialize all services
```

### UI Features
- **Next.js 14:** React SSR framework
- **Zustand:** State management
- **MQTT.js:** Real-time communication
- **Error boundaries:** React crash recovery
- **Metrics endpoint:** /api/metrics

---

## 📊 Monitoring & Debugging

### 1. Jaeger Tracing
```
http://localhost:16686
```
- Hľadaj traces podľa service/operation
- Analyzuj latency bottlenecks
- Sleduj MQTT message flow

### 2. Prometheus Metrics
```
http://localhost:9090
```
**Užitočné queries:**
```promql
# Rate limit rejection rate
rate(rate_limit_rejected[5m])

# Circuit breaker openings
changes(circuit_breaker_state[1h])

# MQTT message throughput
rate(mqtt_messages_total[1m])

# p95 latency
histogram_quantile(0.95, mqtt_message_duration_ms)
```

### 3. Node-RED Metrics
```
http://localhost:1880/metrics/json
```
JSON endpoint pre debugging - zobrazí všetky metriky v čitateľnom formáte.

---

## 🚀 Deployment Checklist

### Pre-Production
- [ ] Spustiť security audit: `./scripts/security-audit.sh`
- [ ] Fixnúť všetky CRITICAL a HIGH vulnerabilities
- [ ] Konfigurovať MQTT ACL (topic-level permissions)
- [ ] Povoliť TLS pre Mosquitto (port 8883)
- [ ] Nastaviť firewall (blokovať všetky porty okrem potrebných)
- [ ] Konfigurovať backupy (GitHub Actions + S3)
- [ ] Spustiť load testy: `./tests/load/run-load-tests.sh`
- [ ] Verifikovať rate limiting funguje správne
- [ ] Nastaviť Grafana alerting rules
- [ ] Dokumentovať kapacity (max VUs, throughput)

### Post-Deployment
- [ ] Monitorovať Jaeger pre errory
- [ ] Sledovať Prometheus metriky
- [ ] Kontrolovať logy: `docker compose logs -f nodered`
- [ ] Verifikovať backupy: `./scripts/verify-backup.sh`
- [ ] Testovať restore process
- [ ] Sledovať circuit breaker state
- [ ] Kontrolovať DLQ veľkosť

---

## 📝 Estimáty Implementácie

| Fáza | Task | Estimate | Status |
|------|------|----------|--------|
| 3 | Config Hot Reload | 2h | ✅ |
| 3 | Rate Limiting | 4h | ✅ |
| 5 | Distributed Tracing | 8h | ✅ |
| 5 | Metrics Endpoint | 4h | ✅ |
| 6 | Automated Backups | 3h | ✅ |
| 6 | Security Audit | 6h | ✅ |
| 6 | Load Testing | 1h | ✅ |
| **TOTAL** | | **28h** | **100%** |

---

## 🔧 Maintenance

### Weekly
- Skontrolovať backup reports (GitHub Actions)
- Prečítať security audit summary

### Monthly
- Spustiť load testy
- Aktualizovať dependencies (npm audit fix)
- Rescan Docker images (Trivy)

### Quarterly
- Testovať restore process
- Rotate credentials
- Review Grafana dashboards
- Capacity planning (na základe Prometheus metrík)

---

## 📚 Dodatočné Zdroje

- **Jaeger Docs:** https://www.jaegertracing.io/docs/
- **Prometheus Docs:** https://prometheus.io/docs/
- **K6 Docs:** https://k6.io/docs/
- **Trivy Docs:** https://aquasecurity.github.io/trivy/

---

**Poznámka:** Všetky featury sú implementované a pripravené na produkčné nasadenie. Pre aktiváciu:

```bash
cd compose
docker compose up -d

# Verify services
docker compose ps
curl http://localhost:1880/metrics
curl http://localhost:16686
curl http://localhost:9090
```
