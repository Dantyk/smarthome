# Deployment Runbook

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Docker a Docker Compose nainštalované
- [ ] Git repository naklonovaný
- [ ] `.env` súbor vytvorený z `.env.example`
- [ ] USB zariadenia pripojené (Z-Wave stick, Zigbee coordinator)
- [ ] Network connectivity overený

### 2. Configuration Review
- [ ] `config/modes.yaml` skontrolovaný
- [ ] `compose/.env` obsahuje platné API keys
- [ ] Device paths v `docker-compose.yml` správne (`/dev/ttyACM0`, `/dev/ttyUSB0`)
- [ ] Porty nie sú konfliktné s inými službami

### 3. Pre-Deploy Tests
```bash
# Validate Docker Compose syntax
cd compose
docker compose config

# Validate YAML configs
yamllint ../config/

# Check JSON schemas
ajv validate -s ../config/mqtt-schemas.json
```

## Deployment Steps

### Initial Deploy (Clean Install)

```bash
# 1. Build UI image
cd ui/smarthome-ui
npm ci
npm run build

# 2. Build Docker image
cd ../../compose
docker compose build ui

# 3. Start core services
docker compose up -d mosquitto nodered baikal ui

# 4. Wait for services to be healthy
docker compose ps

# Expected output:
# mosquitto    running (healthy)
# nodered      running (healthy)
# baikal       running (healthy)
# ui           running (healthy)

# 5. Initialize Baïkal (if first time)
# Visit http://localhost:8800/admin/
# Default credentials: admin / admin

# 6. Verify MQTT connectivity
docker compose logs mosquitto | grep "New connection"

# 7. Check Node-RED flows loaded
docker compose logs nodered | grep "Started flows"

# 8. Access UI
curl -f http://localhost:8088/api/health
# Expected: {"status":"ok"}
```

### Optional Services

```bash
# Z-Wave thermostats
docker compose --profile zwave up -d

# Zigbee sensors
docker compose --profile zigbee up -d

# Metrics stack
docker compose --profile metrics up -d

# Notifications
docker compose --profile notify up -d
```

### Update Deploy (Rolling Update)

```bash
# 1. Pull latest code
git pull origin master

# 2. Update UI dependencies
cd ui/smarthome-ui
npm ci
npm run build

# 3. Rebuild only UI
cd ../../compose
docker compose build ui

# 4. Rolling restart UI (zero downtime)
docker compose up -d --no-deps ui

# 5. Verify health
docker compose ps ui
curl -f http://localhost:8088/api/health
```

### Rollback Procedure

```bash
# 1. Revert code
git checkout HEAD~1

# 2. Rebuild UI
cd ui/smarthome-ui
npm ci
npm run build

# 3. Redeploy
cd ../../compose
docker compose build ui
docker compose up -d --no-deps ui

# 4. Verify
docker compose logs --tail=50 ui
```

## Post-Deployment Verification

### Health Checks

```bash
# All services healthy
docker compose ps | grep "healthy"

# MQTT broker responsive
mosquitto_sub -h localhost -t '$SYS/#' -C 5

# Node-RED UI accessible
curl -f http://localhost:1880

# Next.js UI accessible
curl -f http://localhost:8088

# API endpoints working
curl -f http://localhost:8088/api/modes
curl -f http://localhost:8088/api/rooms
```

### MQTT Message Flow Test

```bash
# Subscribe to room temperatures
mosquitto_sub -h localhost -t 'stat/hvac/+/current_temp' -v &

# Publish test command
mosquitto_pub -h localhost -t 'cmd/room/spalna/set_target' \
  -m '{"value":22,"source":"test","timestamp":"2025-12-25T10:00:00Z"}'

# Verify message received in Node-RED
docker compose logs --tail=20 nodered | grep "set_target"
```

### UI Functionality Test

1. Open browser: `http://<raspberry-pi-ip>:8088`
2. Verify room cards displayed
3. Change temperature slider
4. Toggle HVAC on/off
5. Start boost mode
6. Check weather widget

### Monitoring Setup

```bash
# Follow logs in real-time
docker compose logs -f nodered mosquitto

# Watch MQTT messages
mosquitto_sub -h localhost -t '#' -v | tee mqtt-traffic.log

# Monitor container resources
docker stats
```

## Common Issues

### Issue: UI Cannot Connect to MQTT

**Symptoms**: UI shows "Connecting..." forever

**Diagnosis**:
```bash
# Check Mosquitto websocket listener
docker compose logs mosquitto | grep "websockets"

# Verify port 9001 exposed
docker compose ps mosquitto | grep 9001
```

**Solution**:
```bash
# Restart Mosquitto
docker compose restart mosquitto

# Or check mosquitto.conf has websocket listener
cat compose/config/mosquitto/mosquitto.conf | grep "protocol websockets"
```

### Issue: Node-RED Flows Not Loading

**Symptoms**: Empty flows in Node-RED UI

**Diagnosis**:
```bash
# Check flows.json mounted
docker compose exec nodered ls -la /data/flows.json

# Check for JSON syntax errors
docker compose logs nodered | grep -i "error\|failed"
```

**Solution**:
```bash
# Restore from backup
cp flows/nodered/flows.json.bak flows/nodered/flows.json
docker compose restart nodered
```

### Issue: Healthcheck Failing

**Symptoms**: Container shows "unhealthy" status

**Diagnosis**:
```bash
# Inspect healthcheck logs
docker inspect <container-name> | jq '.[].State.Health'

# Manual healthcheck test
docker compose exec nodered wget --spider http://localhost:1880
```

**Solution**:
```bash
# Increase healthcheck interval
# Edit docker-compose.yml:
#   healthcheck:
#     interval: 60s  # was 30s
#     start_period: 60s  # was 30s

docker compose up -d
```

## Backup & Restore

### Backup

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/smarthome-backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR/$DATE

# Backup Node-RED flows
cp -r flows/nodered $BACKUP_DIR/$DATE/

# Backup config
cp -r config $BACKUP_DIR/$DATE/

# Backup Docker volumes
docker run --rm \
  -v mosquitto_data:/data \
  -v $BACKUP_DIR/$DATE:/backup \
  alpine tar czf /backup/mosquitto_data.tar.gz -C /data .

# Backup Baïkal data
docker run --rm \
  -v baikal_data:/data \
  -v $BACKUP_DIR/$DATE:/backup \
  alpine tar czf /backup/baikal_data.tar.gz -C /data .

echo "Backup completed: $BACKUP_DIR/$DATE"
```

### Restore

```bash
#!/bin/bash
BACKUP_DIR="/home/pi/smarthome-backups/20251225-100000"

# Stop services
cd compose
docker compose down

# Restore flows
cp -r $BACKUP_DIR/nodered/* ../flows/nodered/

# Restore config
cp -r $BACKUP_DIR/config/* ../config/

# Restore Docker volumes
docker run --rm \
  -v mosquitto_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar xzf /backup/mosquitto_data.tar.gz -C /data

docker run --rm \
  -v baikal_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar xzf /backup/baikal_data.tar.gz -C /data

# Start services
docker compose up -d

echo "Restore completed from: $BACKUP_DIR"
```

## Emergency Procedures

### Complete System Failure

```bash
# Nuclear option: Remove all containers and volumes
cd compose
docker compose down -v

# Restore from last known good backup
./restore.sh /home/pi/smarthome-backups/latest

# Start from scratch
docker compose up -d

# Re-initialize Baïkal
# Visit http://localhost:8800/admin/
```

### MQTT Broker Corruption

```bash
# Stop all services
docker compose down

# Remove corrupted MQTT persistence
docker volume rm mosquitto_data

# Recreate volume
docker volume create mosquitto_data

# Restart - will lose retained messages!
docker compose up -d mosquitto

# Re-publish essential retained messages from Node-RED
# (Node-RED "Init: Default Values" flow should run automatically)
```

## Monitoring & Alerts

### Setup Grafana Dashboards

```bash
# Start metrics stack
docker compose --profile metrics up -d

# Access Grafana
open http://localhost:3000
# Login: admin / admin123

# Import pre-built dashboards
# - MQTT Message Rate
# - Room Temperatures
# - HVAC On/Off States
# - Service Health Status
```

### Setup Alerts

```bash
# Configure Pushover for critical alerts
# Edit compose/.env:
# PUSHOVER_USER=your_user_key
# PUSHOVER_TOKEN=your_app_token

# Start notification service
docker compose --profile notify up -d apprise

# Test notification
curl -X POST http://localhost:8000/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Alert","body":"System online"}'
```

## Performance Tuning

### Mosquitto Optimization

```conf
# compose/config/mosquitto/mosquitto.conf
max_connections 100
max_queued_messages 1000
message_size_limit 1048576  # 1MB
max_inflight_messages 20
```

### Node-RED Optimization

```javascript
// flows/nodered/settings.js
module.exports = {
  flowFilePretty: false,  // Compact JSON
  editorTheme: {
    projects: { enabled: false }  # Disable projects feature
  }
}
```

## Support Contacts

- **GitHub Issues**: https://github.com/Dantyk/smarthome/issues
- **Documentation**: `/home/pi/smarthome/docs/`
- **Logs**: `/var/log/smarthome/` (if configured)
