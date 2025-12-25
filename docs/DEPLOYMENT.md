# Production Deployment Guide

**Čas nasadenia**: ~30 minút  
**Náročnosť**: Stredná  
**Požiadavky**: Docker, Git, základné Linux skills

---

## 📋 Pre-Deployment Checklist

- [ ] Server pripravený (Raspberry Pi 4+ alebo Linux VM)
- [ ] Docker + Docker Compose nainštalovaný
- [ ] Git nainštalovaný
- [ ] OpenWeather API key ([získať tu](https://openweathermap.org/api))
- [ ] Discord webhook URL (voliteľné, pre alerty)
- [ ] SMTP credentials (voliteľné, pre email alerty)

---

## 🚀 Prvé nasadenie (Quick Start)

### 1. Príprava systému

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install monitoring tools
sudo apt install -y jq python3 python3-pip curl

# Reboot
sudo reboot
```

### 2. Clone a konfigurácia

```bash
cd ~
git clone https://github.com/Dantyk/smarthome.git
cd smarthome

# Configure environment
cd compose
cp .env.example .env
nano .env  # Nastav OPENWEATHER_API_KEY a ostatné credentials
```

### 3. Security Setup

```bash
# MQTT authentication
./scripts/setup-mqtt-acl.sh
# Zadaj heslá pre: admin, nodered, ui, monitor

# UI authentication
./scripts/setup-ui-auth.sh
# Zadaj username + silné heslo
```

### 4. Build & Deploy

```bash
# Build UI
cd ../ui/smarthome-ui
npm ci
npm run build

# Start services
cd ../../compose
docker compose build ui
docker compose up -d

# Verify health
sleep 30
./check-services.sh
```

### 5. Overenie

```bash
# Test MQTT (vyžaduje heslo)
docker exec -it smarthome-mosquitto-1 mosquitto_sub -u nodered -P <password> -t 'stat/#' -v

# Test UI (otvor prehliadač)
# http://localhost:8088 (alebo http://<server_ip>:8088)
# Login: admin / <heslo_z_setup-ui-auth>

# Run integration tests
cd ../tests/integration
npm install
npm run test:all  # Should pass 34/34 tests
```

---

## 🔄 Aktualizácia existujúcej inštalácie

### Postup upgradu

```bash
cd ~/smarthome

# 1. Vytvor backup
./scripts/backup.sh

# 2. Overiť backup
./scripts/verify-backup.sh backups/smarthome_backup_*.tar.gz

# 3. Pull nové zmeny
git pull origin master

# 4. Update dependencies
cd flows/nodered && npm install
cd ../../ui/smarthome-ui && npm install

# 5. Rebuild UI
npm run build

# 6. Rebuild Docker images
cd ../../compose
docker compose build

# 7. Graceful restart
docker compose down
docker compose up -d

# 8. Overiť logy
docker compose logs -f nodered
```

### Rollback v prípade problémov

```bash
# Zastaviť služby
cd compose && docker compose down

# Restore zo zálohy
cd .. && ./scripts/restore.sh backups/smarthome_backup_YYYYMMDD_HHMMSS.tar.gz
```

---

## 🔒 Security Hardening

### 1. Firewall konfigurácia

```bash
# Povoliť len potrebné porty (LAN only)
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow from 192.168.0.0/24 to any port 1880  # Node-RED
sudo ufw allow from 192.168.0.0/24 to any port 8088  # UI
sudo ufw allow from 192.168.0.0/24 to any port 9090  # Prometheus
sudo ufw allow from 192.168.0.0/24 to any port 16686 # Jaeger

sudo ufw allow 22/tcp  # SSH
sudo ufw enable
```

### 2. MQTT Security

MQTT ACL už nakonfigurované cez `setup-mqtt-acl.sh`. Overiť:

```bash
cat compose/config/mosquitto/acl.conf

# Očakávaný obsah:
# user admin      → topic readwrite #
# user nodered    → topic readwrite cmd/#, stat/#, virt/#
# user ui         → topic read stat/#, event/#
# user monitor    → topic read #
```

### 3. Docker Security Scanning

```bash
# Scan images pred deployom
docker scan smarthome-ui:latest

# Alebo použiť Trivy
trivy image smarthome-ui:latest --severity HIGH,CRITICAL
```

### 4. Credentials Management

**Nikdy necommituj `.env` súbory!**

```bash
# Všetky secrets len cez environment variables
# Option 1: Docker secrets
echo "my_password" | docker secret create mqtt_password -

# Option 2: GitHub Secrets (pre CI/CD)
# Settings → Secrets → Actions → New repository secret
```

---

## 📊 Monitoring Setup

### Prometheus Alerts

Alerts sú už nakonfigurované v `compose/config/prometheus/alerts.yml`.

Overiť:
```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {alert: .name, severity: .labels.severity}'

# Expected: 17 alert rules (5 critical, 7 warning, 5 info)
```

### Alertmanager - Discord/Email

```bash
# Discord webhook
nano compose/.env
# Pridaj: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Restart alertmanager
docker compose restart alertmanager

# Test alert
curl -X POST "http://localhost:9093/api/v1/alerts" \
  -H "Content-Type: application/json" \
  -d '[{"labels":{"alertname":"TestAlert","severity":"warning"},"annotations":{"summary":"Test notification"}}]'
```

### Grafana Dashboards

```bash
# Otvoriť Grafana
# http://localhost:3001 (login: admin/admin)

# Import dashboards:
# 1. MQTT Message Flow
# 2. System Health Overview
# 3. Rate Limiter Stats
# 4. Jaeger Traces Overview

# Dashboards sú v: compose/config/grafana/dashboards/
```

---

## 🧪 Testing & Validation

### Pre-Deployment Tests

```bash
# 1. Config validation
python3 scripts/check_modes_mtime.py

# 2. MQTT connectivity
mosquitto_sub -h localhost -t '#' -v -C 10

# 3. API health checks
curl http://localhost:8088/api/health
curl http://localhost:1880/metrics
```

### Post-Deployment Tests

```bash
# 1. Integration tests
cd tests/integration
npm run test:all  # 34 tests (Playwright E2E, MQTT, API)

# 2. Load test (low intensity)
cd ../load
k6 run --vus 10 --duration 1m api-stress.js

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

# Monitor circuit breaker
watch -n 5 'curl -s http://localhost:1880/metrics/json | jq .circuitBreaker'
```

---

## 🔧 Troubleshooting

### Services Not Starting

```bash
# Check logs
docker compose logs <service> | tail -100

# Common issues:
# - Port conflicts → zmeniť porty v docker-compose.yml
# - Missing .env variables → overiť .env file
# - Volume permissions → sudo chown -R 1000:1000 volumes/
```

### MQTT Connection Refused

```bash
# Check password file
ls -la compose/config/mosquitto/passwords

# Check mosquitto.conf
cat compose/config/mosquitto/mosquitto.conf | grep -E 'password_file|allow_anonymous'

# Should show:
# allow_anonymous false
# password_file /mosquitto/config/passwords

# Restart
docker compose restart mosquitto
```

### UI Login Not Working

```bash
# Check .env.local exists
ls -la ui/smarthome-ui/.env.local

# Rebuild UI
cd ui/smarthome-ui && npm run build
cd ../../compose
docker compose build ui
docker compose up -d ui
```

### Node-RED nedostáva MQTT správy

```bash
# Test publish/subscribe
mosquitto_pub -h localhost -u nodered -P <password> -t test -m "hello"
mosquitto_sub -h localhost -u nodered -P <password> -t test -v

# Check Node-RED logs
docker compose logs nodered | grep -i mqtt
```

### Rate limiter blokuje správy

```bash
# Zistiť aktuálne limity
curl http://localhost:1880/metrics/json | jq .rateLimiter

# Zvýšiť limity v flows/nodered/lib/init.js:
# global.rateLimiter = new RateLimiter({
#   defaultCapacity: 200,  // bolo 100
#   defaultRefillRate: 20  // bolo 10
# });

# Restart
docker compose restart nodered
```

---

## 📈 Performance Tuning

### Node-RED Optimization

```javascript
// compose/config/nodered/settings.js
module.exports = {
  logging: {
    console: {
      level: "warn",  // Production: "warn" (nie "info")
      metrics: false,
      audit: false
    }
  },
  debugMaxLength: 1000,
  flowFilePretty: false
};
```

### Docker Resource Limits

```yaml
# docker-compose.yml
services:
  nodered:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          memory: 512M
```

### MQTT Optimization

```conf
# compose/config/mosquitto/mosquitto.conf
max_inflight_messages 100
max_queued_messages 10000
message_size_limit 10240

persistence true
autosave_interval 300
```

---

## 📝 Production Readiness Checklist

### Infrastructure ✓
- [ ] Všetky services v stave "Up (healthy)"
- [ ] Firewall nakonfigurovaný (UFW enabled)
- [ ] MQTT authentication enabled (allow_anonymous=false)
- [ ] UI authentication enabled (Basic Auth)
- [ ] TLS certifikáty nainštalované (voliteľné)
- [ ] Backup job funguje (test restore)

### Monitoring ✓
- [ ] Prometheus scraping metrics
- [ ] Alertmanager routes nakonfigurované
- [ ] Discord/Email notifications fungujú
- [ ] Grafana dashboards vytvorené
- [ ] Jaeger traces fungujú

### Security ✓
- [ ] npm audit clean (0 critical/high)
- [ ] Trivy scan clean
- [ ] Passwords rotované
- [ ] .env súbory v .gitignore
- [ ] GitHub secrets nakonfigurované (pre CI/CD)

### Testing ✓
- [ ] 34/34 integration testov passed
- [ ] Load tests prejdú (95% requests < 2s)
- [ ] Backup/restore overený
- [ ] Performance baseline established

### Documentation ✓
- [ ] README aktualizovaný
- [ ] Deployment guide prečítaný
- [ ] Runbooks pre common issues
- [ ] Incident response plan

---

## 🎯 Post-Launch Monitoring

**Prvých 24 hodín:**
- Každú hodinu kontrolovať Jaeger pre errors
- Sledovať Prometheus metrics pre anomálie
- Overiť že backups bežia

**Prvý týždeň:**
- Denný log review
- Performance baseline establishment
- Tune rate limiter thresholds

**Prvý mesiac:**
- Týždenné security audity
- Mesačné load testing
- Capacity planning review

---

## 📚 Ďalšie kroky

1. **Konfigurácia automatizácie**:
   - Node-RED: Import flows z `flows/nodered/flows.json`
   - Baïkal: Pridať kalendárové udalosti
   - Zigbee/Z-Wave: Spárovať zariadenia

2. **Monitoring**:
   - Grafana: Importovať dashboards
   - Prometheus: Skontrolovať alert rules
   - Alertmanager: Testovať notifikačné kanály

3. **Production hardening**:
   - Nastaviť automatické backupy (GitHub Actions)
   - Setup remote access (VPN alebo Cloudflare Tunnel)
   - Plánovať pravidelné security audity

4. **Dokumentácia**:
   - Prečítať [SECURITY.md](SECURITY.md) - Security best practices
   - Prečítať [TESTING.md](TESTING.md) - Testing guide
   - Prečítať [ALERTS.md](ALERTS.md) - Alert response procedures

---

**Pre podporu**: https://github.com/Dantyk/smarthome/issues

**Poznámka**: Dokumentáciu priebežne aktualizuj podľa production learnings a dokumentuj všetky incidenty v `docs/incidents/`.
