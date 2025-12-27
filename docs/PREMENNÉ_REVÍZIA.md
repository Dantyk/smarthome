# Sumarizácia revízie premenných - SmartHome

**Dátum:** 27. December 2025  
**Commit:** 068cdc1

## ✅ OPRAVENÉ

### 1. ❌→✅ Chýbajúca `NR_CRED_SECRET`
**Problém:** Node-RED nemohol dešifrovať credentials  
**Oprava:** Pridané do [docker-compose.yml](compose/docker-compose.yml#L25) s fallback hodnotou  
**Commit:** 068cdc1

### 2. ❌→✅ API `/api/mode` vracalo hardcoded "work"
**Problém:** `flow.get('current_mode')` neexistovalo → fallback na 'work'  
**Oprava:** Prepísané aby používalo `global.get('activeRegimesByRoom')`  
**Commit:** 068cdc1

### 3. ❌→✅ Nedefinované environment premenné
**Problém:** `${GOOGLE_CLIENT_SECRET}` atď. chýbali → undefined v kontajneri  
**Oprava:** Pridané fallback hodnoty `${VAR:-}` do docker-compose.yml  
**Commit:** 068cdc1

## ⚠️ NÁJDENÉ ALE NEOPRAVENÉ

### 4. ⚠️ `flow.get('current_overrides')` - NIKDY NENASTAVENÉ
**Použitie:**
- [flows.json:1571](flows/nodered/flows.json#L1571) - API `/api/status`
- [flows.json:1607](flows/nodered/flows.json#L1607) - API `/api/mode`

**Dopad:** API vracia `overrides: []` namiesto skutočných override hodnôt

**Možné riešenia:**
1. **Implementovať:** Pridať flow ktorý monitoruje `virt/room/+/override` MQTT topic a aktualizuje `flow.set('current_overrides', [...])`
2. **Odstrániť:** Vymazať `overrides` z API response (ak sa nepoužíva)
3. **Použiť override_map:** Čítať z `flow.get('override_map')` ktorý už existuje (riadok 3072)

**Odporúčanie:** Použiť riešenie #3 - prepísať API aby čítalo z `override_map`

---

### 5. ⚠️ `flow.get('lock_main_state')` - NIKDY NENASTAVENÉ
**Použitie:**
- [flows.json:1031](flows/nodered/flows.json#L1031) - Security alert decision

**Dopad:** Bezpečnostné alerty vždy používajú fallback `false` → pohyb sa nikdy nedeteguje ako "dom zamknutý"

**Možné riešenia:**
1. **Implementovať:** Pridať MQTT subscriber pre `stat/lock/main/state` ktorý nastaví `flow.set('lock_main_state', ...)`
2. **Odstrániť:** Vymazať lock kontrolu z alert decision matrix
3. **Simulovať:** Ak nemáš smart lock, vždy vrátiť `false`

**Odporúčanie:** Ak nemáš smart lock → odstrániť kontrolu (riešenie #2)

---

### 6. ⚠️ `flow.get('service_mosquitto_online')` / `flow.get('service_baikal_online')` - NIKDY NENASTAVENÉ
**Použitie:**
- [flows.json:1571](flows/nodered/flows.json#L1571) - API `/api/status` → `services` objekt

**Dopad:** API vracia vždy `mosquitto: false, baikal: false` aj keď služby bežia

**Možné riešenia:**
1. **Implementovať healthcheck flow:**
   ```javascript
   // MQTT subscriber na $SYS/broker/uptime (mosquitto)
   flow.set('service_mosquitto_online', true)
   
   // HTTP request na http://baikal/dav.php každých 60s
   flow.set('service_baikal_online', response.statusCode === 200)
   ```
2. **Docker healthcheck:** Čítať z docker API `/containers/compose-mosquitto-1/json` → `State.Health.Status`
3. **Odstrániť:** Vymazať `services` z API response
4. **Vrátiť null:** `mosquitto: null, baikal: null` namiesto `false`

**Odporúčanie:** Riešenie #4 (zmeniť na `null`) - najjednoduchšie, nezavádzajúce

---

## 📊 Štatistika

| Kategória | Počet | Status |
|-----------|-------|--------|
| **Opravené problémy** | 3 | ✅ |
| **Nájdené ale neopravené** | 3 | ⚠️ |
| **Celkové flow.get() bez flow.set()** | 4 | ⚠️ |
| **Celkové premenné v projekte** | ~150+ | - |

---

## 🚀 Ďalšie kroky

### Priorita VYSOKÁ (kritické):
- [x] Opraviť `NR_CRED_SECRET`
- [x] Opraviť `/api/mode` current mode
- [x] Pridať fallback pre ENV premenné

### Priorita STREDNÁ (UX):
- [ ] **Opraviť `current_overrides`** - použiť `override_map`
- [x] **Opraviť `service_*_online`** - zmeniť na `null` alebo implementovať healthcheck *(HOTOVO: commit 3c9eda7)*

### Priorita NÍZKA (cleanup):
- [ ] Odstrániť `lock_main_state` kontrolu (ak nemáš smart lock)
- [ ] Štandardizovať BOOST premenné (flow vs global)
- [ ] Vyčistiť legacy `modes` vs `modesCfg`

---

## 📝 Poznámky

- Celý audit uložený v [PREMENNÉ_AUDIT.md](PREMENNÉ_AUDIT.md)
- Všetky opravy testované: ✅ API vracia správne údaje
- Environment premenné dokumentované v [compose/.env.example](compose/.env.example)

---

**Autor:** GitHub Copilot  
**Revízia:** Automatická analýza `flow.get()` vs `flow.set()`  
**Tool:** `grep -oP`, `comm -23`
