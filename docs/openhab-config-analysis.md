# OpenHAB Configuration Analysis

**Dátum analýzy:** 2025-11-03  
**Zdroj:** `/flows/openhab/openhab.zip` export

---

## 📋 Prehľad OpenHAB štruktúry

### 1. **Items** (Zariadenia a stavy)

#### Hlavné skupiny:
- **Home** - root skupina všetkých zariadení
- **Heater** - termostatické okruhy (Living, Kitchen, Bedroom, KidRoom1, Bedroom2)
- **Calendar** - udalosti (Sviatok, Prazdniny, Dovolenka, Leto, HomeOffice, Burst)
- **Weather** - delta teploty podľa počasia
- **Manual** - manuálne časové prepsania (boost)
- **SensorSet** - nastavená teplota na senzore
- **PlugSwitch** - ovládané zásuvky (Tasmota)
- **Battery** - úroveň batérií senzorov
- **Fire/Alarm** - bezpečnostné senzory
- **AlarmMotion** - pohybové senzory

#### Mapovanie miestností:

```
Living (obývačka):
  - Living_Temperature (Z-Wave/Zigbee sensor)
  - Living_Heating (target temp)
  - Living_Switch (plug switch)
  - Living_HeatingInit (base temp from calendar)
  - Living_HeatingWeather (weather delta)
  - Living_ManualTimer (manual override minutes)
  - Living_BoostSwitch (boost mode ON/OFF)

Kitchen (kuchyňa):
  - Kitchen_Temperature
  - Kitchen_Heating
  - Kitchen_Switch (zasuvka_kuchyna via MQTT)
  - Kitchen_HeatingInit...

Bedroom (spálňa):
  - Bedroom_Temperature
  - Bedroom_Heating
  - Bedroom_Switch (zasuvka_spalna via MQTT)
  - Bedroom_HeatingInit...

KidRoom1 (detská izba):
  - KidRoom1_Temperature
  - KidRoom1_Heating
  - KidRoom1_Switch (zasuvka_detska via MQTT)
  - KidRoom1_HeatingInit...

Bedroom2 (druhá spálňa):
  - Bedroom2_HeatingInit... (len calendar, bez sensora?)

Central (centrálny termostat):
  - Central_Temperature (hlavný senzor)
  - Central_BatteryLevel
  - Central_Stav (0=OFF, 1=ON, 2=LOW - podľa počtu aktívnych okruhov)
```

#### Špeciálne items:

```yaml
# Kalendárové udalosti
Sviatok, Sviatok1..9: Switch + String (názov sviatku)
NazovSviatku: String [MAP(sviatky.map)]
ActualEvents: String (JSON aktuálnych udalostí)
CalendarAngular: String (JSON budúcich udalostí)
DominantnaUdalost: String (Work/Sviatok/Prazdniny/Dovolenka/Leto)

# Manuálne ovládanie
BurstSwitch: Switch (zrýchlené vykurovanie po dovolenke)
StartupSwitch: Switch (obmedzenie funkcií pri štarte)
LockKey: Switch (zavrený domov, RF kľúč)
WatchDog: Switch (heartbeat pre monitoring)

# External services
TV_Power_HW: Switch (Samsung TV stav)
Minecraft: Switch (Minecraft server control)
David: Switch (systemd service control)
Camera: Switch (Motion camera control)
```

---

## 2. **Things** (Integrácie)

### MQTT Things (Tasmota zariadenia):

```yaml
# Zásuvky (Sonoff/Gosund):
zasuvka_hlavna: stat/zasuvka_hlavna/POWER
zasuvka_obyvacka: stat/zasuvka_obyvacka/POWER
zasuvka_obyvacka2: stat/zasuvka_obyvacka2/POWER
zasuvka_spalna: stat/zasuvka_spalna/POWER
zasuvka_detska: stat/zasuvka_detska/POWER
zasuvka_kuchyna: stat/zasuvka_kuchyna/POWER
zasuvka_stromcek: stat/gosund2/POWER

# Centrálny termostat (hlavný):
termostat_hlavny:
  - POWER1: Input (heating request)
  - POWER2: Output (boiler control)

# Multi-switche:
switch_kupelna: POWER1/POWER2/POWER3
switch_zachod: POWER1/POWER2

# RF/IR bridgey:
openhab/rf: RF kódy (433MHz)
tele/ir/RESULT: IR kódy

# Lampy:
lamp_spalna: POWER + Dimmer + HSBColor (Tasmota RGB)
```

### HTTP Things:

```yaml
# Externé API:
GetIP: http://icanhazip.com (public IP detection)

# WebAPI (lokálny Node.js server na porte 3000):
/api/systemd: systemd service control (Minecraft, Camera/Motion)
/api/getActualEvent?pars[]=program: aktuálne kalendárové udalosti
/api/getEvent?pars[]=program&pars[]=4: budúce udalosti (4 dni)
/api/getNextEvent?pars[]=program: najbližšia udalosť
/api/createEvent: vytvorenie udalosti v CalDAV
/api/endEvent: ukončenie udalosti
/api/endEvent2: ukončenie podľa ID

# ChatGPT integration:
chatgpt:account:1: Weather_Announcement (GPT-3.5-turbo, Eddie Murphy persona)
```

### Samsung TV:
```
samsungtv:tv:livingroom (192.168.3.23)
  - Volume, Mute, KeyCode, Channel, Power, ArtMode
```

---

## 3. **Rules** (Hlavná logika)

### `nastavenie_teploty.rules`:

**Funkcia:** Manuálne ovládanie kúrenia (boost mode s časovačom)

```
Zmena timera - rucne nastavenie:
  - Sleduje Manual.members (Living_ManualTimer, Kitchen_ManualTimer...)
  - Ak ManualTimer > 0:
    - Zapne BoostSwitch
    - Nastaví Heating na HeatingSensor hodnotu
    - Spustí odpočítavanie po minútach
    - Po vypršaní: vypne Boost, spustí ResetHeating
  - Ak ManualTimer == 0:
    - Zruší timer
    - Vypne Boost
    - Spustí ResetHeating

Nastavenie cetralneho kurenia:
  - Každých 10 minút kontroluje TermostatPlugSwitch (koľko okruhov je ON)
  - Ak Dovolenka alebo Leto: Central_Stav = 0 (OFF)
  - Ak >=3 okruhy ON (alebo >=2 + Living ON): Central_Stav = 1 (boiler ON)
  - Ak 0 okruhov: Central_Stav = 0
  - Else: Central_Stav = 2 (LOW mode)
```

### `nastavenie_udalosti.rules`:

**Funkcia:** Hlavná logika plánovania kúrenia podľa kalendára

```
Watchdog set:
  - Každé 2 minúty toggle WatchDog (monitorovanie živosti)

Change config:
  - Pri zmene DominantnaUdalost: vytvorí JSON ConfigSmartHome

Update RF:
  - Spracovanie RF kódov:
    - D507A8, D507C0: OpenDoor_AlarmMotion ON
    - 501662: LockKey OFF (odomknutie)
    - 501661: delay 45s + LockKey ON (zamknutie)
    - D45FD4: Living_FireAlarm ON

Nacitaj udalosti (každé 2 minúty):
  - HTTP GET /api/getActualEvent?pars[]=program
  - Parsuje JSON → nastaví TimeEvents (StartTime/EndTime)
  - Nastaví CalendarEvents (EventName pre každú udalosť)
  - HTTP GET /api/getActualEvent?pars[]=command
  - Spracuje Description: commands (napr. "item:Living_Heating:22.5")

Nacitaj buduce udalosti (každé 2 minúty + pri manuálnych zmenách):
  - HTTP GET /api/getEvent?pars[]=program&pars[]=4
  - HTTP GET /api/getNextEvent?pars[]=program
  - Aktualizuje CalendarAngular + CalendarNextEventAngular
  - Delay 7s → opakuje (dvojité volanie pre stabilitu)

A member of CalendarEvents changed:
  - Pri update EventName:
    - Ak NULL/UNDEF: vypne event + manual
    - Ak má hodnotu: zapne event + manual

A member of ManualCalendarEvents changed:
  - Pri manuálnej zmene (z UI):
    - Ak manual ON + EventName neexistuje: HTTP GET /api/createEvent
    - Ak manual OFF + EventName existuje: HTTP GET /api/endEvent
  - Ignoruje ak StartupSwitch ON (startup protection)

Change Time Event:
  - Pri zmene StartTime/EndTime: vypočíta Difference (trvanie v ms)

Pri zmene udalosti (HLAVNÁ LOGIKA):
  - Trigger: Calendar.members alebo SwitchEvents.members
  - Priorita udalostí:
    1. Leto → udalost = "Leto"
    2. Dovolenka → udalost = "Dovolenka"
    3. Prazdniny → udalost = "Prazdniny"
    4. Sviatok → udalost = "Sviatok"
    5. Default → udalost = "Work"
  - Nastaví DominantnaUdalost
  - Volá nastavHeatingInitPodlaUdalosti(udalost):
    - Pre každú miestnosť: lookup v config.map (napr. "Work_Living" → "Command")
    - Ak má range [HH-HH]: kontroluje aktuálny čas
    - Načíta Living_HeatingInitCommand.state → uloží do heatingInits
  - Overrides (ak nie je Leto/Dovolenka):
    - HomeOffice ON [08-15]: override na Maximum
    - TV_Power_HW ON: override Living na Maximum
    - BurstSwitch ON: override všetko na Maximum
  - Na konci: pre každý heatingInits item: sendCommand(hodnota)

Burst nastavenie po dovolenke:
  - Ak Dovolenka OFF → ON:
    - Vypočíta hours = DovolenkaDifference / 86400000
    - Max 4 hodiny
    - Zapne BurstSwitch
    - Timer na vypnutie po X hodinách

Ukoncenie/Vytvorenie udalosti v kalendari:
  - EventEnd changed: HTTP GET /api/endEvent2?pars[]=...
  - EventStart changed: HTTP GET /api/createEvent?pars[]=...
```

**Pomocná funkcia `nastavHeatingInitPodlaUdalosti`:**
```javascript
Vstup: udalost (String), heatingInits (Map)
Pre každý CalendarParameterAll.members (Living_HeatingInit...):
  - Lookup: config.map[udalost + "_" + room]
    Príklad: "Work_Living" → "Command"
    Príklad: "HomeOffice_Living" → "Maximum[08-15]"
  - Ak má range [HH-HH]:
    - Parsuje range_from, range_to
    - Kontroluje aktuálny čas (s wraparound cez polnoc)
    - Ak mimo range: ignoruje
  - Ak platí:
    - Načíta item: Living_HeatingInitCommand.state
    - Uloží do heatingInits["Living_HeatingInit"] = hodnota
```

---

## 4. **Transform** (Mapovanie konfigu)

### `config.map`:

**Definuje teplotné profily pre každú miestnosť × udalosť:**

```plaintext
# Korekcie (deprecated, v rules nevyužité):
korekcia_Living=0.0
korekcia_Kitchen=0.0
...

# Work (pracovný týždeň):
Work_Living=Command          → Living_HeatingInitCommand
Work_Kitchen=Command
Work_Bedroom=Command
Work_KidRoom1=Command
Work_Bedroom2=Command

# Sviatok/Prazdniny (víkendový režim):
Sviatok_Living=Holiday       → Living_HeatingInitHoliday
Prazdniny_Living=Holiday
...

# Leto (vypnuté kúrenie):
Leto_Living=Minimum          → Living_HeatingInitMinimum
Leto_Kitchen=Minimum
...

# Dovolenka (úsporný režim):
Dovolenka_Living=Minimum
Dovolenka_Kitchen=Minimum
...

# Špeciálne udalosti:
HomeOffice_Living=Maximum[08-15]   → Living_HeatingInitMaximum (len 8:00-15:00)
HomeOffice_Kitchen=Maximum[08-15]

Navsteva_Living=Maximum[22-06]     → Living_HeatingInitMaximum (večer do rána)

LivingUp_Living=Maximum[18-23]     → Living_HeatingInitMaximum (večer)
BedroomUp_Bedroom=Maximum[19-23]
KidRoom1Up_KidRoom1=Maximum[08-16]

Burst_Living=Maximum          → Living_HeatingInitMaximum (zrýchlené kúrenie)
Burst_Kitchen=Maximum
...

# Single/SingleDuo (deprecated, nepoužité):
Single_Living=
SingleDuo_Living=
...
```

**Logika:**
```
Udalost: "Work" → Living → "Command" → Living_HeatingInitCommand item
Udalost: "HomeOffice" + aktuálny čas 10:00 → Living → "Maximum[08-15]" → platí → Living_HeatingInitMaximum item
Udalost: "Sviatok" → Kitchen → "Holiday" → Kitchen_HeatingInitHoliday item
```

### `sviatky.map`:
```plaintext
# Mapovanie kódov sviatkov na názvy (SK holidays):
2024-01-01=Nový rok
2024-01-06=Traja králi
2024-03-29=Veľký piatok
...
```

---

## 5. **Externé závislosti**

### Node.js WebAPI Server (localhost:3000):

**Endpointy:**
```
GET /api/systemd?pars[]=<service>&pars[]=<action>
  - Ovládanie systemd služieb (minecraft-server, motion)
  - Akcie: start, stop, is-active
  - Response: {"result": "active"/"inactive"}

GET /api/getActualEvent?pars[]=program
  - Aktuálne udalosti v CalDAV kalendári "program"
  - Response: {"result": "{\"Events\":[{\"Name\":\"HomeOffice\",\"Start\":\"20251103T080000\",\"End\":\"20251103T150000\"}]}"}

GET /api/getEvent?pars[]=program&pars[]=4
  - Budúce udalosti (4 dni dopredu)
  - Response: JSON pole udalostí

GET /api/getNextEvent?pars[]=program
  - Najbližšia nasledujúca udalosť
  - Response: JSON objekt

GET /api/createEvent?pars[]=program&pars[]=<EventName>&pars[]=<description>&pars[]=<to>&pars[]=<from>
  - Vytvorenie novej udalosti v CalDAV
  - description: môže obsahovať príkazy (item:Living_Heating:22.5)
  - from/to: dátumy (voliteľné, default=now)

GET /api/endEvent?pars[]=program&pars[]=<EventName>
  - Ukončenie udalosti podľa názvu

GET /api/endEvent2?pars[]=program&pars[]=<EventID>
  - Ukončenie udalosti podľa ID
```

**Poznámka:** Tento server nie je súčasťou ZIP exportu. Pravdepodobne custom Node.js/Express aplikácia s CalDAV klientom.

### ChatGPT API:
- OpenAI API key: [REMOVED FOR SECURITY]
- Model: gpt-3.5-turbo
- System message: Eddie Murphy persona
- Použitie: Weather_Announcement (denné rady podľa počasia)

### Samsung TV API:
- Lokálna IP: 192.168.3.23
- Port: 8001
- MAC: A0:D7:F3:ED:A9:7A
- Protokol: WebSocket

---

## 6. **MQTT Topics** (Tasmota konvencie)

```yaml
# Zásuvky (Sonoff/Gosund):
stat/zasuvka_*/POWER: ON/OFF (state)
cmnd/zasuvka_*/POWER: ON/OFF (command)

# Centrálny termostat:
stat/termostat-hlavny/POWER1: heating request
cmnd/termostat-hlavny/POWER1: heating request command
stat/termostat-hlavny/POWER2: boiler output
cmnd/termostat-hlavny/POWER2: boiler output command

# RGB Lampy:
stat/lamp_spalna/POWER: ON/OFF
cmnd/lamp_spalna/POWER: ON/OFF
stat/lamp_spalna/RESULT: {"Dimmer":50,"HSBColor":"120,100,50"}
cmnd/lamp_spalna/DIMMER: 0-100
cmnd/lamp_spalna/HSBColor: "H,S,B"
tele/lamp_spalna/LWT: Online/Offline
tele/lamp_spalna/STATE: {"POWER":"ON",...}

# RF/IR:
openhab/rf: RF kódy (publish)
tele/ir/RESULT: IR kódy (subscribe)
```

**Poznámka:** Nie je retained! Všetky stavy sú len v pamäti OpenHAB.

---

## 🔄 Mapovanie na nový MQTT-first systém

### Miestnosti → MQTT topics:

```yaml
# Aktuálna teplota (Z-Wave/Zigbee sensory):
Living_Temperature → stat/hvac/living/current_temp
Kitchen_Temperature → stat/hvac/kitchen/current_temp
Bedroom_Temperature → stat/hvac/bedroom/current_temp
KidRoom1_Temperature → stat/hvac/kidroom1/current_temp

# Target teplota (vypočítaná Node-RED):
Living_Heating → virt/room/living/target_temp (retained)
Kitchen_Heating → virt/room/kitchen/target_temp (retained)
Bedroom_Heating → virt/room/bedroom/target_temp (retained)
KidRoom1_Heating → virt/room/kidroom1/target_temp (retained)

# Ovládanie radiátorov (Tasmota):
Living_Switch → cmnd/zasuvka_obyvacka/POWER
Kitchen_Switch → cmnd/zasuvka_kuchyna/POWER
Bedroom_Switch → cmnd/zasuvka_spalna/POWER
KidRoom1_Switch → cmnd/zasuvka_detska/POWER

# Manuálne ovládanie (boost):
Living_ManualTimer → virt/boost/living/minutes (retained)
Living_BoostSwitch → virt/boost/living/active (retained)

# Kalendárové teploty (base schedules):
Living_HeatingInitCommand → virt/schedule/living/base_temp_work (retained)
Living_HeatingInitHoliday → virt/schedule/living/base_temp_holiday (retained)
Living_HeatingInitMaximum → virt/schedule/living/base_temp_max (retained)
Living_HeatingInitMinimum → virt/schedule/living/base_temp_min (retained)

# Udalosti:
DominantnaUdalost → virt/mode/current (retained) - hodnoty: work/holiday/vacation/summer
ActualEvents → virt/calendar/events/current (retained, JSON)
CalendarAngular → virt/calendar/events/future (retained, JSON)

# Centrálny termostat:
Central_Stav → cmd/boiler/main/mode (0=off, 1=on, 2=low)
Central_Temperature → stat/hvac/central/current_temp

# Bezpečnosť:
Living_FireAlarm → event/safety/smoke/living/trigger (non-retained)
OpenDoor_AlarmMotion → event/security/motion/entrance/trigger (non-retained, expire 45s)
LockKey → stat/security/lock/main/state (retained)

# Špeciálne:
BurstSwitch → virt/mode/burst (retained)
StartupSwitch → virt/system/startup (retained)
WatchDog → meta/service/openhab/heartbeat (TTL 5min)
TV_Power_HW → stat/media/tv_living/power
```

---

## 🛠️ Reimplementácia v Node-RED

### **Fáza 1: Základné flow (HOTOVÉ - v bridge-architecture-summary.md)**

✅ Bridge: Z-Wave → MQTT  
✅ Bridge: Zigbee2MQTT → MQTT  
✅ Service: Holiday API  
✅ Service: Weather API  
✅ Bridge: Tasmota Thermostat  

### **Fáza 2: Kalendárová logika (NOVÉ KROKY)**

#### Flow 1: **Config Loader (modes.yaml + config.map)**

**Účel:** Nahradiť OpenHAB `config.map` a načítať režimy z `modes.yaml`

```javascript
[Inject: startup] → [File In: config/modes.yaml] → [YAML Parse]
                                                       ↓
                  [Store: global.modes] ← [Function: validate schema]
                                                       ↓
                  [MQTT Out: virt/system/config_loaded] (retained)
```

**Function node kód:**
```javascript
// Parse config.map logic into JavaScript Map
const modesConfig = msg.payload; // from YAML

// Transform to internal structure
const roomConfig = {};
const rooms = ['living', 'kitchen', 'bedroom', 'kidroom1', 'bedroom2'];
const events = ['work', 'holiday', 'vacation', 'summer', 'homeoffice', 'burst'];

rooms.forEach(room => {
  roomConfig[room] = {};
  events.forEach(event => {
    // Example: work → base_temp_work
    const tempProfile = modesConfig[event]?.[room] || 'command';
    roomConfig[room][event] = {
      profile: tempProfile, // "command", "holiday", "maximum", "minimum"
      timeRange: null // parse [HH-HH] if exists
    };
    
    // Parse time range: "maximum[08-15]" → {profile: "maximum", timeRange: [8, 15]}
    const match = tempProfile.match(/(\w+)\[(\d+)-(\d+)\]/);
    if (match) {
      roomConfig[room][event].profile = match[1];
      roomConfig[room][event].timeRange = [parseInt(match[2]), parseInt(match[3])];
    }
  });
});

global.set('roomConfig', roomConfig);
msg.payload = { loaded: true, timestamp: Date.now() };
return msg;
```

**Schema `config/modes.yaml` (príklad):**
```yaml
work:
  living: command
  kitchen: command
  bedroom: command
  kidroom1: command
  bedroom2: command

holiday:
  living: holiday
  kitchen: holiday
  bedroom: holiday
  kidroom1: holiday
  bedroom2: holiday

summer:
  living: minimum
  kitchen: minimum
  bedroom: minimum
  kidroom1: minimum
  bedroom2: minimum

vacation:
  living: minimum
  kitchen: minimum
  bedroom: minimum
  kidroom1: minimum
  bedroom2: minimum

homeoffice:
  living: maximum[08-15]
  kitchen: maximum[08-15]
  bedroom: maximum[08-15]
  kidroom1: maximum[08-15]

burst:
  living: maximum
  kitchen: maximum
  bedroom: maximum
  kidroom1: maximum
  bedroom2: maximum

# TV trigger (TV_Power_HW ON)
living_up:
  living: maximum[18-23]

bedroom_up:
  bedroom: maximum[19-23]

kidroom1_up:
  kidroom1: maximum[08-16]
```

#### Flow 2: **CalDAV Events Poller**

**Účel:** Nahradiť OpenHAB HTTP GET /api/getActualEvent

```javascript
[Cron: every 2min] → [HTTP Request: Baikal CalDAV] → [Parse iCal]
                                                           ↓
      [Function: extract active events] → [MQTT Out: virt/calendar/events/current] (retained)
                                                           ↓
      [Function: extract future events] → [MQTT Out: virt/calendar/events/future] (retained)
```

**HTTP Request node:**
```
Method: REPORT
URL: ${BAIKAL_BASE_URL}/calendars/${BAIKAL_USER}/events/
Headers:
  Authorization: Basic ${base64(BAIKAL_USER:BAIKAL_PASS)}
  Content-Type: application/xml; charset=utf-8
  Depth: 1
Body:
<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${now.toISOString()}" end="${now + 7days}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>
```

**Function node: Parse iCal**
```javascript
const ical = require('ical');
const now = new Date();

const events = [];
const lines = msg.payload.split('\n');
lines.forEach(line => {
  if (line.includes('BEGIN:VCALENDAR')) {
    // Parse iCal event
    const parsed = ical.parseICS(msg.payload);
    for (let k in parsed) {
      const ev = parsed[k];
      if (ev.type === 'VEVENT') {
        const start = new Date(ev.start);
        const end = new Date(ev.end);
        
        // Check if active now
        const active = now >= start && now <= end;
        
        events.push({
          uid: ev.uid,
          summary: ev.summary, // "HomeOffice", "Dovolenka", etc.
          description: ev.description, // commands: "item:Living_Heating:22.5"
          start: start.toISOString(),
          end: end.toISOString(),
          active: active
        });
      }
    }
  }
});

// Filter active events
const activeEvents = events.filter(e => e.active);
global.set('calendarEvents', events);
global.set('activeEvents', activeEvents);

msg.payload = {
  current: activeEvents,
  future: events.filter(e => !e.active).slice(0, 4),
  timestamp: Date.now()
};
return msg;
```

**NPM package requirement:**
```json
{
  "dependencies": {
    "ical": "^0.8.0"
  }
}
```

#### Flow 3: **Dominant Event Calculator**

**Účel:** Nahradiť OpenHAB rule "Pri zmene udalosti"

```javascript
[MQTT In: virt/calendar/events/current] →
[MQTT In: stat/security/lock/main/state] →
[MQTT In: stat/media/tv_living/power] →
[MQTT In: virt/mode/burst] →
  ↓
[Function: calculate priority] → [MQTT Out: virt/mode/current] (retained)
                                        ↓
                            [Function: update room temps] → [MQTT Out: virt/room/*/target_temp] (retained)
```

**Function node: Calculate priority**
```javascript
// Priority logic (same as OpenHAB rules)
const activeEvents = global.get('activeEvents') || [];
const burst = msg.payload.burst || false;
const lockKey = msg.payload.lockKey || false;
const tvPower = msg.payload.tvPower || false;

let dominantEvent = 'work'; // default

// Priority 1: Summer mode (leto)
if (activeEvents.find(e => e.summary === 'Leto')) {
  dominantEvent = 'summer';
}
// Priority 2: Vacation (dovolenka)
else if (activeEvents.find(e => e.summary === 'Dovolenka')) {
  dominantEvent = 'vacation';
}
// Priority 3: School holidays (prazdniny)
else if (activeEvents.find(e => e.summary === 'Prazdniny')) {
  dominantEvent = 'holiday';
}
// Priority 4: Public holiday (sviatok)
else if (global.get('holidayToday')) {
  dominantEvent = 'holiday';
}
// Priority 5: Work day (default)
else {
  dominantEvent = 'work';
}

// Overrides (if not summer/vacation):
const overrides = [];
if (dominantEvent !== 'summer' && dominantEvent !== 'vacation') {
  // HomeOffice event [08-15]
  const homeOffice = activeEvents.find(e => e.summary === 'HomeOffice');
  if (homeOffice) {
    const hour = new Date().getHours();
    if (hour >= 8 && hour < 15) {
      overrides.push('homeoffice');
    }
  }
  
  // TV Power ON → living_up [18-23]
  if (tvPower) {
    const hour = new Date().getHours();
    if (hour >= 18 && hour < 23) {
      overrides.push('living_up');
    }
  }
  
  // Burst mode (po dovolenke)
  if (burst) {
    overrides.push('burst');
  }
}

global.set('dominantEvent', dominantEvent);
global.set('overrides', overrides);

msg.payload = {
  current: dominantEvent,
  overrides: overrides,
  timestamp: Date.now()
};
return msg;
```

**Function node: Update room temps**
```javascript
const roomConfig = global.get('roomConfig');
const dominantEvent = global.get('dominantEvent');
const overrides = global.get('overrides') || [];
const modes = global.get('modes'); // from modes.yaml

const rooms = ['living', 'kitchen', 'bedroom', 'kidroom1', 'bedroom2'];
const messages = [];

rooms.forEach(room => {
  let profile = roomConfig[room][dominantEvent]?.profile || 'command';
  let timeRange = roomConfig[room][dominantEvent]?.timeRange;
  
  // Apply overrides (in order)
  overrides.forEach(override => {
    if (roomConfig[room][override]) {
      const overrideProfile = roomConfig[room][override].profile;
      const overrideTimeRange = roomConfig[room][override].timeRange;
      
      // Check time range
      if (overrideTimeRange) {
        const hour = new Date().getHours();
        const [from, to] = overrideTimeRange;
        let inRange = false;
        if (to < from) { // wraparound midnight
          inRange = hour >= from || hour < to;
        } else {
          inRange = hour >= from && hour < to;
        }
        if (!inRange) return; // skip this override
      }
      
      profile = overrideProfile;
      timeRange = overrideTimeRange;
    }
  });
  
  // Lookup temperature value from modes.yaml
  // profile: "command" → modes.schedule.work.rooms.living
  // profile: "holiday" → modes.schedule.weekend.rooms.living
  // profile: "maximum" → modes.boost.max
  // profile: "minimum" → modes.boost.min
  
  let targetTemp = 20; // default fallback
  
  if (profile === 'command') {
    targetTemp = modes?.schedule?.work?.rooms?.[room] || 20;
  } else if (profile === 'holiday') {
    targetTemp = modes?.schedule?.weekend?.rooms?.[room] || 20;
  } else if (profile === 'maximum') {
    targetTemp = modes?.boost?.max || 24;
  } else if (profile === 'minimum') {
    targetTemp = modes?.boost?.min || 16;
  }
  
  // Publish to MQTT
  messages.push({
    topic: `virt/room/${room}/target_temp`,
    payload: targetTemp,
    retain: true
  });
  
  // Store in context
  flow.set(`room_${room}_target`, targetTemp);
});

return [messages];
```

#### Flow 4: **Manual Boost Controller**

**Účel:** Nahradiť OpenHAB rule "Zmena timera - rucne nastavenie"

```javascript
[MQTT In: virt/boost/*/minutes] →
  ↓
[Function: start countdown] → [Delay: 1min loop] → [Function: decrement]
                                                          ↓
                              [Switch: minutes > 0] → [Loop back] or [MQTT Out: virt/boost/*/active OFF]
                                                          ↓
                              [MQTT Out: virt/room/*/target_temp] (override temp during boost)
```

**Function node: Start countdown**
```javascript
const room = msg.topic.split('/')[2]; // virt/boost/living/minutes → living
const minutes = parseInt(msg.payload);

if (minutes > 0) {
  // Start boost mode
  flow.set(`boost_${room}_minutes`, minutes);
  flow.set(`boost_${room}_active`, true);
  
  // Publish boost active
  node.send([
    { topic: `virt/boost/${room}/active`, payload: true, retain: true },
    { topic: `virt/boost/${room}/minutes`, payload: minutes, retain: true }
  ]);
  
  // Override target temp to sensor value
  const sensorTemp = flow.get(`room_${room}_sensor_temp`) || 22;
  node.send({
    topic: `virt/room/${room}/target_temp`,
    payload: sensorTemp,
    retain: true
  });
  
} else {
  // Stop boost mode
  flow.set(`boost_${room}_minutes`, 0);
  flow.set(`boost_${room}_active`, false);
  
  // Publish boost inactive
  node.send([
    { topic: `virt/boost/${room}/active`, payload: false, retain: true },
    { topic: `virt/boost/${room}/minutes`, payload: 0, retain: true }
  ]);
  
  // Trigger recalculation of target temp
  node.send({ topic: 'internal/recalc_temps', payload: { room: room } });
}

return msg;
```

**Function node: Decrement (in delay loop)**
```javascript
const rooms = ['living', 'kitchen', 'bedroom', 'kidroom1'];
const messages = [];

rooms.forEach(room => {
  const minutes = flow.get(`boost_${room}_minutes`) || 0;
  if (minutes > 0) {
    const newMinutes = minutes - 1;
    flow.set(`boost_${room}_minutes`, newMinutes);
    
    messages.push({
      topic: `virt/boost/${room}/minutes`,
      payload: newMinutes,
      retain: true
    });
    
    if (newMinutes === 0) {
      // Boost expired
      flow.set(`boost_${room}_active`, false);
      messages.push({
        topic: `virt/boost/${room}/active`,
        payload: false,
        retain: true
      });
      messages.push({
        topic: 'internal/recalc_temps',
        payload: { room: room }
      });
    }
  }
});

return [messages];
```

#### Flow 5: **Central Boiler Controller**

**Účel:** Nahradiť OpenHAB rule "Nastavenie cetralneho kurenia"

```javascript
[Cron: every 10min] →
[MQTT In: stat/hvac/*/plug_state] (all rooms) →
  ↓
[Function: count active plugs] → [MQTT Out: cmd/boiler/main/mode]
                                        ↓
                              [Function: set Tasmota vars] → [MQTT Out: cmnd/termostat-hlavny/var1]
                                                                      [MQTT Out: cmnd/termostat-hlavny/var2]
```

**Function node: Count active plugs**
```javascript
const plugStates = {
  living: msg.payload.living || false,
  kitchen: msg.payload.kitchen || false,
  bedroom: msg.payload.bedroom || false,
  kidroom1: msg.payload.kidroom1 || false
};

const activeCount = Object.values(plugStates).filter(v => v === true).length;
const dominantEvent = global.get('dominantEvent');

let boilerMode = 0; // 0=off, 1=on, 2=low

if (dominantEvent === 'vacation' || dominantEvent === 'summer') {
  boilerMode = 0;
} else {
  if (activeCount >= 3 || (plugStates.living && activeCount >= 2)) {
    boilerMode = 1; // full power
  } else if (activeCount === 0) {
    boilerMode = 0; // off
  } else {
    boilerMode = 2; // low power
  }
}

msg.payload = boilerMode;
msg.topic = 'cmd/boiler/main/mode';
msg.retain = true;

// Also send to Tasmota central thermostat (existing MQTT bridge)
// var1 = heating_request (from plugs aggregation)
// var2 = boiler_mode (0/1/2)
const heatingRequest = activeCount > 0 ? 1 : 0;

return [
  msg,
  { topic: 'cmnd/termostat-hlavny/var1', payload: heatingRequest },
  { topic: 'cmnd/termostat-hlavny/var2', payload: boilerMode }
];
```

#### Flow 6: **Event Commands Executor**

**Účel:** Nahradiť OpenHAB command execution z CalDAV Description

```javascript
[MQTT In: virt/calendar/events/current] →
  ↓
[Function: parse descriptions] → [Switch: by command type]
                                        ↓
              [item:*] → [MQTT Out: topic from item name]
              [boost:*] → [MQTT Out: virt/boost/*/minutes]
              [mode:*] → [Function: create manual event]
```

**Function node: Parse descriptions**
```javascript
const events = msg.payload.current || [];
const commands = [];

events.forEach(event => {
  if (event.description) {
    const lines = event.description.split('\n');
    lines.forEach(line => {
      if (line.includes(':')) {
        const parts = line.split(':');
        const cmdType = parts[0]; // "item", "boost", "mode"
        const target = parts[1];  // "Living_Heating", "living"
        const value = parts[2];   // "22.5", "60"
        
        commands.push({
          type: cmdType,
          target: target,
          value: value,
          eventUid: event.uid
        });
      }
    });
  }
});

msg.payload = commands;
return msg;
```

**Switch node logic:**
```javascript
// Example commands:
// "item:Living_Heating:22.5" → MQTT: virt/room/living/target_temp = 22.5
// "boost:living:60" → MQTT: virt/boost/living/minutes = 60
// "mode:homeoffice" → Create manual event "HomeOffice"

if (cmd.type === 'item') {
  // Map OpenHAB item names to MQTT topics
  const itemMap = {
    'Living_Heating': 'virt/room/living/target_temp',
    'Kitchen_Heating': 'virt/room/kitchen/target_temp',
    'Bedroom_Heating': 'virt/room/bedroom/target_temp',
    'KidRoom1_Heating': 'virt/room/kidroom1/target_temp'
  };
  
  const topic = itemMap[cmd.target];
  if (topic) {
    return {
      topic: topic,
      payload: parseFloat(cmd.value),
      retain: true
    };
  }
}

if (cmd.type === 'boost') {
  return {
    topic: `virt/boost/${cmd.target}/minutes`,
    payload: parseInt(cmd.value),
    retain: true
  };
}

if (cmd.type === 'mode') {
  // Create manual calendar event
  return {
    topic: 'internal/create_event',
    payload: {
      summary: cmd.target,
      start: new Date(),
      end: new Date(Date.now() + 4 * 3600000), // 4 hours
      description: ''
    }
  };
}
```

### **Fáza 3: Watchdog & Monitoring (NOVÉ KROKY)**

#### Flow 7: **Watchdog Heartbeat**

```javascript
[Cron: every 2min] → [Function: toggle state] → [MQTT Out: meta/service/nodered/heartbeat] (TTL 5min)
```

#### Flow 8: **RF Code Handler**

**Účel:** Nahradiť OpenHAB rule "Update RF"

```javascript
[MQTT In: openhab/rf] →
  ↓
[Switch: by RF code] →
  D507A8, D507C0 → [MQTT Out: event/security/motion/entrance/trigger] (non-retained, expire 45s)
  501662 → [MQTT Out: stat/security/lock/main/state = false] (retained)
  501661 → [Delay: 45s] → [MQTT Out: stat/security/lock/main/state = true] (retained)
  D45FD4 → [MQTT Out: event/safety/smoke/living/trigger] (non-retained)
```

#### Flow 9: **Burst After Vacation**

**Účel:** Nahradiť OpenHAB rule "Burst nastavenie po dovolenke"

```javascript
[MQTT In: virt/calendar/events/current] →
  ↓
[Function: detect vacation end] → [Switch: hours > 4] → [Timer: 4 hours] → [MQTT Out: virt/mode/burst OFF]
                                                              ↓
                                      [MQTT Out: virt/mode/burst ON]
```

### **Fáza 4: Appsmith UI Endpoints (NOVÉ KROKY)**

#### HTTP IN endpoints v Node-RED:

```javascript
GET /api/rooms
  → Response: { rooms: [ 
      {name: 'living', current_temp: 21.5, target_temp: 22, heating: true, boost: false}, 
      ...
    ]}

GET /api/modes
  → Response: { current: 'work', overrides: ['homeoffice'], available: ['work','holiday','vacation','summer'] }

POST /api/boost
  Body: {room: 'living', minutes: 60}
  → Sets virt/boost/living/minutes

GET /api/events
  → Response: { current: [...], future: [...] }

POST /api/event
  Body: {summary: 'HomeOffice', start: '2025-11-03T08:00', end: '2025-11-03T15:00'}
  → Creates CalDAV event

DELETE /api/event/:uid
  → Ends CalDAV event
```

---

## 📊 Zhrnutie reimplementácie

### Hotové (z bridge-architecture-summary.md):
1. ✅ Z-Wave → MQTT mapping
2. ✅ Zigbee2MQTT → MQTT mapping
3. ✅ Holiday API integration
4. ✅ Weather API integration
5. ✅ Tasmota Thermostat bridge

### Nové kroky (z tejto analýzy):
6. **Config Loader** - načítanie `modes.yaml` + `config.map` logika
7. **CalDAV Events Poller** - polling Baikal kalendára (každé 2min)
8. **Dominant Event Calculator** - prioritná logika udalostí + overrides
9. **Manual Boost Controller** - časovač boost režimu
10. **Central Boiler Controller** - agregácia plug states → boiler mode
11. **Event Commands Executor** - spracovanie commands z CalDAV Description
12. **Watchdog Heartbeat** - monitorovanie živosti Node-RED
13. **RF Code Handler** - spracovanie 433MHz RF kódov
14. **Burst After Vacation** - automatický burst po dovolenke
15. **Appsmith API Endpoints** - REST API pre Appsmith UI

### Deprecated (netreba reimplementovať):
- ❌ OpenHAB WebSocket items (nahradené MQTT retained)
- ❌ ChatGPT Weather Announcement (optional, expired API key)
- ❌ Samsung TV control (optional, lokálna IP dependency)
- ❌ systemd service control (Minecraft/Camera - optional)
- ❌ Single/SingleDuo events (unused v config.map)
- ❌ korekcia_* (temperature corrections - unused v rules)

### Celkový počet flow na pridanie:
**15 nových flow** (9 hlavných + 6 pomocných)

### Estimated LOC (Lines of Code):
- **Config Loader:** ~100 lines
- **CalDAV Poller:** ~150 lines
- **Dominant Event Calculator:** ~200 lines
- **Manual Boost:** ~80 lines
- **Central Boiler:** ~60 lines
- **Event Commands:** ~100 lines
- **Watchdog:** ~20 lines
- **RF Handler:** ~40 lines
- **Burst After Vacation:** ~50 lines
- **Appsmith Endpoints:** ~200 lines

**Celkom: ~1000 lines JavaScript kódu v Node-RED Function nodes**

---

## 🔧 Ďalšie akcie

1. ✅ Vytvoriť `config/modes.yaml` schema (podobný `config.map`)
2. ⏭️ Implementovať Flow 1-6 (kalendárová logika)
3. ⏭️ Implementovať Flow 7-9 (watchdog, RF, burst)
4. ⏭️ Implementovať HTTP endpoints pre Appsmith
5. ⏭️ Migrovať existujúce retained MQTT topics z OpenHAB
6. ⏭️ Testovať CalDAV synchronizáciu s Baikal
7. ⏭️ Validovať boost mode behavior
8. ⏭️ Deploy do production (docker compose up)

---

## 📝 Poznámky

### Kľúčové rozdiely oproti OpenHAB:
- **Retained MQTT topics** namiesto in-memory OpenHAB items
- **Node-RED JavaScript** namiesto OpenHAB Rules DSL
- **YAML config** namiesto `.map` súborov
- **Direct CalDAV access** namiesto custom WebAPI servera (localhost:3000)
- **Stateless restarts** (vďaka retained topics)
- **No single point of failure** (OpenHAB bol SPOF)

### Bezpečnostné riziká z OpenHAB:
- ❌ Hard-coded IP adresy (192.168.3.23 Samsung TV)
- ❌ Exposed API key (ChatGPT - už invalid)
- ❌ No authentication on WebAPI (localhost:3000)
- ❌ RF codes in plaintext (D507A8 = open door trigger)

### Odporúčania:
1. Použiť **MQTT authentication** (mosquitto users)
2. Šifrovať RF kódy v **environment variables**
3. Implementovať **rate limiting** na HTTP endpoints
4. Používať **HTTPS** pre CalDAV (aj lokálne)
5. Pravidelne **rotovať API keys**

---

**Koniec analýzy**
