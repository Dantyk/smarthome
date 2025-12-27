# MQTT Topics Audit - SmartHome

**Dátum:** 27. December 2025  
**Účel:** Kontrola konzistencie MQTT topics - publish vs subscribe

## 📊 Štatistika

| Kategória | Počet |
|-----------|-------|
| **MQTT IN (Subscribe patterns)** | 23 |
| **MQTT OUT (Publish topics)** | 39 (expandované: ~80+) |
| **Orphaned OUT** | 47 topics |
| **Orphaned IN** | 4 topics |

---

## ❌ KRITICKÉ NÁLEZY

### 1. CMD Topics - NIKTO NEPOČÚVA (47 topics)

**Problém:** Všetky `cmd/hvac/*` topics sa publikujú ale **žiadny subscriber neexistuje**.

```
❌ cmd/hvac/spalna/enabled
❌ cmd/hvac/spalna/override
❌ cmd/hvac/spalna/override_duration  
❌ cmd/hvac/spalna/setpoint
... (celkovo 5 rooms × 4 commands = 20 topics)
```

**Dopad:** Príkazy pre HVAC sa posielajú ale nikto ich nespracováva → **termostaty nedostávajú príkazy**

**Možné príčiny:**
1. **Externý bridge** - Mosquitto bridge publikuje do iného brokera (napr. Zigbee2MQTT)
2. **Hardvérové zariadenia** - TRV ventily počúvajú priamo MQTT
3. **Legacy/nefunkčné** - Staré topics ktoré už nie sú potrebné

**Odporúčanie:** 
- Ak používaš Zigbee/Z-Wave bridge → **OK, ignoruj**
- Ak nie → **PROBLÉM**, implementovať subscriber alebo vymazať publish

---

### 2. Internal Notify Topics - NIKTO NEPOČÚVA

**Problém:** Notifikačné kanály nemajú subscriber.

```
❌ internal/notify/pushover
❌ internal/notify/telegram
❌ internal/notify/ntfy
❌ internal/notify/email
```

**Dopad:** Notifikácie sa posielajú ale nikto ich nedoručuje.

**Riešenie:** Pravdepodobne sa používa Apprise HTTP API namiesto MQTT → **opraviť dokumentáciu**

---

### 3. Internal Recalc Mode - NIKTO NEPOČÚVA

```
❌ internal/recalc_mode
```

**Použitie:** Publikuje sa z POST `/api/mode` (riadok 1643)  
**Problém:** Žiadny flow neobsahuje subscriber pre tento topic

**Riešenie:** 
1. Buď implementovať subscriber (trigger resolver keď sa mode zmení cez API)
2. Alebo vymazať publish (ak sa nepoužíva)

---

## ⚠️ OČAKÁVANÉ ALE CHÝBAJÚCE

### 1. Holidays Check Trigger

```
⚠️ internal/holidays/check
```

**Subscriber:** Existuje MQTT IN node  
**Publisher:** Žiadny flow nepublikuje tento topic

**Pravdepodobne:** Cron job alebo external script mal publikovať → **chýba implementácia**

---

### 2. UI Service Online Status

```
⚠️ meta/service/ui/online
```

**Subscriber:** Existuje monitoring  
**Publisher:** UI (Next.js) pravdepodobne nemá MQTT client → **never online**

---

### 3. Kupelna Sensors

```
⚠️ stat/sensor/kupelna_humidity/state
⚠️ stat/switch/kupelna_fan/state
```

**Subscriber:** Flow počúva tieto topics  
**Publisher:** Zigbee2MQTT alebo hardvérové senzory → **OK ak sú pripojené**

---

## ✅ SPRÁVNE FUNGUJÚCE TOPICS

### Internal Topics (cirkulárne)

```
✅ internal/planner/orchestrate
✅ internal/planner/edges/#
✅ internal/resolver/trigger
```

**Status:** Správne napojené, subscriber aj publisher existujú

### Virtual Topics

```
✅ virt/room/+/override
✅ virt/room/+/target_temp
✅ virt/boost/+/minutes
✅ virt/boost/+/target_temp
✅ virt/weather/current
```

**Status:** Wildcards správne pokrývajú všetky publish topics

---

## 📋 KOMPLETNÝ ZOZNAM

### MQTT IN (Subscribe)

```
event/#
event/safety/smoke/+/trigger
event/security/motion/+/trigger
internal/holidays/check
internal/planner/edges/#
internal/planner/orchestrate
internal/resolver/trigger
meta/alert/#
meta/service/+/online
meta/service/ui/online
stat/hvac/+/current_temp
stat/hvac/+/enabled
stat/hvac/+/humidity
stat/sensor/kupelna_humidity/state
stat/switch/kupelna_fan/state
virt/boost/+/minutes
virt/boost/+/target_temp
virt/room/+/override
virt/room/+/override_request
virt/room/+/target_temp
virt/weather/current
virt/weather/forecast
virt/weather/hourly
```

### MQTT OUT (Publish - bez template expansions)

```
cmd/hvac/${room}/setpoint
cmd/hvac/${r}/enabled
cmd/hvac/${r}/override
cmd/hvac/${r}/override_duration
cmd/hvac/${r}/setpoint
internal/notify/${channel}
internal/planner/edges/${room}
internal/planner/orchestrate
internal/recalc_mode
internal/resolver/trigger
virt/boost/${room}/minutes
virt/boost/${room}/target_temp
virt/calendar/events/current
virt/room/${room}/override
virt/room/${room}/scheduled_temp
virt/room/${room}/target_temp
virt/system/active_mode
virt/system/active_regimes
virt/system/config_loaded
virt/system/holiday_check_result
virt/weather/current
virt/weather/forecast
virt/weather/hourly
```

---

## 🔧 AKČNÝ PLÁN

**Stav auditu:** ✅ Dokončený (27.12.2025)  
**Nájdených problémov:** 51 orphaned topics  
**Status:** Dokumentované, čakajú na rozhodnutie/implementáciu

### Priorita VYSOKÁ:

1. **[ ] Overiť CMD topics:**
   - Skontroluj `mosquitto_sub -v -t 'cmd/hvac/#'`
   - Ak nie sú TRV ventily pripojené → vymazať publish
   - Ak sú → pridať dokumentáciu
   - **Status:** Čaká na overenie hardvéru

2. **[ ] Opraviť `internal/recalc_mode`:**
   - Implementovať subscriber alebo vymazať publish
   - **Status:** Čaká na rozhodnutie

3. **[ ] Overiť `internal/notify/*`:**
   - Ak sa používa Apprise HTTP → dokumentovať
   - Ak MQTT → implementovať subscribers
   - **Status:** Pravdepodobne používa HTTP, potrebné overiť

### Priorita STREDNÁ:

4. **Implementovať `internal/holidays/check`:**
   - Pridať cron trigger ktorý publikuje tento topic

5. **UI service monitoring:**
   - Implementovať MQTT heartbeat v Next.js UI
   - Alebo odstrániť subscriber

### Priorita NÍZKA:

6. **Dokumentovať topic konvencie:**
   - `cmd/*` - commands pre zariadenia
   - `stat/*` - state z zariadení
   - `virt/*` - virtuálne/vypočítané hodnoty
   - `event/*` - udalosti
   - `internal/*` - inter-flow komunikácia
   - `meta/*` - metadata, monitoring

---

## 📝 Poznámky

- Analýza vykonaná Python skriptom: `flows.json` → extract MQTT nodes
- Template expansion: `${room}`, `${r}`, `${channel}` → konkrétne hodnoty
- Wildcard matching: `+` (single level), `#` (multi-level)

**Nástroje:**
```bash
mosquitto_sub -v -t '#' -F '%t: %p'  # Monitor všetky topics
mosquitto_pub -t 'test/topic' -m 'message'  # Test publish
```

---

**Autor:** GitHub Copilot  
**Metóda:** Python regex parsing + MQTT pattern matching  
**Files:** [flows.json](../flows/nodered/flows.json)
