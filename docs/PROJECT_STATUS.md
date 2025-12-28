# SmartHome - Stav Projektu

**Aktualizované:** 28. Decembra 2025  
**Status:** ✅ Production-Ready

---

## 📊 Prehľad Systému

SmartHome je plne funkčný systém automatizácie domácnosti s pokročilým riadením vykurovania, kalendárovou integráciou a vzdialeným monitoringom. Systém je nasadený v produkcii a aktívne prevádzkovaný.

### Hlavné Komponenty

| Komponent | Verzia | Status | Účel |
|-----------|--------|--------|------|
| **Node-RED** | latest | ✅ Healthy | Riadiaca logika, automatizácia |
| **Mosquitto MQTT** | 2.x | ✅ Healthy | Message broker |
| **Next.js UI** | 14.2.35 | ✅ Healthy | Webové rozhranie (port 8088) |
| **Baïkal CalDAV** | latest | ✅ Healthy | Kalendárový server |
| **InfluxDB** | 2.x | ✅ Healthy | Časové dáta, metriky |
| **Grafana** | latest | ✅ Healthy | Vizualizácie, dashboardy |
| **Redis** | 7-alpine | ✅ Healthy | Cache (weather, config) |
| **Prometheus** | latest | ✅ Healthy | Metriky, alerting |
| **Jaeger** | latest | ✅ Healthy | Distributed tracing |
| **Alertmanager** | latest | ✅ Healthy | Alert routing |
| **Apprise** | latest | ✅ Healthy | Notifikačný server |
| **Zigbee2MQTT** | latest | ⏸️ Stopped | Zigbee gateway (HW chýba) |

**Služby:** 11/12 healthy (92%) - Zigbee2MQTT zastavaný kvôli chýbajúcemu USB adapteru (očakávané)

---

## 🎯 Implementované Funkcie

### 1. Riadenie Vykurovania

#### Režimy
- **DOMA** - Plný komfort (21-23°C)
- **PREČ** - Úsporný režim (18-19°C) 
- **SPÁNOK** - Nočné zníženie (19-20°C)
- **BOOST** - Dočasné zvýšenie (+2°C, 30-120 min)
- **PRÁZDNINY** - Minimálne vykurovanie (16°C)

#### Kalendárová Integrácia
- Google Calendar sync (výber primary + sekundárnych kalendárov)
- Baïkal CalDAV (lokálny server pre manuálne udalosti)
- Automatická detekcia sviatkov (CZ/SK)
- Cron trigger: daily 00:05 (holiday detection)

#### Teploty a Override
- **modes.yaml** - Centrálna konfigurácia teplôt pre všetky miestnosti
- **Override systém** - Dočasné prepisovanie režimov
- **Config hot reload** - Zmeny modes.yaml bez reštartu

### 2. MQTT Architektúra

#### Topic Konvencie
- `cmd/*` - Príkazy pre zariadenia (TRV ventily, termostaty)
- `stat/*` - Stavy zo zariadení (teploty, humidity, RSSI)
- `virt/*` - Virtuálne/vypočítané hodnoty
- `event/*` - Udalosti (calendar, holiday, režim zmena)
- `internal/*` - Inter-flow komunikácia (recalc, notify)
- `meta/*` - Metadata, service monitoring

#### Štatistiky
- **IN patterns:** 23 MQTT subscribe topics
- **OUT topics:** 39 MQTT publish topics  
- **Orphaned cleanup:** 51 identifikovaných → 47 overených, 3 odstránené

### 3. API Endpointy

**Next.js UI (port 8088):**
- `GET /api/rooms` - Zoznam miestností s aktuálnymi teplotami
- `GET /api/mode` - Aktuálny režim pre všetky miestnosti
- `GET /api/status` - Systémový status (weekend/weekday mode)
- `GET /api/override` - Override mapa (dočasné prepisovanie)
- `GET /api/calendars` - Zoznam pripojených kalendárov
- `POST /api/mode` - Zmena režimu
- `POST /api/override` - Nastavenie override

**Node-RED (port 1880):**
- `GET /metrics` - Prometheus metriky (text format)
- `GET /metrics/json` - Metriky v JSON formáte
- `GET /health` - Healthcheck endpoint
- `POST /webhook/calendar` - Webhook pre calendar events

### 4. Monitoring & Observability

#### Metriky (Prometheus)
- `mqtt_messages_total{topic}` - MQTT message counter
- `mqtt_error_total{error_type}` - MQTT error rate
- `circuit_breaker_state{service}` - Circuit breaker status (0=closed, 1=half-open, 2=open)
- `rate_limit_rejected_total{topic}` - Rate limiter rejections
- `dlq_size` - Dead Letter Queue size
- `cache_hits_total` / `cache_misses_total` - Redis cache stats
- `api_response_time_ms{endpoint}` - API latency

#### Alerting (17 Alertov)

**Critical (5):**
- CircuitBreakerOpen - MQTT broker nedostupný
- DLQCritical - >50 failed messages v DLQ
- RateLimitCritical - >1000 rejected/min
- QueueOverflow - >100000 messages v queue
- ServiceDown - Service healthcheck failed

**Warning (9):**
- HighMQTTErrorRate - >100 errors/min
- DLQBacklog - 10-50 messages v DLQ
- SlowAPIResponses - >2s response time
- SlowMQTTProcessing - >1s MQTT latency
- HighQueueSize - 50000-100000 messages
- HighRetryRate - >50 retries/min
- HighTraceCount - >10000 traces/hour

**Info (3):**
- LowMessageThroughput - <10 msg/min
- LowMQTTSuccessRate - <95% success rate
- SystemInfo - Pravidelné notifikácie

#### Distributed Tracing
- Jaeger UI: http://localhost:16686
- Trace context propagation (MQTT → API → Calendar)
- Latency profiling, bottleneck detection

#### Dashboards
- Grafana: http://localhost:3000
- Custom dashboards (MQTT throughput, API latency, alerts)
- InfluxDB datasource (historical data)

### 5. Performance & Reliability

#### Redis Caching
- **Weather API cache** - 10 min TTL
- **Modes config cache** - No TTL (manual invalidation)
- **MQTT state cache** - 1 hour TTL
- Cache hit/miss tracking

#### Rate Limiting
- **MQTT topics** - 100 req/min default
- **Custom limits** - Konfigurovateľné per-topic
- Backpressure protection

#### Circuit Breaker
- **MQTT broker** - Auto-recovery po 30s
- **External APIs** - Failover na cache
- State monitoring cez metriky

#### Error Handling
- **Dead Letter Queue** - Failed messages archív
- **Retry mechanism** - Exponential backoff
- **Fallback responses** - Cached data pri API failure

### 6. Testing

#### Integration Tests (37 testov)
- **Playwright E2E** - 14 testov (homepage, navigation, MQTT connection)
- **MQTT tests** - 10 testov (pub/sub, QoS, retained messages, wildcards)
- **API contract** - 9 testov (weather, metrics, caching, error handling)
- **Load tests** - K6 scenarios (MQTT flood, API stress)

**CI/CD:**
- GitHub Actions workflows (integration-tests.yml)
- Automatické spúšťanie na push/PR
- Test results artifacts (retention 30 dní)

#### Security Scanning
- **npm audit** - Weekly scan (Node-RED + UI dependencies)
- **Trivy** - Docker image scanning (HIGH/CRITICAL)
- **GitHub issue creation** - Auto-report pri critical vulns
- Workflow: security-audit.yml

### 7. Security (LAN-optimized)

#### MQTT Access Control
- **Authentication** - bcrypt password file
- **ACL** - Topic-level permissions
  - `admin` - Full access (#)
  - `nodered` - System control (cmd/*, stat/*, internal/*)
  - `ui` - User interface (cmd/*, stat/* read-only)
  - `monitor` - Read-only monitoring (# read-only)
  - `guest` - Limited access (stat/*, cmd/living_room/*)
  - `anonymous` - Test topics only (test/*)

#### UI Authentication
- Basic Auth (username/password)
- Session cookies (24h TTL)
- CSRF protection

#### Network Security
- **Firewall** - UFW LAN-only access (optional)
- **Port exposure** - Minimálne (iba UI 8088, MQTT 1883/9001)
- **TLS/SSL** - Nie (LAN-only deployment)

### 8. Backups & Recovery

#### Automatizované Zálohy
- **Frekvencia** - Denné 03:00 UTC (GitHub Actions)
- **Retention** - 30 dní (GitHub Artifacts)
- **Obsah** - modes.yaml, flows.json, MQTT retained, Grafana dashboards

#### Backup Komponenty
- `scripts/backup.sh` - Vytvára archív (tar.gz)
- `scripts/verify-backup.sh` - Validuje integritu (checksum, syntax)
- `scripts/restore.sh` - Obnoví systém z archívu

#### S3 Upload (voliteľné)
- AWS S3 bucket upload
- STANDARD_IA storage class
- Automatická rotácia

### 9. CI/CD Pipeline

#### Workflows

**ci-cd.yml** - Main pipeline
- Lint & test (UI + unit tests)
- Docker build & validation
- Deploy to production (SSH)
- Health check after deploy

**integration-tests.yml** - Testing
- Playwright E2E tests
- MQTT integration tests  
- API contract tests
- Test artifacts upload

**security-scan.yml** - Security
- npm audit (Node-RED + UI)
- Trivy Docker scanning
- GitHub issue creation pri vulns

**backup.yml** - Daily backups
- Backup creation
- Verification
- GitHub Artifacts + S3 upload

#### Concurrency Control
- `cancel-in-progress: true` na všetkých workflows
- Group by ref (branch/tag)
- Zabráni paralelným behom

#### Secrets Management
- `DEPLOY_SSH_KEY` - SSH key pre production deploy
- `DEPLOY_HOST` / `DEPLOY_USER` - Production server
- `CODECOV_TOKEN` - Code coverage upload
- `BACKUP_S3_BUCKET` / `AWS_*` - S3 backup (optional)
- `DISCORD_WEBHOOK_URL` - Alert notifications (optional)

---

## 🔧 Konfigurácia

### Environment Premenné

**Požadované:**
- `MQTT_USER` - MQTT broker username (default: `nodered`)
- `MQTT_PASSWORD` - MQTT broker password
- `REDIS_HOST` - Redis hostname (default: `redis`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `TZ` - Timezone (default: `Europe/Bratislava`)

**Voliteľné:**
- `OPENWEATHER_API_KEY` - Weather API (fallback na cache)
- `NR_CRED_SECRET` - Node-RED credentials encryption
- `GOOGLE_CALENDAR_TOKEN` - Google Calendar OAuth token
- `DISCORD_WEBHOOK_URL` - Discord alerting
- `SMTP_*` - Email alerting (Alertmanager)

**Súbor:** `compose/.env` (vytvorený z `.env.example`)

### Hlavné Konfigy

| Súbor | Účel | Hot Reload |
|-------|------|-----------|
| `config/modes.yaml` | Teploty, režimy | ✅ Áno (file watch) |
| `config/modes.schema.json` | YAML validácia | ✅ Áno |
| `flows/nodered/flows.json` | Node-RED flows | ❌ Reštart |
| `compose/config/mosquitto/acl.conf` | MQTT permissions | ❌ Reštart |
| `compose/config/alertmanager/alertmanager.yml` | Alerting rules | ✅ Áno (reload API) |
| `compose/config/prometheus/prometheus.yml` | Scrape config | ✅ Áno (reload API) |

### Docker Logging
- **max-size:** 10m
- **max-file:** 3
- **driver:** json-file
- **Aplikované na:** všetky services (zabráni disk overflow)

---

## 📈 Výkon a Kapacita

### Measured Baselines

| Metrika | Hodnota | Poznámka |
|---------|---------|----------|
| **API Response Time** | <200ms | /metrics/json |
| **MQTT Latency** | <100ms | pub → sub |
| **Cache Hit Rate** | >70% | Weather API |
| **MQTT Throughput** | ~500 msg/min | Peak load |
| **Memory Usage** | ~800MB | Všetky služby |
| **CPU Usage** | <15% | Raspberry Pi 4 |

### Škálovateľnosť

**Aktuálna kapacita:**
- 12 miestností (simultánne)
- 50+ Zigbee/Z-Wave zariadení (teoreticky)
- 1000+ MQTT messages/min (rate limit)

**Limitujúce faktory:**
- Redis memory (default 1GB)
- Raspberry Pi CPU (4 cores)
- MQTT broker connections (1024 default)

---

## 🚨 Známe Limitácie

### Hardvér
- **Zigbee2MQTT** - Vyžaduje USB Zigbee coordinator (chýba)
- **Z-Wave JS UI** - Vyžaduje USB Z-Wave stick

### Funkcionalita
- **TLS/SSL** - Nie je implementované (LAN-only design)
- **OAuth2** - Nie je implementované (Basic Auth)
- **Multi-tenancy** - Single user deployment
- **Zigbee pairing** - Manual process (bez auto-discovery)

### Známe Bugy
- **Mosquitto healthcheck** - Občas false positive (ignored)
- **Jaeger sampling** - High trace volume (treba tuning)

---

## 📚 Dokumenty

### Hlavné
- [README.md](../README.md) - Project overview
- [QUICKSTART.md](../QUICKSTART.md) - 5-min setup
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [SECURITY_AUDIT_2025-12-27.md](../SECURITY_AUDIT_2025-12-27.md) - Security review

### Technické
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment (30 min)
- [TESTING.md](TESTING.md) - Testing guide
- [ALERTS.md](ALERTS.md) - Alert management
- [SECURITY.md](SECURITY.md) - Security configuration
- [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) - Production features
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Implementation details

### Architecture
- [architecture/README.md](architecture/README.md) - Architecture overview
- [architecture/c4-context.md](architecture/c4-context.md) - C4 diagrams
- [architecture/mqtt-topics.md](architecture/mqtt-topics.md) - MQTT schema
- [architecture/microservices-extraction-plan.md](architecture/microservices-extraction-plan.md) - Future roadmap

### Runbooks
- [runbooks/deployment.md](runbooks/deployment.md) - Deployment procedures
- [runbooks/config-validation.md](runbooks/config-validation.md) - Config management
- [runbooks/logging-error-handling.md](runbooks/logging-error-handling.md) - Error handling

### Audity (Archív)
- [MQTT_TOPICS_AUDIT.md](MQTT_TOPICS_AUDIT.md) - MQTT audit (261 lines)
- [PREMENNÉ_REVÍZIA.md](PREMENNÉ_REVÍZIA.md) - Variable audit (245 lines)

---

## 🎯 Budúci Vývoj (Voliteľný)

### High Priority
- ⏸️ Pripojenie USB Zigbee coordinator → Aktivácia Zigbee2MQTT
- ⏸️ Grafana dashboard templates (MQTT, API, alerts)
- ⏸️ Discord/Email notifikačné setup

### Medium Priority
- ⏸️ Load testing baseline (K6 benchmark runs)
- ⏸️ Alert threshold tuning (na základe real data)
- ⏸️ Unit testy pre Node-RED flows

### Low Priority
- ⏸️ TLS/SSL (ak external access)
- ⏸️ OAuth2 (ak multi-user)
- ⏸️ Chaos engineering tests
- ⏸️ Disaster recovery automation

**Poznámka:** Systém je plne funkčný a production-ready aj bez týchto vylepšení.

---

## 👥 Tím a Kontakt

**Autor:** Dantyk  
**Repository:** https://github.com/Dantyk/smarthome  
**License:** MIT

---

**Posledná aktualizácia:** 28. Decembra 2025  
**Verzia dokumentu:** 1.0
