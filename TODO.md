# TODO - Prehľad Úloh - SmartHome

**Aktualizované:** 27. December 2025, 17:50  
**Celkový stav:** 7/13 úloh dokončených (54%)

---

## ✅ DOKONČENÉ ÚLOHY

### Environment & Premenné (Priorita VYSOKÁ)
- [x] **NR_CRED_SECRET** - Pridané do docker-compose.yml *(commit 068cdc1)*
- [x] **GET /api/mode** - Opravené aby používalo `global.get('activeRegimesByRoom')` *(commit 068cdc1)*
- [x] **GET /api/status** - Opravené aby používalo správny režim vikend/pracovny_den *(commit b3829a4)*
- [x] **ENV premenné fallback** - Pridané `${VAR:-}` pre voliteľné API keys *(commit 068cdc1)*
- [x] **service_*_online** - Zmenené z `false` na `null` *(commit 3c9eda7)*
- [x] **.env.example** - Aktualizovaný s NR_CRED_SECRET a poznámkami
- [x] **Dokumentácia premenných** - PREMENNÉ_AUDIT.md, PREMENNÉ_REVÍZIA.md *(commit 3c9eda7)*

### MQTT Topics (Audit)
- [x] **MQTT topics audit** - Kompletný audit 23 IN / 39 OUT topics *(commit 17a0c3a)*

---

## ⚠️ ČAKAJÚCE ÚLOHY

### Priorita STREDNÁ (UX)
- [ ] **current_overrides** - Prepísať API aby používalo `override_map` namiesto neexistujúceho `flow.get('current_overrides')`
  - **Súbor:** [flows.json:1607, 1571](flows/nodered/flows.json)
  - **Riešenie:** Čítať z `flow.get('override_map')` ktorý už existuje
  - **Dopad:** API vracia vždy prázdne `overrides: []`

- [ ] **modes vs modesCfg** - Rozhodnúť ktorú premennú používať, deprecate druhú
  - **Problém:** `global.get('modes')` vs `global.get('modesCfg')` - nejasná konzistencia
  - **Riešenie:** Štandardizovať na `modesCfg`, odstrániť `modes`

- [ ] **BOOST premenné** - Štandardizovať flow vs global context
  - **Problém:** `global.get('boost_${room}_active')` + `flow.get('boost_${room}_active')` - oba sa používajú
  - **Riešenie:** Používať len `global` pre perzistenciu

### Priorita NÍZKA (Cleanup)
- [ ] **lock_main_state** - Odstrániť kontrolu ak nemáš smart lock
  - **Súbor:** [flows.json:1031](flows/nodered/flows.json)
  - **Problém:** Číta sa ale nikdy sa nenastavuje
  - **Riešenie:** Vymazať z alert decision matrix

### MQTT Topics (Implementácia)
- [ ] **CMD topics overenie** - `cmd/hvac/*` (20 topics)
  - **Akcia:** Skontrolovať `mosquitto_sub -t 'cmd/hvac/#'`
  - **Rozhodnutie:** Ak TRV ventily existujú → dokumentovať; inak vymazať

- [ ] **internal/recalc_mode** - Implementovať subscriber alebo vymazať
  - **Súbor:** POST `/api/mode` publikuje tento topic
  - **Problém:** Nikto nepočúva

- [ ] **internal/notify/*** - Overiť či Apprise HTTP alebo MQTT
  - **Topics:** pushover, telegram, ntfy, email
  - **Akcia:** Dokumentovať ak HTTP; implementovať ak MQTT

- [ ] **internal/holidays/check** - Pridať cron trigger
  - **Problém:** Subscriber existuje ale nikto nepublikuje

---

## 📊 Progress Tracking

### Premenné Audit
| Kategória | Celkom | Opravené | Zostáva |
|-----------|--------|----------|---------|
| ENV premenné | 7 | 7 | 0 |
| Flow premenné | 4 | 1 | 3 |
| **Spolu** | **11** | **8** | **3** |

### MQTT Topics Audit
| Kategória | Celkom | Status |
|-----------|--------|--------|
| Orphaned OUT | 47 | Dokumentované, čakajú rozhodnutie |
| Orphaned IN | 4 | Dokumentované |
| Správne | ~30+ | ✅ Fungujú |

---

## 🎯 Odporúčané Kroky (Priority Order)

1. **current_overrides** - Jednoduchá zmena v API handlers → použiť override_map
2. **lock_main_state** - Jednoduchá zmena → vymazať kontrolu
3. **modes vs modesCfg** - Review použitia + refactor
4. **BOOST premenné** - Refactor flow → global
5. **CMD topics** - Overenie hardvéru (Zigbee2MQTT)
6. **internal/recalc_mode** - Rozhodnutie: implementovať alebo vymazať
7. **internal/notify** - Dokumentácia (pravdepodobne Apprise HTTP)

---

## 📁 Súvisiace Dokumenty

- [PREMENNÉ_AUDIT.md](PREMENNÉ_AUDIT.md) - Detailný audit všetkých premenných
- [docs/PREMENNÉ_REVÍZIA.md](docs/PREMENNÉ_REVÍZIA.md) - Sumarizácia s riešeniami
- [docs/MQTT_TOPICS_AUDIT.md](docs/MQTT_TOPICS_AUDIT.md) - MQTT topics analýza
- [SECURITY_AUDIT_2025-12-27.md](SECURITY_AUDIT_2025-12-27.md) - Security audit

---

## 🚀 Quick Commands

```bash
# Overiť CMD topics
mosquitto_sub -v -t 'cmd/hvac/#'

# Monitoring všetkých MQTT topics
mosquitto_sub -v -t '#' -F '%t: %p'

# Reštart Node-RED po zmenách
cd compose && docker compose restart nodered
```

---

**Poznámka:** Tento súbor je automaticky generovaný sumár z:
- PREMENNÉ_AUDIT.md
- docs/PREMENNÉ_REVÍZIA.md  
- docs/MQTT_TOPICS_AUDIT.md

Pre detaily k jednotlivým problémom pozri príslušné dokumenty.
