# Zostávajúce Úlohy - Prioritizované

**Dátum:** 27. December 2025  
**Status:** 10/13 úloh dokončených (77%)

---

## 🔴 PRIORITA VYSOKÁ (3 úlohy)

### 1. CMD topics - Overiť TRV ventily

**Problém:**  
Node-RED publikuje 20+ MQTT topics na `cmd/hvac/*/setpoint`, `cmd/hvac/*/override` ale žiadny Node-RED flow ich nepočúva.

**Možné príčiny:**
- ✅ **Zigbee2MQTT/TRV ventily počúvajú** - topics sú OK, len chýba dokumentácia
- ⚠️ **Legacy/nepoužívané** - staré topics bez hardvéru
- ❌ **Bug** - topics by mali mať subscriber

**Varianty riešenia:**

#### Variant A: Overiť hardvér (ODPORÚČANÝ)
```bash
# 1. Monitor MQTT trafficu
mosquitto_sub -v -t 'cmd/hvac/#'

# 2. Zmeniť teplotu cez UI/API a pozri či sa publikuje
curl -X POST http://localhost:1880/api/boost \
  -H 'Content-Type: application/json' \
  -d '{"room": "spalna", "temp": 22, "minutes": 60}'

# 3. Skontroluj Zigbee2MQTT logy
docker compose logs zigbee2mqtt | grep -i "setpoint\|override\|hvac"

# 4. Pozri Zigbee2MQTT zariadenia
curl -s http://localhost:8080/api/devices | jq '.[] | select(.type=="climate")'
```

**Ak zariadenia reagujú:**
- ✅ Všetko OK, len pridaj do dokumentácie poznámku
- **Akcia:** Update `MQTT_TOPICS_AUDIT.md` - poznámka že topics sú pre TRV bridge

**Ak nereagujú (nemáš TRV):**
- Prejdi na Variant B

**Čas:** 10 minút  
**Priorita:** VYSOKÁ - môže ovplyvniť funkčnosť vykurovania

---

#### Variant B: Vymazať publikovanie (ak nemáš TRV)
```bash
# 1. Nájdi všetky cmd/hvac publish
grep -n "cmd/hvac" flows/nodered/flows.json

# 2. Odstráň MQTT OUT nodes alebo zakomentuj
# Alebo vypni cez Node-RED editor (disable nodes)
```

**Výhody:**
- ✅ Čistejší MQTT traffic
- ✅ Menej overhead

**Nevýhody:**
- ❌ Ak v budúcnosti pridáš TRV, treba znovu implementovať

**Čas:** 15 minút  
**Priorita:** NÍZKA - ak nemáš TRV, nie je kritické

---

### 2. `internal/recalc_mode` - Implementovať alebo vymazať

**Problém:**  
POST `/api/mode` publikuje `internal/recalc_mode` topic, ale **žiadny subscriber** → message sa ignoruje.

**Účel:** Trigger pre prepočítanie režimov keď admin zmení mode cez API.

**Varianty riešenia:**

#### Variant A: Implementovať subscriber (ODPORÚČANÝ ak chceš manuálne mode override)
```json
{
  "type": "mqtt in",
  "topic": "internal/recalc_mode",
  "qos": "1",
  "wires": [["resolver_trigger_node"]]
}
```

Prepojíš na existujúci **Mode Resolver** node aby prepočítal režimy.

**Kedy použiť:**
- ✅ Chceš aby admin mohol manuálne zmeniť mode cez API
- ✅ Chceš aby sa režimy okamžite prepočítali po zmene

**Čas:** 10 minút  
**Priorita:** STREDNÁ

---

#### Variant B: Vymazať publish (ak režim resolver beží periodicky)
```bash
# flows.json - Mode POST Handler
# Odstráň publikovanie internal/recalc_mode
```

**Kedy použiť:**
- ✅ Mode resolver už beží každých 5 minút (cronplus)
- ✅ Nepotrebuješ okamžité prepočítanie

**Výhody:**
- ✅ Jednoduchšie
- ✅ Menej MQTT trafficu

**Nevýhody:**
- ⚠️ Zmena mode cez API sa prejaví až za max 5 minút

**Čas:** 5 minút  
**Priorita:** NÍZKA

---

### 3. Meta service monitoring topics

**Problém:**  
Subscriber existuje pre `meta/service/ui/online`, `meta/service/baikal/online` ale **nikto nepublikuje** → service status vždy `null`.

**Varianty riešenia:**

#### Variant A: Implementovať UI heartbeat (ODPORÚČANÝ)

**Next.js UI (`ui/smarthome-ui/src/app/api/heartbeat/route.ts`):**
```typescript
import mqtt from 'mqtt';

export async function GET() {
  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://mosquitto:1883');
  
  client.publish('meta/service/ui/online', 'true', { retain: true });
  
  client.end();
  return Response.json({ status: 'ok' });
}
```

**Cron v Node-RED:**
```json
{
  "type": "inject",
  "name": "UI Heartbeat Check",
  "crontab": "*/5 * * * *",
  "topic": "",
  "wires": [["http_request_ui_heartbeat"]]
}
```

**Výhody:**
- ✅ Skutočný monitoring UI stavu
- ✅ Alert keď UI spadne

**Nevýhody:**
- ⚠️ Vyžaduje úpravu Next.js kódu

**Čas:** 20 minút  
**Priorita:** STREDNÁ

---

#### Variant B: Mock publisher (pre testovanie)
```json
{
  "type": "inject",
  "name": "Mock UI Online",
  "repeat": "60",
  "topic": "meta/service/ui/online",
  "payload": "true",
  "wires": [["mqtt_out"]]
}
```

**Kedy použiť:**
- ✅ Rýchle testovanie
- ⚠️ Nie je skutočný monitoring

**Čas:** 5 minút  
**Priorita:** NÍZKA

---

#### Variant C: Vymazať subscribers
Ak nepotrebuješ service monitoring:

```bash
# Odstráň MQTT IN nodes pre meta/service/*
```

**Čas:** 2 minúty  
**Priorita:** NÍZKA

---

## 🟡 PRIORITA STREDNÁ (2 úlohy)

### 4. `service_mosquitto_online` / `service_baikal_online`

**Problém:**  
API vracia `"mosquitto": null, "baikal": null` namiesto `true/false` lebo flow premenné sa nikdy nenastavujú.

**Riešené čiastočne:** Zmenené z `false` → `null` (presnejšie "neznámy stav")

**Varianty riešenia:**

#### Variant A: Implementovať skutočný monitoring (ODPORÚČANÝ)

**Mosquitto:**
```javascript
// Function node prepojený na topic $SYS/broker/uptime
const uptime = parseInt(msg.payload);
flow.set('service_mosquitto_online', uptime > 0);
```

**Baikal:**
```javascript
// HTTP Request node GET http://baikal:80/.well-known/caldav
// Function node:
flow.set('service_baikal_online', msg.statusCode === 200);
```

**Výhody:**
- ✅ Skutočné monitoring
- ✅ Alerts keď služba spadne

**Čas:** 15 minút  
**Priorita:** STREDNÁ

---

#### Variant B: Hardcoded true
```javascript
// API status handler
services: {
    nodered: true,
    mosquitto: true,  // Vždy predpokladaj že beží
    baikal: true
}
```

**Kedy použiť:**
- ✅ Mosquitto/Baikal sú v rovnakom Docker Compose stacku
- ✅ Ak jeden beží, všetky bežia

**Čas:** 2 minúty  
**Priorita:** NÍZKA

---

#### Variant C: Odstrániť z API response
```javascript
services: {
    nodered: true
    // mosquitto/baikal removed
}
```

**Čas:** 2 minúty  
**Priorita:** NÍZKA

---

### 5. Logs rotácia a cleanup

**Problém:**  
Logs v `flows/nodered/logs/` a `compose/config/zigbee2mqtt/log/` môžu rásť donekonečna.

**Varianty riešenia:**

#### Variant A: Logrotate (ODPORÚČANÝ pre production)
```bash
# /etc/logrotate.d/smarthome
/home/pi/smarthome/flows/nodered/logs/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}

/home/pi/smarthome/compose/config/zigbee2mqtt/log/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
```

**Čas:** 10 minút  
**Priorita:** STREDNÁ

---

#### Variant B: Cron cleanup script
```bash
#!/bin/bash
# scripts/cleanup-logs.sh

find /home/pi/smarthome/flows/nodered/logs -name "*.log" -mtime +7 -delete
find /home/pi/smarthome/compose/config/zigbee2mqtt/log -name "*.log" -mtime +14 -delete
```

**Crontab:**
```cron
0 3 * * * /home/pi/smarthome/scripts/cleanup-logs.sh
```

**Čas:** 5 minút  
**Priorita:** STREDNÁ

---

#### Variant C: Docker logs limits
```yaml
# docker-compose.yml
services:
  nodered:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Čas:** 5 minút  
**Priorita:** VYSOKÁ - najjednoduchšie a najefektívnejšie

---

## 🟢 PRIORITA NÍZKA (2 úlohy)

### 6. Zigbee2MQTT API dokumentácia

**Problém:**  
Nie je jasné aké zariadenia máš, ich capabilities, atď.

**Variant A: Generovať dokumentáciu automaticky**
```bash
#!/bin/bash
# scripts/generate-zigbee-docs.sh

curl -s http://localhost:8080/api/devices > docs/zigbee-devices.json
curl -s http://localhost:8080/api/info > docs/zigbee-info.json

# Vytvor markdown
cat > docs/ZIGBEE_DEVICES.md <<EOF
# Zigbee Zariadenia

\`\`\`json
$(cat docs/zigbee-devices.json)
\`\`\`
EOF
```

**Čas:** 10 minút  
**Priorita:** NÍZKA

---

### 7. Config validácia CI/CD

**Problém:**  
`modes.yaml` a `mqtt-schemas.json` sa nevalidujú pred deploymentom.

**Variant A: GitHub Actions validation step**
```yaml
# .github/workflows/ci-cd.yml
- name: Validate configs
  run: |
    npm install -g ajv-cli
    ajv validate -s config/modes.schema.json -d config/modes.yaml
    node scripts/validate-config.js
```

**Čas:** 15 minút  
**Priorita:** NÍZKA (už máš local validation)

---

## 📊 Zhrnutie Odporúčaní

| Úloha | Variant | Čas | Priorita | Odporúčanie |
|-------|---------|-----|----------|-------------|
| CMD topics | A - Overiť hardvér | 10 min | VYSOKÁ | ✅ Urob najprv |
| internal/recalc_mode | B - Vymazať | 5 min | NÍZKA | ✅ Ak resolver beží cronplus |
| Meta service | C - Vymazať | 2 min | NÍZKA | ✅ Alebo Variant A ak chceš monitoring |
| service_*_online | B - Hardcoded true | 2 min | NÍZKA | ✅ Najrýchlejšie |
| Logs rotácia | C - Docker limits | 5 min | VYSOKÁ | ✅✅ Kritické pre production |
| Zigbee docs | A - Auto-generate | 10 min | NÍZKA | ⚪ Optional |
| Config CI/CD | A - GitHub Actions | 15 min | NÍZKA | ⚪ Nice to have |

---

## 🎯 Navrhovaný Akčný Plán

### Fáza 1 - Kritické (30 minút)
```bash
1. ✅ Overiť CMD topics hardvér (10 min)
   mosquitto_sub -v -t 'cmd/hvac/#'
   
2. ✅ Docker logs limits (5 min)
   Pridaj logging config do docker-compose.yml
   
3. ✅ service_*_online hardcoded true (2 min)
   API status handler update
   
4. ✅ Vymazať internal/recalc_mode publish (5 min)
   Mode POST handler update
   
5. ✅ Vymazať meta/service subscribers (2 min)
   Ak nepotrebuješ monitoring
```

### Fáza 2 - Nice to have (25 minút)
```bash
6. ⚪ Zigbee docs auto-generate (10 min)
7. ⚪ Config validation CI/CD (15 min)
```

---

## 🔧 Quick Commands

### Debugging CMD topics
```bash
# Monitor MQTT
mosquitto_sub -v -t 'cmd/#'

# Publish test
mosquitto_pub -t 'cmd/hvac/spalna/setpoint' -m '21.5'

# Check Zigbee2MQTT
curl -s http://localhost:8080/api/devices | jq -r '.[] | select(.type=="climate") | .friendly_name'
```

### Docker logs check
```bash
# Current log sizes
docker compose exec nodered du -sh /data/logs/
docker compose exec zigbee2mqtt du -sh /app/data/log/

# Check log driver
docker inspect compose-nodered-1 | jq '.[0].HostConfig.LogConfig'
```

### Service status
```bash
# Mosquitto uptime
mosquitto_sub -t '$SYS/broker/uptime' -C 1

# Baikal health
curl -I http://localhost:5232/.well-known/caldav
```

---

**Celkový čas:** Fáza 1 (30 min) + Fáza 2 (25 min) = **55 minút**  
**Odporúčanie:** Urob Fázu 1, Fáza 2 je optional
