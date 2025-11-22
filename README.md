# SmartHome - Inteligentný Systém Riadenia Vykurovania

Automatizovaný systém pre domáce vykurovanie s pokročilou reguláciou teploty, režimami a kalendárovým ovládaním.

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
   - **Zigbee2MQTT**: `http://localhost:8080` (ak zapnutý profil `zigbee`)
   - **Grafana**: `http://localhost:3000` (ak zapnutý profil `metrics`)
   - **InfluxDB**: `http://localhost:8086` (ak zapnutý profil `metrics`)

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

### Automatické logovanie senzorov do InfluxDB

Node-RED môže automaticky zapisovať všetky senzorové hodnoty do InfluxDB.

**Príklad flow (pridaj do Node-RED):**

1. **MQTT Input** → `stat/hvac/+/current_temp`
2. **Function node** - Formátovanie pre InfluxDB:
```javascript
const room = msg.topic.split('/')[2];
return {
    payload: {
        measurement: 'temperature',
        fields: {
            value: parseFloat(msg.payload)
        },
        tags: {
            room: room,
            sensor: 'hvac'
        },
        timestamp: new Date()
    }
};
```
3. **InfluxDB Out** node:
   - Server: `http://influxdb:8086`
   - Token: z `.env` súboru (`INFLUXDB_TOKEN`)
   - Organization: `smarthome`
   - Bucket: `sensors`

### Grafana Dashboards

Po zapnutí `metrics` profilu:

1. Otvor Grafana: `http://localhost:3000` (admin/smarthome)
2. **Add Data Source**:
   - Type: InfluxDB
   - URL: `http://influxdb:8086`
   - Organization: `smarthome`
   - Token: `${INFLUXDB_TOKEN}` z `.env`
   - Default bucket: `sensors`
3. **Import Dashboard** alebo vytvor vlastný:
   - Teploty po miestnostiach (line chart)
   - Vlhkosť (gauge)
   - Weather correlation offset (area chart)

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

David Komanuch - [@Dantyk](https://github.com/Dantyk)
