# Detailný Rozpis Čakajúcich Úloh

**Účel:** Pomôcť rozhodnúť sa o ďalších krokoch pre každú úlohu  
**Dátum:** 27. December 2025

---

## 1. `current_overrides` - Použiť override_map

### 🔍 Čo je problém?

API endpointy `/api/status` a `/api/mode` vracajú:
```json
{
  "mode": {
    "current": "vikend",
    "overrides": []  // ← Vždy prázdne!
  }
}
```

**Prečo:** Kód číta `flow.get('current_overrides')` ktorý **nikdy nie je nastavený**.

### 📍 Kde sa to nachádza?

1. **[flows.json:1571](../flows/nodered/flows.json#L1571)** - API `/api/status` handler
2. **[flows.json:1607](../flows/nodered/flows.json#L1607)** - API `/api/mode` handler

```javascript
// Aktuálny kód (CHYBNÝ):
msg.payload = {
    mode: {
        current: currentMode,
        overrides: flow.get('current_overrides') || []  // ❌ Nikdy nenastavené
    }
}
```

### 🛠️ Možnosti riešenia:

#### Riešenie A: Použiť existujúci `override_map`

**Už existuje premenná `override_map`** v [flows.json:3072](../flows/nodered/flows.json#L3072)!

```javascript
// Nový kód:
const overrideMap = flow.get('override_map') || {};
const activeOverrides = [];

Object.keys(overrideMap).forEach(room => {
    const ov = overrideMap[room];
    if (ov && ov.active) {
        activeOverrides.push({
            room: room,
            until: ov.until,
            reason: ov.reason || 'manual'
        });
    }
});

msg.payload = {
    mode: {
        current: currentMode,
        overrides: activeOverrides  // ✅ Skutočné override hodnoty
    }
}
```

**Výhody:**
- ✅ Funguje okamžite, `override_map` už je implementovaný
- ✅ Žiadne nové dependencies
- ✅ UI dostane skutočné override info

**Nevýhody:**
- ⚠️ Potrebné upraviť 2 function nodes

**Čas:** ~10 minút

#### Riešenie B: Odstrániť `overrides` z API

Ak sa override info nepoužíva v UI:

```javascript
msg.payload = {
    mode: {
        current: currentMode
        // overrides pole odstránené
    }
}
```

**Výhody:**
- ✅ Najrýchlejšie (len vymazať riadok)
- ✅ Žiadna logika

**Nevýhody:**
- ❌ Stráca sa potenciálne užitočná informácia

**Čas:** ~2 minúty

### 💡 Odporúčanie: **Riešenie A**

Override info je užitočné pre UI - ukázať používateľovi "spálňa má override do 22:00".

---

## 2. `modes` vs `modesCfg` - Štandardizovať

### 🔍 Čo je problém?

V kóde sa používajú **dve podobné globálne premenné**:
- `global.get('modes')` - legacy, používané v starých alert flow
- `global.get('modesCfg')` - nové, používané v planner/resolver

**Nejasné:** Ktorá je správna? Obsahujú rôzne údaje?

### 📍 Kde sa to nachádza?

**`modes` použitie:**
- [flows.json:402](../flows/nodered/flows.json#L402) - Old planner code (commented/unused?)
- [flows.json:1031](../flows/nodered/flows.json#L1031) - Alert decision matrix
- [flows.json:1571](../flows/nodered/flows.json#L1571) - API status handler fallback

**`modesCfg` použitie:**
- [flows.json:438](../flows/nodered/flows.json#L438) - Weather correlation
- [flows.json:675](../flows/nodered/flows.json#L675) - Mode resolver (hlavný)
- [flows.json:817](../flows/nodered/flows.json#L817) - Planner orchestrator
- [flows.json:1571](../flows/nodered/flows.json#L1571) - API status handler (primary)

### 🛠️ Možnosti riešenia:

#### Riešenie A: Štandardizovať na `modesCfg` (odporúčané)

1. **Hľadaj všetky `global.get('modes')`**
2. **Nahraď za `global.get('modesCfg')`**
3. **Skontroluj či kód stále funguje** (test API endpoints)

**Kroky:**
```bash
# 1. Nájdi všetky použitia
grep -n "global.get('modes')" flows/nodered/flows.json

# 2. Manuálne prejdi každé a zmeň na modesCfg
# 3. Test:
curl http://localhost:1880/api/status
```

**Výhody:**
- ✅ Jednotná konvencia
- ✅ `modesCfg` je aktuálnejší (načítava modes.yaml)

**Nevýhody:**
- ⚠️ Potrebné otestovať všetky flow ktoré používali `modes`

**Čas:** ~20 minút + testing

#### Riešenie B: Aliasovať - nastaviť obe

Pri načítaní konfigurácie:
```javascript
global.set('modesCfg', cfg);
global.set('modes', cfg);  // Backward compatibility
```

**Výhody:**
- ✅ Backward compatible
- ✅ Nič sa nepokazí

**Nevýhody:**
- ❌ Stále duplicita
- ❌ Zbytočné využívanie pamäte

**Čas:** ~5 minút

#### Riešenie C: Nechať ako je + dokumentovať

**Výhody:**
- ✅ Žiadna práca

**Nevýhody:**
- ❌ Nejasný kód

### 💡 Odporúčanie: **Riešenie A**

Dlhodobo lepšie mať jednu premennú. Legacy kód treba vyčistiť.

---

## 3. BOOST premenné - flow vs global

### 🔍 Čo je problém?

BOOST stav sa ukladá **na dvoch miestach súčasne**:
- `global.get('boost_${room}_active')` - používa planner
- `flow.get('boost_${room}_active')` - používa API status

**Problém:** Ak sa zmení jedno, druhé nemusí byť aktuálne → **nekonzistencia**.

### 📍 Kde sa to nachádza?

**global context:**
- [flows.json:817](../flows/nodered/flows.json#L817) - Planner orchestrator čítanie
- [flows.json:895](../flows/nodered/flows.json#L895) - Planner publish targets čítanie

**flow context:**
- [flows.json:402](../flows/nodered/flows.json#L402) - Old planner (unused?)
- [flows.json:1571](../flows/nodered/flows.json#L1571) - API status handler čítanie

### 🛠️ Možnosti riešenia:

#### Riešenie A: Štandardizovať na `global`

**Prečo global?**
- ✅ Perzistentné (prežije Node-RED restart ak je file-based context)
- ✅ Zdieľané medzi všetkými flow
- ✅ Už používané plannerom

**Kroky:**
1. Nájdi všetky `flow.get('boost_*')`
2. Nahraď za `global.get('boost_*')`
3. Nájdi všetky `flow.set('boost_*')`
4. Nahraď za `global.set('boost_*')`

**Výhody:**
- ✅ Jedna source of truth
- ✅ Perzistencia BOOST stavu

**Nevýhody:**
- ⚠️ Potrebné nájsť všetky set/get (cca 10-15 miest)

**Čas:** ~15 minút

#### Riešenie B: Štandardizovať na `flow`

**Prečo flow?**
- ✅ Rýchlejší prístup
- ✅ Automaticky sa vyčistí po reštarte

**Výhody:**
- ✅ Menej "global pollution"

**Nevýhody:**
- ❌ Stratí sa BOOST po reštarte Node-RED
- ❌ Planner už používa global

**Čas:** ~15 minút

#### Riešenie C: Synchronizovať obe

Pri každom `flow.set('boost_*')` aj `global.set('boost_*')`:

**Výhody:**
- ✅ Backward compatible

**Nevýhody:**
- ❌ Duplicita, zbytočná zložitosť
- ❌ Možnosť desynchronizácie

### 💡 Odporúčanie: **Riešenie A (global)**

Planner už používa global, má to logiku pre perzistenciu BOOST stavu.

---

## 4. `lock_main_state` - Vymazať kontrolu

### 🔍 Čo je problém?

Security alert flow kontroluje:
```javascript
const lockState = flow.get('lock_main_state') || false;
if (lockState) {
    alert.severity = 'warning';
    alert.message = `🚨 Pohyb detekovaný: ${location} (dom zamknutý)`;
} else {
    alert.severity = 'info';
    alert.message = `👁️ Pohyb: ${location}`;
}
```

**Problém:** `lock_main_state` sa **nikdy nenastavuje** → vždy `false` → táto kontrola je zbytočná.

### 📍 Kde sa to nachádza?

**[flows.json:1031](../flows/nodered/flows.json#L1031)** - Alert decision matrix

### 🛠️ Možnosti riešenia:

#### Riešenie A: Vymazať kontrolu

Najjednoduchšie:
```javascript
// Vymazať celú podmienku, vždy použiť info level
if (category === 'security' && type === 'motion') {
    alert.severity = 'info';
    alert.message = `👁️ Pohyb: ${location}`;
}
```

**Výhody:**
- ✅ Najrýchlejšie
- ✅ Kód funguje presne ako teraz (lebo lock je vždy false)

**Nevýhody:**
- ❌ Stratí sa možnosť budúcej integrácie smart lock

**Čas:** ~2 minúty

#### Riešenie B: Implementovať smart lock monitoring

Ak **máš** smart lock (napr. Zigbee/Z-Wave):

1. Pridať MQTT subscriber:
```json
{
  "type": "mqtt in",
  "topic": "stat/lock/main/state",
  "...": "..."
}
```

2. V handleri:
```javascript
flow.set('lock_main_state', msg.payload === 'locked');
```

**Výhody:**
- ✅ Funkčný security monitoring

**Nevýhody:**
- ❌ Potrebuješ smart lock hardvér

**Čas:** ~10 minút (ak máš hardvér)

#### Riešenie C: Nechať ako je + komentár

Pridať komentár:
```javascript
// TODO: lock_main_state nie je implementovaný, vždy false
const lockState = flow.get('lock_main_state') || false;
```

**Výhody:**
- ✅ Nič sa nemusí meniť

**Nevýhody:**
- ❌ Dead code v projekte

### 💡 Odporúčanie: 

**Ak nemáš smart lock:** Riešenie A (vymazať)  
**Ak máš smart lock:** Riešenie B (implementovať)

---

## 5. CMD topics - Overiť TRV ventily

### 🔍 Čo je problém?

Node-RED publikuje **20 MQTT topics** na ovládanie HVAC:
```
cmd/hvac/spalna/enabled
cmd/hvac/spalna/override
cmd/hvac/spalna/override_duration
cmd/hvac/spalna/setpoint
... (× 5 miestností)
```

Ale **žiadny Node-RED flow ich nepočúva** → orphaned publish.

**Možné príčiny:**
1. **Zigbee2MQTT/Z-Wave bridge** - TRV ventily počúvajú priamo MQTT
2. **External service** - iný systém ich spracováva
3. **Legacy/nepoužívané** - staré topics ktoré už nie sú potrebné

### 📍 Kde sa to nachádza?

**Publikovanie:**
- Planner publikuje `cmd/hvac/*/setpoint`
- Override flow publikuje `cmd/hvac/*/override`

**Žiadny subscriber v Node-RED!**

### 🛠️ Možnosti riešenia:

#### Riešenie A: Overiť že zariadenia počúvajú

**Test:**
```bash
# 1. Spusti MQTT monitor
mosquitto_sub -v -t 'cmd/hvac/#'

# 2. Zmenit teplotu cez UI alebo API
# 3. Pozri či sa publikuje a či zariadenie reaguje

# 4. Skontroluj Zigbee2MQTT logy
docker compose logs zigbee2mqtt | grep "setpoint\|override"
```

**Ak zariadenia reagujú:**
- ✅ Všetko OK, len chýba dokumentácia
- **Akcia:** Pridaj do [docs/MQTT_TOPICS_AUDIT.md](../docs/MQTT_TOPICS_AUDIT.md) poznámku

**Ak nereagujú:**
- Riešenie B alebo C

#### Riešenie B: Vymazať publikovanie

Ak **nemáš TRV ventily**, tieto topics sú zbytočné:

1. Nájdi všetky `cmd/hvac/` publish v flows.json
2. Odstráň alebo zakomentuj

**Výhody:**
- ✅ Čistejší MQTT traffic
- ✅ Menej overhead

**Nevýhody:**
- ❌ Ak v budúcnosti pridáš TRV, treba znovu implementovať

#### Riešenie C: Implementovať mock handler

Pre testovanie/simuláciu:
```javascript
// MQTT IN: cmd/hvac/+/setpoint
const room = msg.topic.split('/')[2];
const setpoint = msg.payload;
node.warn(`[MOCK] Room ${room} setpoint: ${setpoint}°C`);
// Simuluj že ventil nastavil teplotu
flow.set(`${room}_hvac_setpoint`, setpoint);
```

**Výhody:**
- ✅ Môžeš testovať bez hardvéru

**Nevýhody:**
- ⚠️ Mock != real

### 💡 Odporúčanie: **Riešenie A najprv**

Spusti `mosquitto_sub` a over či máš hardvér. Ak nie → Riešenie B.

---

## 6. `internal/*` topics - Implementovať/dokumentovať

### 🔍 Čo sú problémy?

**A) `internal/notify/*` (4 topics):**
```
internal/notify/pushover
internal/notify/telegram
internal/notify/ntfy
internal/notify/email
```

**Publikujú sa** ale **nikto nepočúva** → notifikácie nefungujú.

**B) `internal/recalc_mode`:**

POST `/api/mode` publikuje tento topic, ale žiadny subscriber → nepoužívané.

**C) `internal/holidays/check`:**

Subscriber existuje ale nikto nepublikuje → holiday check sa nikdy nespustí.

### 📍 Kde sa to nachádza?

**internal/notify/*:**
- Publikuje alert split function

**internal/recalc_mode:**
- [flows.json:1643](../flows/nodered/flows.json#L1643) - POST `/api/mode` handler

**internal/holidays/check:**
- Očakávaný cron trigger (chýba)

### 🛠️ Možnosti riešenia:

#### Riešenie A: `internal/notify/*` - Dokumentovať Apprise

**Pravdepodobne:** Notifikácie už fungujú cez **Apprise HTTP API**, nie MQTT.

**Akcia:**
1. Over v kóde či sa používa Apprise HTTP
2. Ak áno → pridaj poznámku do dokumentácie
3. Odstráň MQTT publish pre `internal/notify/*`

**Čas:** ~5 minút

#### Riešenie B: `internal/recalc_mode` - Implementovať subscriber

Pridaj flow:
```json
{
  "type": "mqtt in",
  "topic": "internal/recalc_mode",
  "wires": [["resolver_trigger"]]
}
```

**Účel:** Keď admin zmení mode cez API, automaticky prepočítaj režimy.

**Výhody:**
- ✅ Funkčná feature

**Nevýhody:**
- ⚠️ Možno zbytočné ak resolver už beží periodicky

**Alebo vymazať** publish ak sa nepoužíva.

**Čas:** ~10 minút

#### Riešenie C: `internal/holidays/check` - Pridať cron

Pridaj inject node:
```json
{
  "type": "inject",
  "name": "Holiday Check Daily",
  "crontab": "0 0 * * *",  // Každý deň o polnoci
  "payload": "",
  "topic": "internal/holidays/check"
}
```

**Účel:** Spustí holiday checker každý deň.

**Výhody:**
- ✅ Funkčný holiday detection

**Nevýhody:**
- ⚠️ Potrebuješ implementovať holiday API/data source

**Čas:** ~5 minút (bez API implementácie)

### 💡 Odporúčanie:

1. **internal/notify/*** - Riešenie A (dokumentovať Apprise)
2. **internal/recalc_mode** - Vymazať publish (pravdepodobne zbytočné)
3. **internal/holidays/check** - Riešenie C (pridať cron) **len ak chceš holiday feature**

---

## 📊 Prioritizácia

### Rýchle wins (2-10 minút):
1. ✅ **lock_main_state** - vymazať kontrolu (2 min)
2. ✅ **internal/notify** - dokumentovať Apprise (5 min)
3. ✅ **current_overrides** - použiť override_map (10 min)

### Stredné (15-20 minút):
4. ⚠️ **BOOST premenné** - štandardizovať na global (15 min)
5. ⚠️ **modes vs modesCfg** - štandardizovať (20 min + testing)

### Potrebujú rozhodnutie/hardvér:
6. ❓ **CMD topics** - závisí od TRV ventilov
7. ❓ **internal/recalc_mode** - implementovať alebo vymazať?
8. ❓ **internal/holidays/check** - chceš holiday feature?

---

## 🎯 Odporúčený Postup

**Fáza 1 - Rýchle čistenie (30 minút):**
```bash
1. Vymazať lock_main_state kontrolu
2. Dokumentovať internal/notify (Apprise HTTP)
3. Implementovať current_overrides (použiť override_map)
4. Vymazať internal/recalc_mode publish (ak netreba)
```

**Fáza 2 - Štandardizácia (1 hodina):**
```bash
5. BOOST premenné → global
6. modes → modesCfg refactor + testing
```

**Fáza 3 - Hardvérové rozhodnutia (podľa potreby):**
```bash
7. CMD topics - overiť TRV ventily
8. internal/holidays/check - implementovať ak potrebuješ
```

---

**Chceš aby som niektorú z týchto úloh implementoval hneď?**
