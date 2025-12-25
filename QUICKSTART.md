# Quick Start - Production Features

## 🚀 5-minútový setup

### 1. Aktualizuj projekt

```bash
cd /home/pi/smarthome
git pull origin main
```

### 2. Nainštaluj závislosti

```bash
# Node-RED
cd flows/nodered
npm install

# UI (ak chceš rebuild)
cd ../../ui/smarthome-ui
npm install
npm run build
```

### 3. Spusť služby

```bash
cd ../../compose
docker compose up -d
```

### 4. Overiť monitoring

```bash
# Node-RED metrics
curl http://localhost:1880/metrics

# Jaeger UI
open http://localhost:16686

# Prometheus UI
open http://localhost:9090
```

---

## 📊 Monitoring Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| Jaeger UI | http://localhost:16686 | Distributed tracing |
| Prometheus | http://localhost:9090 | Metrics collection |
| Node-RED Metrics | http://localhost:1880/metrics | Prometheus format |
| Node-RED JSON | http://localhost:1880/metrics/json | Debug format |
| UI Metrics | http://localhost:3000/api/metrics | UI stats |

---

## 🔍 Quick Checks

### Je config hot reload aktívny?

```bash
# Urob zmenu v modes.yaml
nano config/modes.yaml

# Watch logy (mali by ukázať reload)
docker compose logs -f nodered | grep -i reload
```

### Funguje rate limiting?

```bash
# Skontroluj aktuálne metriky
curl -s http://localhost:1880/metrics/json | jq .rateLimiter

# Output:
# {
#   "allowed": 1234,
#   "rejected": 5,
#   "rejectionRate": 0.004
# }
```

### Sú traces v Jaeger?

```bash
# Query Jaeger API
curl 'http://localhost:16686/api/traces?service=nodered&limit=10'
```

### Prometheus scrapuje?

```bash
# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=up'

# Všetky targety by mali byť up=1
```

---

## 💾 Backup & Restore

### Vytvor backup

```bash
./scripts/backup.sh

# Output: backups/smarthome_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Overiť backup

```bash
./scripts/verify-backup.sh backups/smarthome_backup_*.tar.gz

# Output: Checksum verification passed ✓
```

### Restore (ak treba)

```bash
./scripts/restore.sh backups/smarthome_backup_20241225_120000.tar.gz

# ⚠️ WARNING: Toto prepíše aktuálnu konfiguráciu!
```

---

## 🔒 Security Audit

### Spusť audit

```bash
./scripts/security-audit.sh

# Output: security-reports/summary-TIMESTAMP.md
```

### Fixni vulnerabilities

```bash
# Node-RED
cd flows/nodered
npm audit fix

# UI
cd ../../ui/smarthome-ui
npm audit fix
```

---

## 🧪 Load Testing

### API stress test

```bash
# Install K6 (first time only)
sudo apt-get install k6

# Run test
k6 run --vus 50 --duration 2m tests/load/api-stress.js

# Output: load-test-api-results.json + .html
```

### Interpretácia výsledkov

```
✓ Homepage status 200        // Všetky requesty úspešné
✓ API response time < 1s     // Latency OK
✗ Error rate < 5%            // Ak fail, investigate!

p95: 234ms   // 95% requestov pod 234ms ✓
p99: 567ms   // 99% requestov pod 567ms ✓
```

---

## 🎯 Common Tasks

### Pridať nový MQTT topic rate limit

```javascript
// V flows/nodered/lib/init.js
global.rateLimiter.setLimit('mynew/topic/#', 15, 1);
//                           topic pattern   msgs  per sec
```

### Sledovať circuit breaker

```bash
watch -n 5 'curl -s http://localhost:1880/metrics/json | jq .circuitBreaker'

# Output:
# {
#   "mqtt_broker": 0   // 0=closed (OK), 1=half-open, 2=open (BAD)
# }
```

### Checkuj dead letter queue

```bash
curl -s http://localhost:1880/metrics/json | jq .errorHandler.dlqSize

# Ak > 0, investigate logy:
docker compose logs nodered | grep -i dlq
```

### Exportuj Prometheus metriky

```bash
curl http://localhost:1880/metrics > metrics-snapshot.txt

# Analyzuj v externe (napr. Grafana import)
```

---

## 🐛 Troubleshooting

### Node-RED nereaguje

```bash
# Check container
docker compose ps nodered

# Check logs
docker compose logs --tail=50 nodered

# Restart
docker compose restart nodered
```

### Jaeger neukazuje traces

```bash
# Check Jaeger health
curl http://localhost:14269

# Ak unhealthy, restart
docker compose restart jaeger
```

### Prometheus nescrapuje

```bash
# Check Prometheus config
docker compose exec prometheus cat /etc/prometheus/prometheus.yml

# Check targets
curl http://localhost:9090/api/v1/targets

# Restart
docker compose restart prometheus
```

### Backup zlyhá

```bash
# Debug mode
bash -x ./scripts/backup.sh

# Skontroluj permissions
ls -la scripts/backup.sh

# Manuálne súbory
tar -czf manual.tar.gz config/ flows/nodered/flows.json
```

---

## 📈 Performance Tips

### Znížiť log spam

V `flows/nodered/lib/logger.js`:
```javascript
level: 'warn'  // Instead of 'info'
```

### Optimalizovať Prometheus scrape

V `compose/config/prometheus/prometheus.yml`:
```yaml
scrape_interval: 30s  # Instead of 10s
```

### Redukovať trace storage

V `flows/nodered/lib/tracing.js`:
```javascript
this.maxTraces = 500;  // Instead of 1000
```

---

## 🔗 Links

- **Production Readiness Docs:** [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)
- **Main README:** [README.md](./README.md)

---

## 📞 Support

Pri problémoch:

1. Check logs: `docker compose logs -f`
2. Check metrics: http://localhost:1880/metrics/json
3. Check Jaeger: http://localhost:16686
4. Create GitHub issue s logmi

---

**Happy monitoring! 📊🚀**
