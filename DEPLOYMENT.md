# Deployment Guide - Production Readiness

## 📦 Prvé nasadenie

### 1. Príprava systému

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install monitoring tools
sudo apt install -y jq python3 python3-pip

# Reboot
sudo reboot
```

### 2. Klonuj a konfiguruj

```bash
git clone https://github.com/Dantyk/smarthome.git
cd smarthome

# Konfiguruj environment
cd compose
cp .env.example .env
nano .env  # Nastav porty, API keys, zariadenia
```

### 3. Build a deploy

```bash
# Build UI
cd ../ui/smarthome-ui
npm ci
npm run build

# Build Docker images
cd ../../compose
docker compose build

# Spusť služby
docker compose up -d

# Overiť status
docker compose ps
```

### 4. Inicializuj monitorovanie

```bash
# Overiť Jaeger
curl http://localhost:16686

# Overiť Prometheus
curl http://localhost:9090

# Overiť Node-RED metrics
curl http://localhost:1880/metrics
```

---

## 🔄 Aktualizácia existujúcej inštalácie

### Postup upgradu

```bash
cd /home/pi/smarthome

# 1. Vytvor backup PRED upgrade
./scripts/backup.sh

# 2. Overiť backup
./scripts/verify-backup.sh backups/smarthome_backup_*.tar.gz

# 3. Pull nové zmeny
git pull origin main

# 4. Update Node-RED dependencies
cd flows/nodered
npm install

# 5. Update UI dependencies
cd ../../ui/smarthome-ui
npm install

# 6. Rebuild UI
npm run build

# 7. Rebuild Docker images
cd ../../compose
docker compose build

# 8. Graceful restart (preserve data)
docker compose down
docker compose up -d

# 9. Overiť logy
docker compose logs -f nodered
```

### Rollback v prípade problémov

```bash
# Zastaviť služby
cd compose
docker compose down

# Restore zo zálohy
cd ..
./scripts/restore.sh backups/smarthome_backup_YYYYMMDD_HHMMSS.tar.gz

# Služby sa automaticky spustia cez restore script
```

---

## 🔒 Security Hardening

### 1. Firewall konfigurácia

```bash
# Povoliť len potrebné porty
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Internal access only
sudo ufw allow from 192.168.0.0/24 to any port 1880  # Node-RED
sudo ufw allow from 192.168.0.0/24 to any port 3000  # UI
sudo ufw allow from 192.168.0.0/24 to any port 9090  # Prometheus
sudo ufw allow from 192.168.0.0/24 to any port 16686 # Jaeger

# SSH access
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### 2. MQTT Security

```bash
# Vytvoriť password file
cd compose/config/mosquitto
sudo mosquitto_passwd -c passwords admin
sudo mosquitto_passwd passwords nodered
sudo mosquitto_passwd passwords ui
```

Aktualizuj `mosquitto.conf`:
```conf
# Authentication
allow_anonymous false
password_file /mosquitto/config/passwords

# ACL
acl_file /mosquitto/config/acl.conf

# TLS (optional)
listener 8883
cafile /mosquitto/config/certs/ca.crt
certfile /mosquitto/config/certs/server.crt
keyfile /mosquitto/config/certs/server.key
```

Vytvoriť `acl.conf`:
```conf
# Admin full access
user admin
topic readwrite #

# Node-RED limited
user nodered
topic readwrite cmd/#
topic readwrite stat/#
topic readwrite virt/#
topic readwrite event/#

# UI read-only
user ui
topic read stat/#
topic read event/#
```

### 3. Docker Security

```bash
# Scan images before deploy
docker scan smarthome-ui:latest

# Use Trivy for comprehensive scanning
trivy image smarthome-ui:latest

# Enable Docker content trust
export DOCKER_CONTENT_TRUST=1
```

### 4. Credentials Management

Všetky citlivé údaje len cez environment variables:

```bash
# Nikdy necommituj .env súbory!
# Použiť secret management:

# Option 1: Docker secrets
echo "my_secret_password" | docker secret create mqtt_password -

# Option 2: GitHub Secrets (pre CI/CD)
# Settings → Secrets → Actions → New repository secret

# Option 3: External vault (HashiCorp Vault, AWS Secrets Manager)
```

---

## 📊 Monitoring Setup

### Prometheus Alerts

Vytvor `compose/config/prometheus/alerts.yml`:

```yaml
groups:
  - name: smarthome_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(mqtt_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High MQTT error rate"
          
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state > 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker is open"
          
      - alert: RateLimitExceeded
        expr: rate(rate_limit_rejected[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Rate limit frequently exceeded"
          
      - alert: DLQBacklog
        expr: dlq_messages > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Dead letter queue is growing"
```

Aktualizuj `prometheus.yml`:
```yaml
rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

### Grafana Dashboards

Import dashboards:
1. Jaeger Traces Overview
2. MQTT Message Flow
3. Rate Limiter Stats
4. System Health

```bash
# Import cez API
curl -X POST http://admin:admin@localhost:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d @grafana/dashboards/mqtt-overview.json
```

---

## 🧪 Testing & Validation

### Pre-Deployment Tests

```bash
# 1. Unit tests (ak sú implementované)
cd flows/nodered
npm test

# 2. Config validation
python3 scripts/check_modes_mtime.py

# 3. MQTT connectivity
mosquitto_sub -h localhost -t '#' -v -C 10

# 4. API health checks
curl http://localhost:3000/api/health
curl http://localhost:1880/metrics
```

### Post-Deployment Tests

```bash
# 1. Smoke test
./tests/smoke-test.sh

# 2. Load test (low intensity)
k6 run --vus 10 --duration 1m tests/load/api-stress.js

# 3. Overiť tracing
curl http://localhost:16686/api/traces?service=nodered

# 4. Overiť metrics
curl http://localhost:9090/api/v1/query?query=up
```

### Continuous Monitoring

```bash
# Watch logs real-time
docker compose logs -f --tail=100 nodered

# Monitor queue sizes
watch -n 5 'curl -s http://localhost:1880/metrics/json | jq .mqtt.queueSize'

# Monitor rate limiter
watch -n 5 'curl -s http://localhost:1880/metrics/json | jq .rateLimiter'

# Monitor circuit breaker
watch -n 5 'curl -s http://localhost:1880/metrics/json | jq .circuitBreaker'
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Node-RED nedostáva MQTT správy**
```bash
# Overiť MQTT broker
docker compose logs mosquitto | tail -20

# Test publish/subscribe
mosquitto_pub -h localhost -t test -m "hello"
mosquitto_sub -h localhost -t test -v
```

**2. UI neaktualizuje stav**
```bash
# Overiť WebSocket connection
# V prehliadači DevTools → Network → WS
# Malo by byť: ws://localhost:9001/

# Reštartovať UI
cd compose
docker compose restart ui
```

**3. Rate limiter blokuje správy**
```bash
# Zistiť aktuálne limity
curl http://localhost:1880/metrics/json | jq .rateLimiter

# Zvýšiť limity v init.js
global.rateLimiter = new RateLimiter({
  defaultCapacity: 200,  // bolo 100
  defaultRefillRate: 20  // bolo 10
});
```

**4. Jaeger neukazuje traces**
```bash
# Overiť Jaeger zdravie
curl http://localhost:14269

# Overiť či Node-RED posiela traces
docker compose logs nodered | grep -i trace

# Manuálne poslať test trace
curl -X POST http://localhost:14268/api/traces \
  -H 'Content-Type: application/json' \
  -d '{"data": [{"traceID": "abc123", "spans": []}]}'
```

**5. Backup zlyhá**
```bash
# Kontrola permissions
ls -la scripts/backup.sh

# Debug mode
bash -x scripts/backup.sh

# Manuálny backup kritických súborov
tar -czf manual-backup.tar.gz \
  config/modes.yaml \
  flows/nodered/flows.json \
  flows/nodered/flows_cred.json
```

---

## 📈 Performance Tuning

### Node-RED Optimization

V `settings.js`:
```javascript
module.exports = {
  // Logging
  logging: {
    console: {
      level: "info",  // Production: "warn"
      metrics: false,
      audit: false
    }
  },
  
  // Performance
  debugMaxLength: 1000,
  flowFilePretty: false,
  
  // Context storage (faster than filesystem)
  contextStorage: {
    default: "memory",
    file: {
      module: "localfilesystem",
      config: {
        flushInterval: 30  // Flush every 30s
      }
    }
  }
};
```

### Docker Resource Limits

V `docker-compose.yml`:
```yaml
services:
  nodered:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
  
  mosquitto:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

### MQTT Optimization

V `mosquitto.conf`:
```conf
# Performance
max_inflight_messages 100
max_queued_messages 10000
message_size_limit 10240

# Memory
persistence true
persistence_location /mosquitto/data/
autosave_interval 300

# Logging (reduce I/O)
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
```

---

## 📝 Checklist Pre Go-Live

### Infrastructure
- [ ] Firewall nakonfigurovaný
- [ ] MQTT authentication enabled
- [ ] TLS certifikáty nainštalované
- [ ] Backup job funguje (test restore)
- [ ] Monitoring dashboards vytvorené
- [ ] Alert rules nakonfigurované

### Security
- [ ] npm audit clean (0 critical/high)
- [ ] Trivy scan clean
- [ ] Passwords rotované
- [ ] .env súbory v .gitignore
- [ ] GitHub secrets nakonfigurované

### Testing
- [ ] Smoke tests prejdú
- [ ] Load tests prejdú (95% requests < 2s)
- [ ] Backup/restore overený
- [ ] Jaeger traces fungujú
- [ ] Prometheus metrics scrapujú

### Documentation
- [ ] README aktualizovaný
- [ ] Deployment guide vytvorený
- [ ] Runbook pre common issues
- [ ] Incident response plan

### Monitoring
- [ ] Jaeger UI accessible
- [ ] Prometheus UI accessible
- [ ] Grafana dashboards importované
- [ ] Log aggregation funguje

---

## 🎯 Next Steps

Post-launch monitoring plan:

**First 24 hours:**
- Každú hodinu kontrolovať Jaeger pre errors
- Sledovať Prometheus metrics pre anomálie
- Overiť že backups bežia

**First week:**
- Daily log review
- Performance baseline establishment
- Tune rate limiter thresholds

**First month:**
- Weekly security audits
- Monthly load testing
- Capacity planning review

---

**Poznámky:**
- Keep this guide updated with production learnings
- Document all incidents in `docs/incidents/`
- Share knowledge with team
