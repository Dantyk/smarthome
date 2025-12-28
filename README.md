# SmartHome - Inteligentný Systém Riadenia Vykurovania

![CI/CD](https://github.com/Dantyk/smarthome/workflows/CI%2FCD/badge.svg)
![Unit Tests](https://img.shields.io/badge/unit%20tests-18%20passing-success)
![Integration Tests](https://img.shields.io/badge/integration-22%20passing-success)

Automatizovaný systém pre domáce vykurovanie s pokročilou reguláciou teploty, režimami a kalendárovým ovládaním.

## 📚 Dokumentácia

### Prehľad Projektu
- **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** - 🆕 Kompletný stav projektu, implementované funkcie, konfigurácia

### Používateľská dokumentácia
- **[QUICKSTART.md](QUICKSTART.md)** - Rýchly 5-minútový setup guide
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment (30 min)
- **[CHANGELOG.md](CHANGELOG.md)** - Verzie a história zmien

### Prevádzková dokumentácia
- **[docs/TESTING.md](docs/TESTING.md)** - Testing guide (E2E, MQTT, API, load testing)
- **[docs/ALERTS.md](docs/ALERTS.md)** - Alert management a response procedures
- **[docs/SECURITY.md](docs/SECURITY.md)** - Security config (MQTT ACL, UI auth, firewall)
- **[docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)** - Production features overview

### Technická dokumentácia
- **[docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md)** - Kompletné implementation summary
- **[docs/architecture/](docs/architecture/)** - Architecture Decision Records (ADR) + C4 diagramy
- **[docs/runbooks/](docs/runbooks/)** - Operational runbooks pre bežné scenáre

---

## ✨ Production Features

🔥 **Nové v 2025:** Kompletná production-ready infraštruktúra!

### Reliability & Performance
- ✅ **Config Hot Reload** - Zmeny v modes.yaml bez reštartu
- ✅ **Rate Limiting** - MQTT backpressure protection (100 req/min)
- ✅ **Redis Caching** - Weather, modes config, MQTT state (10min-1h TTL)
- ✅ **Performance Profiling** - Automated bottleneck detection

### Observability
- ✅ **Distributed Tracing** - Jaeger integration (http://localhost:16686)
- ✅ **Metrics & Monitoring** - Prometheus + Grafana dashboards
- ✅ **17 Alert Rules** - Critical/Warning/Info with Discord + Email notifications
- ✅ **Alertmanager** - Smart alert routing, grouping, inhibition

### Testing & Quality
- ✅ **Integration Tests** - Playwright E2E (14 tests) + MQTT (14 tests) + API (9 tests)
- ✅ **Load Testing** - K6 stress tests (MQTT + API scenarios)
- ✅ **Security Audit** - npm audit + Trivy Docker scanning
- ✅ **Automated Backups** - Denné zálohy cez GitHub Actions

### Security (LAN-optimized)
- ✅ **MQTT ACL** - Topic-level permissions (admin/nodered/ui/monitor roles)
- ✅ **UI Authentication** - Basic Auth + session cookies (24h TTL)
- ✅ **Network Hardening** - UFW firewall, LAN-only access

👉 **[Kompletná dokumentácia →](./docs/PRODUCTION_READINESS.md)**

---

## 🏗️ Architektúra

### Komponenty

#### Základné (vždy spustené)
- **Node-RED** - Hlavná riadiaca logika, kalendárová synchronizácia, MQTT orchestrácia
- **Mosquitto MQTT** - Message broker pre komunikáciu medzi komponentmi
- **Baïkal CalDAV** - Lokálny kalendárový server pre manuálne udalosti
- **Next.js UI** - Webové rozhranie pre ovládanie a monitoring (port 8088)

#### Voliteľné (spúšťajú sa cez profily)
- **Z-Wave JS UI** (profil: `zwave`) - Ovládanie Z-Wave termostatov a senzorov (port 8091)
- **Zigbee2MQTT** (profil: `zigbee`) - Ovládanie Zigbee zariadení (port 8080)
- **InfluxDB** (profil: `metrics`) - Časová databáza pre historické dáta (port 8086)
- **Grafana** (profil: `metrics`) - Vizualizácie a grafy (port 3000)
- **Apprise** (profil: `notify`) - Notifikačný server (port 8000)

### Dátový tok

```
Google Calendar ──┐
                  ├──> Node-RED ──> MQTT ──> Termostaty
Baïkal CalDAV ───┘         │
                           └──> Next.js UI
```

## 📋 Požiadavky

- Raspberry Pi (alebo iný Linux server)
- Docker + Docker Compose
- Node-RED kompatibilné termostaty (Z-Wave, Zigbee, alebo MQTT)

## 🚀 Inštalácia

1. **Klonuj repozitár:**
   ```bash
   git clone https://github.com/Dantyk/smarthome.git
   cd smarthome
   ```

2. **Nakonfiguruj prostredie:**
   ```bash
   cd compose
   cp .env.example .env
   nano .env  # Nastav porty, API kľúče, zariadenia
   ```

3. **Spusti základné služby:**
   ```bash
   docker compose up -d
   ```

4. **Spusti voliteľné profily** (podľa potreby):
   
   **Z-Wave termostaty:**
   ```bash
   # Najprv over USB port Z-Wave sticku
   ls -la /dev/ttyACM*
   # Uprav device v docker-compose.yml ak je potrebné
   docker compose --profile zwave up -d
   ```
   
   **Zigbee zariadenia:**
   ```bash
   # Najprv over USB port Zigbee adaptéra
   ls -la /dev/ttyUSB*
   # Uprav device v docker-compose.yml ak je potrebné
   docker compose --profile zigbee up -d
   ```
   
   **Metriky a vizualizácie:**
   ```bash
   docker compose --profile metrics up -d
   # Grafana: http://localhost:3000 (admin/smarthome)
   # InfluxDB: http://localhost:8086 (admin/smarthome123)
   ```
   
   **Notifikácie:**
   ```bash
   # Nastav PUSHOVER_USER a PUSHOVER_TOKEN v .env
   docker compose --profile notify up -d
   ```

5. **Dokončí Baïkal setup:**
   - Otvor: `http://localhost:8800/admin/`
   - Admin heslo: `admin` (alebo podľa `.env`)
   - Vytvor používateľa: `smarthome` / `smarthome`

6. **Otvor Node-RED:**
   - URL: `http://localhost:1880`
   - Import flows z `/flows/nodered/flows.json`

7. **Prístup k webovým rozhraniám:**
   - **SmartHome UI**: `http://localhost:8088`
   - **Node-RED**: `http://localhost:1880`
   - **Baïkal**: `http://localhost:8800/admin/`
   - **Z-Wave JS UI**: `http://localhost:8091` (ak zapnutý profil `zwave`)
   - **Zigbee2MQTT**: `http://localhost:8090` (ak zapnutý profil `zigbee`)
   - **Grafana**: `http://localhost:3000` (ak zapnutý profil `metrics`)
   - **InfluxDB**: `http://localhost:8086` (ak zapnutý profil `metrics`)

## 🔐 GitHub Actions - CI/CD Secrets

Pre automatický deploy do produkcie (via GitHub Actions) je potrebné nastaviť tieto **repository secrets**:

**Postup:**
1. Choď na GitHub: `Settings` → `Secrets and variables` → `Actions`
2. Klikni `New repository secret`
3. Pridaj nasledujúce secrets:

| Secret Name | Popis | Príklad |
|------------|-------|---------|
| `DEPLOY_SSH_KEY` | SSH private key pre prístup na produkčný server | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |
| `DEPLOY_HOST` | IP alebo hostname produkčného servera | `192.168.1.100` alebo `smarthome.local` |
| `DEPLOY_USER` | SSH username na produkčnom serveri | `pi` |
| `OPENWEATHER_API_KEY` | OpenWeatherMap API kľúč (voliteľné) | `abc123def456...` |

**Generovanie SSH kľúča:**
```bash
# Na svojom počítači
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/smarthome_deploy
# Public key skopíruj na produkčný server
ssh-copy-id -i ~/.ssh/smarthome_deploy.pub pi@192.168.1.100
# Private key (__bez__ .pub) vlož do DEPLOY_SSH_KEY secretu
cat ~/.ssh/smarthome_deploy
```

**Poznámka:** Deploy job sa automaticky preskočí, ak `DEPLOY_SSH_KEY` nie je nastavený.

## ⚙️ Konfigurácia

### Režimy (`/config/modes.yaml`)

Systém podporuje 3 základné režimy:

- **weekend** - Komfortné teploty cez celý deň
- **workday** - Úsporný režim cez deň (práca), komfort večer
- **visitors** - Špeciálny režim pri hosťoch

Každý režim definuje:
- **Priority** - Vyššia priorita preváži nižšiu
- **Activation** - Podmienky aktivácie (čas, deň v týždni, kalendár)
- **Room regime** - Rozloženie teplôt pre jednotlivé miestnosti

### Teplotné režimy

Každá miestnosť môže mať teplotné profily:

- **WORKDAY** - Úsporný (16°C cez deň, 21°C večer)
- **WEEKEND** - Komfortný (21°C celý deň)

## 📅 Kalendárové udalosti

Systém podporuje riadenie cez kalendár pomocou DSL (Domain Specific Language) v názve udalosti.

### SMH MODE - Prepnutie režimu

Aktivuje špecifický režim počas trvania udalosti.

**Syntax:**
```
SMH MODE=nazov_rezimu
```

**Príklady:**
```
SMH MODE=visitors
SMH MODE=weekend
SMH MODE=workday
```

**Použitie:**
- Vytvor udalosť v Google Calendar alebo Baïkal
- Názov: `SMH MODE=visitors`
- Čas: Dnes 14:00 - 18:00
- **Výsledok**: Počas návštevy (14-18h) sa aktivuje režim "visitors"

---

### SMH BOOST - Dočasné zvýšenie teploty

Zvýši teplotu v konkrétnej miestnosti na určenú hodnotu.

**Syntax:**
```
SMH BOOST room=MIESTNOST temp=TEPLOTA dur=MINUTY
```

**Parametre:**
- `room` - povinné: `bedroom`, `kidroom1`, `living`, `kitchen`, `bathroom`
- `temp` - voliteľné: cieľová teplota (°C), default = aktuálna + 2°C
- `dur` - voliteľné: trvanie v minútach, default = 60

**Príklady:**
```
SMH BOOST room=bedroom temp=23 dur=120
SMH BOOST room=bathroom temp=24
SMH BOOST room=kidroom1
```

**Použitie:**
- Rýchle ohriatie kúpeľne pred sprchou
- Komfort v spálni pred spaním
- Aktivuje sa okamžite po vytvorení udalosti

---

### SMH OFFSET - Úprava teploty

Upraví cieľovú teplotu o zadaný offset (relatívna zmena).

**Syntax:**
```
SMH OFFSET room=MIESTNOST +/-HODNOTA
```

**Parametre:**
- `room` - povinné: názov miestnosti
- `offset` - povinné: relatívna zmena teploty (napr. `+2.5`, `-1`)

**Príklady:**
```
SMH OFFSET room=kitchen -1
SMH OFFSET room=kidroom1 +2.5
SMH OFFSET room=living -0.5
```

**Použitie:**
- Jemná korekcia teploty bez zmeny celého režimu
- Offset platí **počas trvania kalendárovej udalosti**
- Pre trvalú zmenu použi MQTT: `mosquitto_pub -t 'virt/offset/living/value' -m '-1' -r`

---

### Kombinácie

Môžeš kombinovať viacero udalostí naraz:

**Scenár: Víkendová párty**
1. `SMH MODE=visitors` (Sobota 14:00 - 22:00)
2. `SMH BOOST room=living temp=22` (Sobota 13:30 - 15:00)
3. `SMH OFFSET room=bathroom +1` (Sobota 14:00 - 22:00)

**Výsledok:**
- Pred príchodom hostí sa obývačka prehreje
- Počas návštevy bude aktívny režim "visitors"
- Kúpeľňa bude mať o 1°C vyššiu teplotu

## 🌡️ Weather Correlation

Systém automaticky upravuje cieľové teploty podľa vonkajšej teploty a vetra.

**Konfigurácia:** `/config/modes.yaml` → `weather.correlation`

**Koeficienty:**
- `kT` (Temperature) - Čím chladnejšie vonku, tým viac topiť (záporná hodnota!)
- `kW` (Wind) - Čím silnejší vietor, tým viac topiť (záporná hodnota!)
- `kD` (Direction) - Váha smeru vetra (severný vietor = vyššie váhy)

**Príklad:**
```yaml
bedroom:
  kT: -0.08   # Pri -10°C vonku → +0.8°C vnútri
  kW: -0.03   # Pri 20km/h vetre → +0.6°C vnútri
  dir_weights:
    north: 1.5   # Severný vietor má väčší vplyv
    south: 0.3   # Južný vietor má menší vplyv
```

## 📊 InfluxDB & Grafana (Metriky)

### Čo sa meria a prečo?

Systém automaticky zbiera metriky z MQTT a ukladá ich do **InfluxDB** (časová databáza). **Grafana** potom vizualizuje historické dáta.

**Merané metriky:**

| Metrika | MQTT Topic | Účel |
|---------|-----------|------|
| **Teplota** | `stat/hvac/+/current_temp` | Sledovanie teplotných trendov, porovnanie s cieľom |
| **Vlhkosť** | `stat/hvac/+/humidity` | Monitoring vlhkosti v miestnostiach, optimalizácia vetrania |
| **Cieľová teplota** | `virt/room/+/target_temp` | Sledovanie weather correlation offsetov |
| **Weather offset** | extrahované z `target_temp` JSON | Koľko °C pridala/odobrala weather correlation |
| **Override aktivity** | `virt/room/+/override` | Kedy a ako často užívateľ manuálne mení teplotu |
| **Boost trvanie** | `virt/boost/+/minutes` | Štatistika použitia boost režimu |
| **HVAC ON/OFF** | `stat/hvac/+/enabled` | Uptime kúrenia, efektivita režimov |

### 1. Aktivácia metrics profilu

```bash
cd /home/pi/smarthome/compose

# Nastav token v .env (vygeneruj náhodný)
openssl rand -hex 32  # skopíruj výstup
nano .env  # nastav INFLUX_TOKEN=<vygenerovaný token>

# Spusti InfluxDB + Grafana
docker compose --profile metrics up -d

# Over že bežia
docker compose ps influxdb grafana
```

### 2. Konfigurácia InfluxDB v Node-RED

#### A) Inštalácia InfluxDB node

1. Otvor Node-RED: `http://localhost:1880`
2. Menu (☰) → **Manage palette** → **Install**
3. Hľadaj: `node-red-contrib-influxdb`
4. Klikni **Install**

#### B) Vytvorenie InfluxDB Server Config

1. Pridaj akýkoľvek **influxdb out** node do canvasu (len dočasne)
2. Double-click → vedľa **Server** klikni **✏️ (Add new influxdb...)**
3. Nastav:
   - **Version**: `2.0`
   - **URL**: `http://influxdb:8086`
   - **Token**: `${INFLUX_TOKEN}` z `.env` súboru
   - **Organization**: `Home` (alebo hodnota z `INFLUX_ORG`)
   - **Bucket**: `smarthome` (alebo hodnota z `INFLUX_BUCKET`)
4. Klikni **Add** → **Done**

#### C) Flow pre automatické logovanie teplôt

**Kód flow (importuj do Node-RED):**

```json
[
  {
    "id": "mqtt_temp_in",
    "type": "mqtt in",
    "name": "Teploty",
    "topic": "stat/hvac/+/current_temp",
    "qos": "0",
    "broker": "mqtt_broker",
    "x": 120,
    "y": 100,
    "wires": [["format_temp"]]
  },
  {
    "id": "format_temp",
    "type": "function",
    "name": "Format for InfluxDB",
    "func": "const room = msg.topic.split('/')[2];\nconst temp = parseFloat(msg.payload);\n\nif (isNaN(temp)) return null;\n\nmsg.payload = {\n    measurement: 'temperature',\n    fields: { value: temp },\n    tags: { room: room, sensor: 'hvac' },\n    timestamp: new Date()\n};\nreturn msg;",
    "x": 320,
    "y": 100,
    "wires": [["influx_out"]]
  },
  {
    "id": "influx_out",
    "type": "influxdb out",
    "name": "→ InfluxDB",
    "influxdb": "your_influxdb_config_id",
    "x": 540,
    "y": 100,
    "wires": []
  }
]
```

**Postup:**
1. Copy JSON vyššie
2. Node-RED menu → **Import** → Paste → **Import**
3. Double-click na **influx_out** node
4. Vyber **Server** (InfluxDB config z kroku B)
5. **Deploy**

#### D) Podobné flow pre ostatné metriky

**Vlhkosť:**
```javascript
// MQTT: stat/hvac/+/humidity
const room = msg.topic.split('/')[2];
msg.payload = {
    measurement: 'humidity',
    fields: { value: parseFloat(msg.payload) },
    tags: { room: room },
    timestamp: new Date()
};
return msg;
```

**Weather offset (z target_temp JSON):**
```javascript
// MQTT: virt/room/+/target_temp
const room = msg.topic.split('/')[2];
let data;
try {
    data = typeof msg.payload === 'object' ? msg.payload : JSON.parse(msg.payload);
} catch(e) {
    return null;
}

if (data.delta !== undefined) {
    msg.payload = {
        measurement: 'weather_offset',
        fields: { 
            offset: parseFloat(data.delta),
            original: parseFloat(data.originalValue),
            adjusted: parseFloat(data.value)
        },
        tags: { room: room },
        timestamp: new Date()
    };
    return msg;
}
return null;
```

**HVAC enabled/disabled:**
```javascript
// MQTT: stat/hvac/+/enabled
const room = msg.topic.split('/')[2];
const enabled = (msg.payload === 'true' || msg.payload === true);
msg.payload = {
    measurement: 'hvac_state',
    fields: { enabled: enabled ? 1 : 0 },
    tags: { room: room },
    timestamp: new Date()
};
return msg;
```

### 3. Grafana Dashboard Setup

#### A) Prvé prihlásenie

1. Otvor: `http://localhost:3000`
2. Login: `admin` / `admin123` (alebo hodnoty z `.env`)
3. (Voliteľné) Zmeň heslo pri prvom prihlásení

#### B) Pridanie InfluxDB Data Source

1. **☰ Menu** → **Connections** → **Data Sources** → **Add data source**
2. Vyber **InfluxDB**
3. Nastav:
   - **Name**: `InfluxDB SmartHome`
   - **Query Language**: `Flux`
   - **URL**: `http://influxdb:8086`
   - **Auth**: Vypni všetko (Basic auth, TLS, atď.)
   - **Organization**: `Home` (z `.env`)
   - **Token**: `${INFLUX_TOKEN}` (z `.env`)
   - **Default Bucket**: `smarthome` (z `.env`)
4. **Save & Test** → Malo by ukázať ✅ "datasource is working"

#### C) Vytvorenie dashboardu

**Dashboard 1: Teploty v čase (Line Chart)**

1. **☰ Menu** → **Dashboards** → **New Dashboard** → **Add visualization**
2. Vyber **InfluxDB SmartHome** data source
3. V query editore prepni na **Code** (vpravo hore)
4. Flux query:
```flux
from(bucket: "smarthome")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r._measurement == "temperature")
  |> filter(fn: (r) => r._field == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```
5. Vpravo v **Panel options**:
   - Title: `Teploty po miestnostiach`
   - Legend: `{{room}}`
6. **Apply** → **Save dashboard** → Pomenuj: `SmartHome Overview`

**Dashboard 2: Aktuálna vlhkosť (Gauge)**

1. Pridaj nový panel: **Add** → **Visualization**
2. Vyber **Gauge**
3. Flux query:
```flux
from(bucket: "smarthome")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "humidity")
  |> filter(fn: (r) => r._field == "value")
  |> last()
```
4. Nastav limity:
   - Min: 0
   - Max: 100
   - Thresholds: 30 (red), 40 (yellow), 50 (green)
5. **Apply**

**Dashboard 3: Weather Offset Impact (Area Chart)**

1. Nový panel → **Time series**
2. Flux query:
```flux
from(bucket: "smarthome")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r._measurement == "weather_offset")
  |> filter(fn: (r) => r._field == "offset")
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
```
3. **Panel options**:
   - Title: `Weather Correlation Offset`
   - Legend: `{{room}}`
   - Graph style: `Lines` → Area fill opacity: `0.3`
4. **Apply**

**Dashboard 4: HVAC Uptime (Stat panel)**

1. Nový panel → **Stat**
2. Flux query:
```flux
from(bucket: "smarthome")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "hvac_state")
  |> filter(fn: (r) => r._field == "enabled")
  |> mean()
  |> map(fn: (r) => ({ r with _value: r._value * 100.0 }))
```
3. **Panel options**:
   - Title: `HVAC Uptime (24h)`
   - Unit: `Percent (0-100)`
   - Color scheme: Thresholds
4. **Apply**

#### D) Export/Import dashboardu

**Export:**
1. Dashboard → ⚙️ Settings → **JSON Model** → Copy JSON
2. Ulož do `/home/pi/smarthome/grafana-dashboard.json`

**Import:**
1. **☰ Menu** → **Dashboards** → **Import**
2. Upload JSON súbor
3. Vyber **InfluxDB SmartHome** ako data source

### 4. Údržba a troubleshooting

**Over že dáta prúdia do InfluxDB:**
```bash
# InfluxDB CLI (v kontajneri)
docker exec -it compose-influxdb-1 influx query \
  --org Home \
  --token "${INFLUX_TOKEN}" \
  'from(bucket:"smarthome") |> range(start: -1h) |> limit(n:10)'
```

**Node-RED debug:**
1. Pridaj **debug node** za function node (pred InfluxDB out)
2. Over že payload má správny formát:
```json
{
  "measurement": "temperature",
  "fields": { "value": 21.5 },
  "tags": { "room": "spalna" },
  "timestamp": "2025-11-22T..."
}
```

**Grafana no data:**
- Over čas range (vpravo hore, napr. "Last 6 hours")
- Skontroluj bucket name v query
- Verify InfluxDB token v data source settings

**Retencia dát:**
- Default: 30 dní (nastavené v docker-compose.yml)
- Zmena: InfluxDB UI → **Data** → **Buckets** → Edit retention

### 5. Kontrola stavu služieb

Pre rýchlu kontrolu všetkých služieb použite helper script:

```bash
cd /home/pi/smarthome/compose
./check-services.sh
```

**Výstup ukáže:**
- ✅ Bežiace služby (s portami)
- ❌ Neaktívne služby
- ⏸️ Služby vypnuté profilom
- ⚠️ Chybové stavy
- 📈 InfluxDB data collection status

**Manuálna kontrola:**
```bash
# Všetky služby
docker compose ps

# Ktoré profily sú aktívne
grep COMPOSE_PROFILES compose/.env

# Logy konkrétnej služby
docker compose logs -f influxdb
docker compose logs -f grafana

# Over InfluxDB API
curl -s "http://localhost:8086/api/v2/buckets?org=Home" \
  -H "Authorization: Token ${INFLUX_TOKEN}"
```

**Časté problémy:**

| Problém | Riešenie |
|---------|----------|
| `Zigbee2MQTT: Exited (127)` | Zariadenie `/dev/ttyUSB0` neexistuje - over ZIGBEE_DEVICE v .env |
| `Z-Wave: NOT RUNNING` | Zariadenie `/dev/ttyACM0` neexistuje - over ZWAVE_DEVICE v .env |
| `InfluxDB: 401 Unauthorized` | Token nie je správny - regeneruj: `openssl rand -hex 32` |
| `Grafana: No data` | Node-RED flows nie sú nakonfigurované - pozri sekciu vyššie |
| `Profil nezapnutý` | Pridaj do COMPOSE_PROFILES v .env, napr.: `metrics,zigbee,zwave` |

## 🔔 Monitoring a Notifikácie

### Automatický monitoring služieb

**Node-RED Health Check** (každé 2 minúty):
- ✅ **baikal** - CalDAV kalendár
- ✅ **nodered** - Node-RED engine
- ✅ **zwavejsui** - Z-Wave controller
- ✅ **apprise** - Push notifikácie

**Zigbee2MQTT monitoring** (každé 3 minúty):
- 📜 Bash script: `/scripts/monitor-zigbee.sh`
- 🔍 Sleduje Docker container status cez Docker API
- ⚠️ Warning alert pri crashe (rate limit: 3h, quiet hours: 22:00-07:00)
- ✅ Recovery notifikácia pri obnovení

**Nemonitorované služby:**
- **mosquitto** - MQTT broker (nemá HTTP endpoint, monitoruje sa pasívne)
- **influxdb** - metriky (nie kritické pre core funkcionalitu)
- **grafana** - dashboard (nie kritické)
- **ui** - Next.js web UI (nie kritické)

### Push notifikácie (Pushover)

**Konfigurácia:**
1. Vytvor Pushover účet na https://pushover.net/
2. Získaj **User Key** a vytvor **Application/API Token**
3. Pridaj do `.env`:
   ```bash
   PUSHOVER_USER=your_user_key
   PUSHOVER_TOKEN=your_app_token
   ```
4. Spusti Apprise profil:
   ```bash
   docker compose --profile notify up -d
   ```

**Typy alertov:**

| Typ alertu | Severity | Rate limit | Quiet hours | Príklad |
|------------|----------|------------|-------------|----------|
| 🔥 **Smoke/Fire** | Emergency | ❌ Žiadny | ❌ Ignoruje | Požiar každé 3 min až kým nehasíš |
| 🔌 **Zigbee crash** | Warning | ✅ 3h | ✅ 22:00-07:00 | Max 1x za 3h, v noci nič |
| ⚠️ **Service offline** | Warning | ✅ 3h | ✅ 22:00-07:00 | Max 1x za 3h, v noci nič |
| ✅ **Recovery** | Info | ❌ Žiadny | ❌ Vždy | Hneď keď sa opraví |

**Rate limiting pravidlá:**
- **Kritické alerty** (smoke, fire): Posielané VŽDY okamžite, bez obmedzení
- **Nekritické** (service offline, Zigbee): Max 1 alert za 3 hodiny na službu
- **Quiet hours**: 22:00-07:00 - nekritické alerty sa nepošlú

**Manuálne testovanie:**
```bash
# Test emergency alert (smoke)
mosquitto_pub -h localhost -t "event/safety/smoke/obyvacka/trigger" \
  -m '{"detected":true}'

# Test warning alert (custom)
mosquitto_pub -h localhost -t "meta/alert/test" -m '{
  "severity":"warning",
  "type":"test_alert",
  "location":"system",
  "message":"⚠️ Test notifikácie",
  "timestamp":"'$(date -Iseconds)'",
  "actions":["pushover"]
}'

# Kontrola Apprise logov
docker compose logs --tail=20 apprise | grep Pushover
```

**Custom alerts cez MQTT:**
- Topic: `meta/alert/*`
- Payload: JSON s poľami `severity`, `type`, `location`, `message`, `timestamp`, `actions`
- Podporované severity: `emergency`, `warning`, `info`
- Podporované actions: `pushover`, `pushover_emergency`, `sms`, `siren`

### Cron monitoring jobs

```bash
# Zoznam aktívnych cron jobov
crontab -l

# Výstup:
# */3 * * * * /home/pi/smarthome/scripts/monitor-zigbee.sh >> /tmp/zigbee_monitor.log 2>&1

# Kontrola logov
tail -f /tmp/zigbee_monitor.log
```

## 🔧 Údržba

### Logy
```bash
# Všetky služby
docker compose logs -f

# Node-RED
docker compose logs -f nodered

# Google Calendar sync
docker compose logs nodered | grep "\[gcal\]"
```

### Reštart služieb
```bash
docker compose restart nodered
docker compose restart baikal
```

### UI dev / deployment note

If you change UI source files under `ui/smarthome-ui`, the Next.js app must be rebuilt and the `ui` container restarted so the running site picks up the changes. Example commands:

```bash
# build the UI
cd ui/smarthome-ui
npm ci && npm run build

# rebuild the docker image and restart the service
cd ../../compose
docker compose build ui
docker compose up -d ui
```

Add these steps to your normal code-change workflow to avoid serving stale server-rendered HTML or client bundles.

## 🚀 Redis Cache Layer

SmartHome používa **Redis** pre cachovanie často používaných dát a zníženie záťaže na API/databázy.

### Čo sa cachuje

| Typ dát | TTL | Účel |
|---------|-----|------|
| **Weather API** | 10 min (600s) | Znížiť počet volaní OpenWeather API |
| **Modes Config** | Persistent | Rýchly prístup k `modes.yaml` bez disk I/O |
| **MQTT State** | 1 hod (3600s) | Predchádzať stratám stavu pri reštarte |

### Metrics Endpoints

Cache poskytuje real-time metriky:

```bash
# Prometheus formát (pre Grafana)
curl http://localhost:1880/metrics

# JSON formát (debugging)
curl http://localhost:1880/metrics/json | jq '.cache'
```

**Príklad výstupu:**
```json
{
  "hits": 42,
  "misses": 3,
  "size": 2,
  "hitRate": 0.9333
}
```

### Interné API

Cache je dostupný v Node-RED function nodes cez `global.get('getCache')()`:

```javascript
// Weather cache check
const getCache = global.get('getCache');
const cache = getCache ? getCache() : null;

if (cache) {
    const data = await cache.get('weather:current:48.1486:17.1077');
    if (data) {
        node.warn('[weather] Cache HIT');
        return data;
    }
}
```

### Redis CLI Commands

```bash
# Zobraziť všetky keys
docker exec compose-redis-1 redis-cli KEYS "*"

# Skontrolovať TTL
docker exec compose-redis-1 redis-cli TTL "weather:current:48.1486:17.1077"

# Zobraziť hodnotu
docker exec compose-redis-1 redis-cli GET "config:modes" | jq

# Flush cache (DEBUG only!)
docker exec compose-redis-1 redis-cli FLUSHALL
```

### Test Scripts

```bash
# Rýchly test - overiť cache funguje
./scripts/test_cache_quick.sh

# Plný TTL test - overenie expirácie (trvá 10+ min)
./scripts/test_cache_ttl.sh
```

### Troubleshooting

**Problem:** Cache metrics sú 0 napriek bežiacim flows

**Riešenie:**
1. Over Redis connection: `docker compose logs redis | grep "Ready to accept"`
2. Reštartuj Node-RED: `docker compose restart nodered`
3. Skontroluj logy: `docker compose logs nodered | grep Cache`

**Problem:** "this.redis.setex is not a function"

**Riešenie:** Redis v4+ používa `setEx` (capital E) namiesto `setex`. Kód už opravený.

**Problem:** Function nodes vidia cache ako `undefined`

**Riešenie:** Používaj `global.get('getCache')()` pattern namiesto `global.cache` priamo. Settings.js obsahuje lazy getters.

### Zálohovanie
```bash
# Baïkal kalendár
docker compose exec baikal tar czf /tmp/baikal-backup.tar.gz /var/www/baikal/Specific

# Node-RED flows
cp flows/nodered/flows.json flows/nodered/flows.json.backup
```

## 📊 MQTT Topics

### Monitoring (read-only)
- `room/{miestnost}/temp/measured` - Nameraná teplota
- `room/{miestnost}/temp/target` - Cieľová teplota
- `virt/mode/current` - Aktuálny režim

### Ovládanie (write)
- `virt/boost/{miestnost}/minutes` - Spustiť boost (trvanie v minútach)
- `virt/boost/{miestnost}/target_temp` - Boost cieľová teplota
- `virt/offset/{miestnost}/value` - Nastaviť offset teploty
- `internal/recalc_mode` - Prepočítať režim

**Príklady:**
```bash
# Boost - spálňa na 23°C na 90 minút
mosquitto_pub -t virt/boost/bedroom/minutes -m 90 -r
mosquitto_pub -t virt/boost/bedroom/target_temp -m 23 -r

# Offset - obývačka -1°C
mosquitto_pub -t virt/offset/living/value -m -1 -r
```

## 🛡️ Bezpečnosť

- **Nikdy necommituj `.env` súbor!** (obsahuje API kľúče)
- Zmeň defaultné heslá pre Baïkal admin
- Používaj HTTPS pre vzdialený prístup
- Firewall: Otvor len potrebné porty (1880, 8800, 8088)

## 📚 Dokumentácia

- [Mode Configuration](docs/modes-config.md)
- [Weather Correlation](docs/weather-correlation.md)
- [MQTT API](docs/mqtt-api.md)

## 🤝 Prispievanie

Pull requesty sú vítané! Pre väčšie zmeny najprv otvor issue.

## 📄 Licencia

MIT License - Voľne použiteľné pre osobné i komerčné účely.

## 👨‍💻 Autor

Luboslav Manuch - [@Dantyk](https://github.com/Dantyk)
