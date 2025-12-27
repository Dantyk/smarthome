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
**Status:** ❓ Nie je jasné, kto nastavuje túto premennú. Pravdepodobne nepoužívané.

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

### Potrebuje kontrolu:

Skontrolovať či všetky publikované topics majú subscriber a naopak:
- `internal/planner/orchestrate`
- `internal/planner/edges/#`
- `virt/room/+/target_temp`
- `virt/room/+/scheduled_temp`
- `cmd/hvac/+/setpoint`

**Todo:** Prejsť všetky MQTT publish/subscribe a overiť párovanie

---

## 4. Odporúčania

### Priorita VYSOKÁ:
1. ✅ **Opraviť `/api/mode` GET handler** - použiť `global.get('activeMode')` alebo vypočítať z regimes
2. ❌ **Pridať `NR_CRED_SECRET` do docker-compose.yml**
3. ❌ **Vytvoriť `.env.example`** s dokumentáciou všetkých potrebných premenných

### Priorita STREDNÁ:
4. ⚠️ **Štandardizovať BOOST context** - používať buď `flow` alebo `global` (nie oba)
5. ⚠️ **Vyčistiť `flow.get('current_overrides')`** - ak sa nepoužíva, odstrániť
6. ⚠️ **Rozhodnúť medzi `modes` a `modesCfg`** - deprecate jeden z nich

### Priorita NÍZKA:
7. 📝 **Dokumentovať všetky global/flow premenné** v README
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
