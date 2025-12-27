# Node-RED API Dokumentácia

## 📍 Umiestnenie a Spustenie

**Umiestnenie API:**
- Flows súbor: `/home/pi/smarthome/flows/nodered/flows.json`
- HTTP endpoint nodes definované priamo v Node-RED flows

**Spustenie:**
- Automaticky pri štarte Node-RED kontajnera
- Docker compose: `docker compose up -d nodered`
- Port: **1880** (http://localhost:1880)
- Healthcheck: `http://localhost:1880`

**Container info:**
```yaml
Service: nodered
Image: nodered/node-red:latest
Port: 1880:1880
Volumes:
  - flows/nodered:/data
  - config/nodered/settings.js:/data/settings.js
Status: Up 2 days (healthy)
```

---

## 🔌 API Endpoints

### GET /api/status
**Celkový stav systému**
```bash
curl http://localhost:1880/api/status | jq
```

Vracia:
- Rooms (teploty, target, heating, boost)
- Mode (current, overrides)
- Calendar (events)
- Alerts (total, unacknowledged)
- Services (nodered, mosquitto, baikal)

---

### GET /api/mode
**Aktuálny režim vykurovania**
```bash
curl http://localhost:1880/api/mode | jq
```

---

### GET /api/mode/current
**Detail aktuálneho módu**
```bash
curl http://localhost:1880/api/mode/current | jq
```

---

### POST /api/mode
**Zmena režimu**
```bash
curl -X POST http://localhost:1880/api/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "home"}'
```

---

### POST /api/override
**Dočasné prepísanie režimu**
```bash
curl -X POST http://localhost:1880/api/override \
  -H "Content-Type: application/json" \
  -d '{
    "room": "spalna",
    "target_temp": 22,
    "duration_minutes": 120
  }'
```

---

### GET /api/rooms/temps
**Aktuálne teploty všetkých miestností**
```bash
curl http://localhost:1880/api/rooms/temps | jq
```

---

### GET /api/rooms/capabilities
**Dostupné miestnosti a ich schopnosti**
```bash
curl http://localhost:1880/api/rooms/capabilities | jq
```

---

### GET /api/calendar/events
**Kalendárové udalosti (Baikal CalDAV)**
```bash
curl http://localhost:1880/api/calendar/events | jq
```

---

### GET /api/events/upcoming
**Nadchádzajúce udalosti**
```bash
curl http://localhost:1880/api/events/upcoming | jq
```

---

### GET /api/weather/current
**Aktuálne počasie (OpenWeatherMap)**
```bash
curl http://localhost:1880/api/weather/current | jq
```

---

### GET /api/weather/forecast
**Predpoveď počasia**
```bash
curl http://localhost:1880/api/weather/forecast | jq
```

---

### POST /api/alerts/ack
**Potvrdenie alertu**
```bash
curl -X POST http://localhost:1880/api/alerts/ack \
  -H "Content-Type: application/json" \
  -d '{"alert_id": "123"}'
```

---

## 🔧 Konfigurácia

**Settings.js:**
- Lokácia: `compose/config/nodered/settings.js`
- HTTP server port: 1880
- Context storage: Redis
- User dir: /data

**Environment variables:**
```bash
BAIKAL_BASE_URL=http://baikal:80/dav.php
GOOGLE_CALENDAR_API_KEY=...
OPENWEATHER_API_KEY=...
PUSHOVER_USER=...
PUSHOVER_TOKEN=...
MQTT_USER=nodered
REDIS_HOST=redis
```

---

## 🛠️ Development

**Node-RED Editor:**
- URL: http://localhost:1880
- Dashboard: http://localhost:1880/ui
- Flows editor pre úpravu API endpoints

**Pridanie nového API endpointu:**
1. Otvor Node-RED editor (http://localhost:1880)
2. Pridaj "http in" node (nastavíš metódu a URL)
3. Pridaj "function" node (spracovanie logiky)
4. Pridaj "http response" node (odpoveď)
5. Deploy

**Reštart Node-RED:**
```bash
cd compose
docker compose restart nodered
docker compose logs -f nodered
```

---

## 📊 Monitoring

**Logs:**
```bash
docker compose logs -f nodered
```

**Healthcheck:**
```bash
curl -I http://localhost:1880
```

**API test:**
```bash
curl http://localhost:1880/api/status
```

---

## 🔒 Security

- HTTP API beží len v LAN (port 1880 blocked z internetu)
- MQTT použije ACL autentifikáciu (user: nodered)
- Žiadna autentifikácia na HTTP endpoints (LAN-only)
- Pre external access: zvážiť Basic Auth alebo reverse proxy (nginx)
