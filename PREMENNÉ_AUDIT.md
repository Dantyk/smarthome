# Audit Premenných - SmartHome

**Dátum:** 27. December 2025  
**Účel:** Revízia použitých vs. definovaných premenných v projekte

## 1. Environment Premenné (docker-compose.yml)

### ❌ CHÝBAJÚCE / NEDEFINOVANÉ

Tieto premenné sú referované v `docker-compose.yml` ale **nie sú definované** v `.env` súbore:

| Premenná | Použitie | Status |
|----------|----------|--------|
| `${GOOGLE_CLIENT_SECRET}` | → `GOOGLE_CALENDAR_API_KEY` | ❌ Nedefinované |
| `${GOOGLE_CLIENT_ID}` | → `GOOGLE_CALENDAR_ID` | ❌ Nedefinované |
| `${OPENWEATHER_API_KEY}` | → `OPENWEATHER_API_KEY` | ❌ Nedefinované |
| `${PUSHOVER_USER}` | → `PUSHOVER_USER` | ❌ Nedefinované |
| `${PUSHOVER_TOKEN}` | → `PUSHOVER_TOKEN` | ❌ Nedefinované |
| `${MQTT_USER}` | → `MQTT_USER` (default: nodered) | ⚠️ Fallback definovaný |
| `${MQTT_PASSWORD}` | → `MQTT_PASSWORD` (default: prázdne) | ⚠️ Fallback definovaný |

**Riešenie:**
- Vytvoriť `.env` súbor v `compose/` adresári s týmito premennými
- Alebo zmeniť v `docker-compose.yml` na hardcoded hodnoty s poznámkou

### ✅ CHÝBAJÚCE ale KRITICKÉ

| Premenná | Použitie | Status |
|----------|----------|--------|
| `NR_CRED_SECRET` | Node-RED credentials encryption | ❌ **KRITICKÉ** |

**Dopad:** Bez tejto premennej Node-RED nemôže dešifrovať `flows_cred.json`  
**Fix:** Pridať do `docker-compose.yml` → `environment:` sekcie nodered služby

---

## 2. Node-RED Flow/Global Premenné

### ❌ NEKONZISTENTNÉ POUŽITIE

#### A) `flow.get('current_mode')` vs `global.get('activeMode')`

**Problém:** API `/api/mode` (riadok 1607) používa `flow.get('current_mode')`, ktorý **nikdy nie je nastavený**.

```javascript
// flows.json:1607 - api_mode_get_handler
msg.payload = {
    current: flow.get('current_mode') || 'work',  // ❌ Nikdy nie je nastavený!
    overrides: flow.get('current_overrides') || [],
    ...
}
```

**Riešenie:**
- Resolver (riadok 675) nastavuje `global.set('activeMode', dominantRegime)`
- API by malo používať `global.get('activeMode')` alebo vypočítať z `global.get('activeRegimesByRoom')`
- **Už opravené v `/api/status`**, ale `/api/mode` stále používa starý kód

#### B) `global.get('modes')` vs `global.get('modesCfg')`

**Pozorované použitie:**
- `global.get('modes')` - používané v starých alert flow (riadok 402, 1031, 1571)
- `global.get('modesCfg')` - používané v moderných flow (riadok 438, 675, 817)

**Status:** ⚠️ Nejasné, ktorá premenná je aktuálna. Pravdepodobne `modes` je legacy.

#### C) `flow.get('current_overrides')` 

**Použitie:** Riadky 1571, 1607  
**Status:** ❌ **NIKDY NENASTAVENÉ** - Premenná sa nikde nenastavuje cez `flow.set()`  
**Riešenie:** Buď implementovať nastavovanie, alebo odstrániť z API response

#### D) `flow.get('lock_main_state')`

**Použitie:** Riadok 1031 (security alerts)  
**Status:** ❌ **NIKDY NENASTAVENÉ** - Premenná sa nikde nenastavuje  
**Riešenie:** Implementovať flow pre lock_main_state alebo odstrániť kontrolu

#### E) `flow.get('service_mosquitto_online')` / `flow.get('service_baikal_online')`

**Použitie:** Riadok 1571 (API status)  
**Status:** ❌ **NIKDY NENASTAVENÉ** - Služby sa nemonitorujú  
**Riešenie:** Implementovať healthcheck flow alebo vrátiť `null` namiesto `false`

### ✅ SPRÁVNE POUŽITÉ

- `global.get('modesCfg')` - načítané z modes.yaml
- `global.get('activeRegimesByRoom')` - nastavené resolverom
- `global.get('weatherCurrent')` / `global.get('weather_forecast')` - používané v API
- `global.get('calendarEvents')` - používané všade konzistentne
- `global.get('alertHistory')` - používané konzistentne
- `flow.get('service_mosquitto_online')` / `flow.get('service_baikal_online')` - používané v status API

### ⚠️ BOOST PREMENNÉ (flow vs global)

**Pozorované:**
- `global.get('boost_${room}_active')` - riadok 817, 895
- `global.get('boost_${room}_target_temp')` - riadok 895
- `flow.get('boost_${room}_active')` - riadok 402, 1571

**Problém:** BOOST používa **BOTH** `flow` aj `global` context!  
**Riešenie:** Štandardizovať na jednu variantu (odporúčam `global` pre perzistenciu)

---

## 3. MQTT Topics

### ❌ KRITICKÉ PROBLÉMY

**Detailný report:** [docs/MQTT_TOPICS_AUDIT.md](docs/MQTT_TOPICS_AUDIT.md)

#### A) CMD Topics - 47 orphaned publishes

**Problém:** Všetky `cmd/hvac/*` topics (enable, override, override_duration, setpoint) sa publikujú ale **žiadny Node-RED flow ich nepočúva**.

**Možné príčiny:**
1. Externý Mosquitto bridge publikuje do Zigbee2MQTT/Z-Wave
2. Hardvérové TRV ventily počúvajú priamo MQTT
3. Legacy topics ktoré už nie sú potrebné

**Riešenie:** Skontrolovať `mosquitto_sub -t 'cmd/hvac/#'` - ak nie sú zariadenia → vymazať

#### B) Internal Notify Topics - 4 orphaned

```
❌ internal/notify/pushover
❌ internal/notify/telegram  
❌ internal/notify/ntfy
❌ internal/notify/email
```

**Problém:** Publikujú sa ale žiadny subscriber → notifikácie sa nedoručujú  
**Riešenie:** Pravdepodobne sa používa Apprise HTTP API → opraviť kód alebo dokumentáciu

#### C) Internal Recalc Mode - orphaned

```
❌ internal/recalc_mode
```

**Použitie:** POST `/api/mode` publikuje ale nikto nepočúva  
**Riešenie:** Implementovať subscriber alebo vymazať

### ⚠️ OČAKÁVANÉ ALE CHÝBAJÚCE PUBLISHERS

```
⚠️ internal/holidays/check - subscriber existuje, publisher chýba
⚠️ meta/service/ui/online - Next.js UI nemá MQTT client
⚠️ stat/sensor/kupelna_humidity/state - Zigbee sensor (pravdepodobne OK)
⚠️ stat/switch/kupelna_fan/state - Zigbee switch (pravdepodobne OK)
```

### ✅ SPRÁVNE FUNGUJÚCE

- `internal/planner/orchestrate` → `internal/planner/edges/#` ✅
- `internal/resolver/trigger` ✅  
- `virt/room/+/*`, `virt/boost/+/*`, `virt/weather/*` ✅

**Štatistika:**
- MQTT IN: 23 topics
- MQTT OUT: 39 base topics (~80+ expandované)
- Orphaned OUT: 47 topics
- Orphaned IN: 4 topics

---

## 4. Odporúčania

### Priorita VYSOKÁ:
1. ✅ **Opraviť `/api/mode` GET handler** - použiť `global.get('activeMode')` alebo vypočítať z regimes *(HOTOVO: commit 068cdc1)*
2. ✅ **Pridať `NR_CRED_SECRET` do docker-compose.yml** *(HOTOVO: commit 068cdc1)*
3. ✅ **Vytvoriť `.env.example`** s dokumentáciou všetkých potrebných premenných *(HOTOVO: aktualizovaný)*

### Priorita STREDNÁ:
4. ⚠️ **Štandardizovať BOOST context** - používať buď `flow` alebo `global` (nie oba) *(TODO)*
5. ⚠️ **Vyčistiť `flow.get('current_overrides')`** - ak sa nepoužíva, odstrániť *(TODO)*
6. ⚠️ **Rozhodnúť medzi `modes` a `modesCfg`** - deprecate jeden z nich *(TODO)*

### Priorita NÍZKA:
7. ✅ **Dokumentovať všetky global/flow premenné** v README *(HOTOVO: PREMENNÉ_AUDIT.md, PREMENNÉ_REVÍZIA.md)*
8. ✅ **MQTT topics audit** *(HOTOVO: MQTT_TOPICS_AUDIT.md, commit 17a0c3a)*
8. 📝 **MQTT topics diagram** - vizualizácia publish/subscribe

---

## 5. Zhrnutie Nálezov

| Kategória | Počet | Status |
|-----------|-------|--------|
| Nedefinované ENV premenné | 5 | ❌ Treba vytvoriť .env |
| Kritická chýbajúca ENV (NR_CRED_SECRET) | 1 | ❌ **KRITICKÉ** |
| Nekonzistentné flow premenné | 3 | ⚠️ Treba opraviť |
| Duplicitné context (flow/global) | 1 | ⚠️ Štandardizovať |
| Správne používané premenné | 8+ | ✅ OK |

**Celkovo:** Projekt má ~10 problémov s premennými, z toho 2 sú kritické.
