# Návrh ďalších krokov - Production Readiness

## 🎯 Aktuálny stav

**Hotové** (22h implementácie):
- ✅ Environment Validation
- ✅ Structured Logging (UI + Node-RED)
- ✅ MQTT QoS Policy
- ✅ Error Boundaries (UI)
- ✅ Health Check Endpoints
- ✅ Config Validation
- ✅ Centralized Logging (Winston)
- ✅ Error Handling Middleware (Retry, Circuit Breaker, DLQ)
- ✅ Graceful Shutdown (SIGTERM)

**Zostávajúce gaps**: 11 položiek (z pôvodných 20)

## 📋 Odporúčaný roadmap

### Fáza 3: Reliability & Performance (6h)

#### 1. Config Hot Reload (2h) ⭐ QUICK WIN
**Prečo teraz**: Eliminuje nutnosť reštartov pri zmene modes.yaml

**Implementácia**:
- File watcher s chokidar
- Validation pred reload
- Graceful transition medzi režimami
- MQTT notification o zmene

**Súbory**:
```
flows/nodered/lib/config-watcher.js
flows/nodered/lib/config-loader.js
```

**Benefit**: Zero-downtime config changes

---

#### 2. Rate Limiting & Backpressure (4h)
**Prečo**: Ochrana pred MQTT floods a memory leaks

**Implementácia**:
- Token bucket algorithm pre MQTT topics
- Queue size limits
- Backpressure metrics (dropped messages)
- Warning thresholds

**Súbory**:
```
flows/nodered/lib/rate-limiter.js
flows/nodered/lib/mqtt-queue-monitor.js
```

**Benefit**: Stabilita pri high load

---

### Fáza 4: Security & Authentication (7h)

#### 3. API Authentication (5h)
**Prečo**: Aktuálne REST API je nezabezpečené

**Implementácia**:
- JWT tokens (access + refresh)
- API key management
- Rate limiting per client
- Token refresh endpoint

**Súbory**:
```
ui/smarthome-ui/src/middleware/auth.ts
ui/smarthome-ui/src/lib/jwt.ts
ui/smarthome-ui/src/app/api/auth/login/route.ts
ui/smarthome-ui/src/app/api/auth/refresh/route.ts
```

**Benefit**: Bezpečný prístup k API

---

#### 4. Secret Management (2h)
**Prečo**: Heslá sú v .env plaintext

**Implementácia**:
- Docker secrets support
- Environment variable encryption
- Secret rotation procedure
- Audit logging

**Súbory**:
```
compose/secrets/
scripts/rotate-secrets.sh
docs/runbooks/secret-rotation.md
```

**Benefit**: PCI/GDPR compliance ready

---

### Fáza 5: Observability (12h)

#### 5. Distributed Tracing (8h)
**Prečo**: Trace_id je už všade, ale nemáme visualization

**Implementácia**:
- Jaeger all-in-one container
- OpenTelemetry SDK
- Automatic trace propagation
- Span annotations

**Súbory**:
```
compose/docker-compose.yml (jaeger service)
flows/nodered/lib/tracing.js
ui/smarthome-ui/src/lib/tracing.ts
```

**UI**: http://localhost:16686 (Jaeger UI)

**Benefit**: End-to-end request visualization

---

#### 6. Metrics Endpoint (4h)
**Prečo**: Prometheus monitoring

**Implementácia**:
- Prometheus client
- Custom metrics (MQTT msg/s, errors, retries)
- Grafana dashboards
- Alerting rules

**Súbory**:
```
flows/nodered/lib/metrics.js
ui/smarthome-ui/src/app/api/metrics/route.ts
compose/config/grafana/dashboards/smarthome.json
compose/config/prometheus/prometheus.yml
```

**Benefit**: Real-time monitoring & alerts

---

### Fáza 6: Production Hardening (10h)

#### 7. Automated Backups (3h)
**Prečo**: Data loss prevention

**Implementácia**:
- Daily backups (modes.yaml, flows.json, MQTT retained)
- S3/local storage
- Point-in-time recovery
- Backup verification

**Súbory**:
```
scripts/backup.sh
scripts/restore.sh
.github/workflows/backup.yml
```

**Schedule**: Daily 3:00 AM

---

#### 8. Security Audit (6h)
**Prečo**: Production deployment requirements

**Implementácia**:
- npm audit fix
- Docker image scanning (Trivy)
- OWASP dependency check
- Network policy review

**Súbory**:
```
.github/workflows/security-scan.yml (enhance)
docs/security/audit-report.md
```

**Benefit**: Vulnerability-free deployment

---

#### 9. Load Testing (1h)
**Prečo**: Overiť performance limits

**Implementácia**:
- K6 load tests
- MQTT message flood simulation
- Memory leak detection
- Response time benchmarks

**Súbory**:
```
tests/load/mqtt-flood.js
tests/load/api-stress.js
```

**Benefit**: Known capacity limits

---

## 🎯 Odporúčaná priorita

### Týždeň 1 (6h)
1. ✅ **Config Hot Reload** (2h) - Immediate value
2. ✅ **Rate Limiting** (4h) - Stability

### Týždeň 2 (7h)
3. ✅ **API Authentication** (5h) - Security
4. ✅ **Secret Management** (2h) - Compliance

### Týždeň 3 (12h)
5. ✅ **Distributed Tracing** (8h) - Observability
6. ✅ **Metrics Endpoint** (4h) - Monitoring

### Týždeň 4 (10h)
7. ✅ **Automated Backups** (3h) - Data safety
8. ✅ **Security Audit** (6h) - Production readiness
9. ✅ **Load Testing** (1h) - Performance validation

---

## 📊 Celkový prehľad

| Fáza | Úlohy | Čas | Priorita |
|------|-------|-----|----------|
| Fáza 1-2 (Hotové) | 9 úloh | 22h | ✅ |
| Fáza 3 | 2 úlohy | 6h | 🔥 HIGH |
| Fáza 4 | 2 úlohy | 7h | 🔥 HIGH |
| Fáza 5 | 2 úlohy | 12h | 🟡 MEDIUM |
| Fáza 6 | 3 úlohy | 10h | 🟢 LOW |
| **TOTAL** | **18 úloh** | **57h** | |

---

## 🚀 Quick Start - Fáza 3

Ak chceš pokračovať hneď:

```bash
# 1. Config Hot Reload implementation
Create: flows/nodered/lib/config-watcher.js
Update: flows/nodered/lib/config-loader.js
Test: Change modes.yaml → verify auto-reload

# 2. Rate Limiting implementation  
Create: flows/nodered/lib/rate-limiter.js
Create: flows/nodered/lib/mqtt-queue-monitor.js
Test: MQTT flood → verify throttling
```

Potvrď ak chceš aby som implementoval Fázu 3, alebo navrhni inú prioritu! 🎯
