# SmartHome Production Deployment - Step by Step

**Verzia**: 2.0.0  
**Dátum**: 2025-01-27  
**Čas**: ~30 minút

---

## 📋 Pre-Deployment Checklist

- [ ] Server pripravený (Raspberry Pi alebo Linux VM)
- [ ] Docker + Docker Compose nainštalovaný
- [ ] Git nainštalovaný
- [ ] OpenWeather API key (https://openweathermap.org/api)
- [ ] Discord webhook URL (optional, pre alerty)
- [ ] SMTP credentials (optional, pre email alerty)

---

## 🚀 Deployment Kroky

### Krok 1: Clone Repository (2 min)

```bash
cd ~
git clone https://github.com/Dantyk/smarthome.git
cd smarthome
```

**Overpreheld**:
```bash
ls -la  # Vidíš compose/, flows/, ui/, scripts/, docs/
```

---

### Krok 2: Security Setup (5 min)

#### 2a. MQTT Authentication

```bash
# Spusti setup script
./scripts/setup-mqtt-acl.sh

# Zadaj heslá pre:
# - admin (full access)
# - nodered (automation)
# - ui (web interface)
# - monitor (dashboards)
```

**Výstup**:
- ✅ `/home/pi/smarthome/compose/config/mosquitto/passwords` vytvorený
- ✅ Permissions 600

#### 2b. UI Authentication

```bash
# Spusti setup script
./scripts/setup-ui-auth.sh

# Zadaj:
# - Username (default: admin)
# - Password (silné heslo!)
```

**Výstup**:
- ✅ `ui/smarthome-ui/.env.local` vytvorený
- ✅ Session secret vygenerovaný

---

### Krok 3: Configure Environment (3 min)

```bash
cd compose

# Vytvor .env file
cat > .env << 'ENVFILE'
# MQTT Authentication
MQTT_USER=nodered
MQTT_PASSWORD=<heslo_z_setup-mqtt-acl>

# OpenWeather API
OPENWEATHER_API_KEY=<your_api_key>

# Alertmanager (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Timezone
TZ=Europe/Bratislava
ENVFILE

# Edit s tvojimi credentials
nano .env
```

**Overpreheld**:
```bash
cat .env | grep -v '^#' | grep -v '^$'  # Vidíš všetky nastavené premenné
```

---

### Krok 4: Build UI (5 min)

```bash
cd ../ui/smarthome-ui

# Install dependencies
npm ci

# Build production
npm run build

# Check build output
ls -la .next/  # Vidíš standalone/, static/, server/
```

**Overpreheld**:
```bash
du -sh .next/  # Build size ~50-100MB
```

---

### Krok 5: Start Services (5 min)

```bash
cd ../../compose

# Build UI container
docker compose build ui

# Start all services
docker compose up -d

# Wait for health checks
sleep 30

# Check status
docker compose ps
```

**Očakávaný výstup**:
```
NAME                 STATUS
mosquitto            Up (healthy)
nodered              Up (healthy)
redis                Up (healthy)
prometheus           Up (healthy)
alertmanager         Up (healthy)
jaeger               Up (healthy)
ui                   Up (healthy)
baikal               Up
```

**Overpreheld Health**:
```bash
./check-services.sh
```

---

### Krok 6: Verify Deployment (5 min)

#### 6a. MQTT Connection

```bash
# Test MQTT (should require password)
docker exec -it smarthome-mosquitto-1 mosquitto_sub -u nodered -P <password> -t 'stat/#' -v

# Should connect successfully
# Ctrl+C to exit
```

#### 6b. UI Access

```bash
# Test UI (should show Basic Auth dialog)
curl -I http://localhost:8088

# Expected:
# HTTP/1.1 401 Unauthorized
# WWW-Authenticate: Basic realm="SmartHome UI"

# Login
curl -u admin:<password> http://localhost:8088

# Expected: HTTP/1.1 200 OK
```

**Browser Test**:
1. Otvoriť http://localhost:8088 (alebo http://<server_ip>:8088)
2. Zadať username + password (z setup-ui-auth.sh)
3. Vidieť dashboard s room cards

#### 6c. Services

| Service | URL | Expected |
|---------|-----|----------|
| UI | http://localhost:8088 | Dashboard (po logine) |
| Node-RED | http://localhost:1880 | Flow editor |
| Prometheus | http://localhost:9090 | Metrics UI |
| Alertmanager | http://localhost:9093 | Alert UI |
| Jaeger | http://localhost:16686 | Tracing UI |
| Grafana | http://localhost:3001 | Dashboards (admin/admin) |

---

### Krok 7: Run Integration Tests (5 min)

```bash
cd ../tests/integration

# Install test dependencies
npm install

# Run all tests
npm run test:all

# Expected:
# ✓ 14 Playwright E2E tests
# ✓ 14 MQTT integration tests
# ✓ 9 API contract tests
# Total: 34 tests passed
```

**Ak niektoré testy zlyhajú**:
```bash
# Check logs
docker compose logs nodered | tail -100
docker compose logs mosquitto | tail -100

# Restart services
docker compose restart nodered mosquitto

# Re-run tests
npm run test:all
```

---

### Krok 8: Configure Alerts (5 min - optional)

#### 8a. Discord Webhook

```bash
# 1. Vytvor Discord webhook
# Discord Server → Settings → Integrations → Webhooks → New Webhook

# 2. Copy webhook URL
# https://discord.com/api/webhooks/123456789/abcdefg...

# 3. Update .env
cd ../../compose
nano .env
# Pridaj: DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# 4. Restart alertmanager
docker compose restart alertmanager

# 5. Test
curl -X POST "${DISCORD_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"content": "✅ SmartHome alerting configured!"}'
```

#### 8b. Email (optional)

```bash
# Edit alertmanager config
nano config/alertmanager/alertmanager.yml

# Uncomment email_configs section
# Set:
# - smarthost: smtp.gmail.com:587
# - auth_username: your-email@gmail.com
# - auth_password: your-app-password

# Restart
docker compose restart alertmanager
```

---

### Krok 9: Network Hardening (5 min - optional)

```bash
# Spusti firewall setup
sudo ../scripts/harden-network.sh

# Potvrď:
# - Reset existing rules? (y/n)
# - Add trusted IP? (y/n - optional)

# Overpreheld
sudo ufw status verbose

# Expected:
# Status: active
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 1880/tcp                   ALLOW       192.168.1.0/24
# 1883/tcp                   ALLOW       192.168.1.0/24
# ... (všetky services LAN-only)
```

**Test z LAN zariadenia**:
```bash
# Z iného počítača v sieti
curl http://<server_ip>:8088

# Should work (po logine)
```

---

## ✅ Post-Deployment Verification

### Performance Baseline

```bash
# Run performance profiler
sudo ./scripts/profile-performance.sh

# Check report
cat /tmp/smarthome-profile-*/performance-report.md

# Expected metrics:
# - MQTT throughput: 10-100 msg/s
# - API P95 latency: <200ms
# - CPU usage: <30%
# - Memory: <1GB
```

### Alert Test

```bash
# Force alert (increase DLQ)
# ... (simulate error condition in Node-RED)

# Check Prometheus
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | {alert: .labels.alertname, state: .state}'

# Check Discord
# Verify message received in Discord channel
```

### Backup Test

```bash
# Run backup manually
cd ../scripts
./backup-configs.sh

# Check backup
ls -lh backups/latest/

# Expected:
# - flows.json
# - modes.yaml
# - mosquitto.conf
# - docker-compose.yml
```

---

## 🔧 Troubleshooting

### Services Not Starting

```bash
# Check logs
docker compose logs <service> | tail -100

# Common issues:
# - Port conflicts (change ports in docker-compose.yml)
# - Missing environment variables (check .env)
# - Volume permissions (sudo chown -R 1000:1000 volumes/)
```

### MQTT Connection Refused

```bash
# Check password file exists
ls -la config/mosquitto/passwords

# Check mosquitto.conf
cat config/mosquitto/mosquitto.conf | grep -E 'password_file|acl_file|allow_anonymous'

# Should show:
# allow_anonymous false
# password_file /mosquitto/config/passwords
# acl_file /mosquitto/config/acl.conf

# Restart
docker compose restart mosquitto
```

### UI Login Not Working

```bash
# Check .env.local exists
ls -la ../ui/smarthome-ui/.env.local

# Rebuild UI
cd ../ui/smarthome-ui
npm run build
cd ../../compose
docker compose build ui
docker compose up -d ui
```

### Tests Failing

```bash
# Check services running
docker compose ps

# All should be "Up (healthy)"

# Restart services
docker compose restart nodered mosquitto redis

# Wait 30s
sleep 30

# Re-run tests
cd ../tests/integration
npm run test:all
```

---

## 📊 Success Criteria

- [x] Všetky services v stave "Up (healthy)"
- [x] MQTT vyžaduje password (allow_anonymous=false)
- [x] UI vyžaduje login (Basic Auth dialog)
- [x] 34/34 integration testov passed
- [x] Prometheus metriky dostupné (http://localhost:9090)
- [x] Alerty nakonfigurované (Discord/Email)
- [x] Performance baseline established (profiler report)
- [x] Backupy funkčné (manual backup test)

---

## 🎉 Next Steps

1. **Configure automation**:
   - Node-RED: Import flows z `flows/nodered/flows.json`
   - Baikal: Add calendar events
   - Zigbee/Z-Wave: Pair devices

2. **Setup monitoring**:
   - Grafana: Import dashboards
   - Prometheus: Review alert rules
   - Alertmanager: Test notification channels

3. **Production hardening**:
   - Enable automated backups (GitHub Actions)
   - Setup remote access (VPN or Cloudflare Tunnel)
   - Schedule regular security audits

4. **Documentation**:
   - Read [SECURITY.md](docs/SECURITY.md) - Security best practices
   - Read [TESTING.md](docs/TESTING.md) - Testing guide
   - Read [ALERTS.md](docs/ALERTS.md) - Alert response procedures

---

**Gratulujeme! SmartHome systém je production-ready! 🚀**

Pre podporu: https://github.com/Dantyk/smarthome/issues
