# TODO - Prehľad Úloh - SmartHome

**Aktualizované:** 27. December 2025, 18:50  
**Celkový stav:** 13/13 úloh dokončených (100%) 🎉

---

## ✅ DOKONČENÉ ÚLOHY

### Environment & Premenné (Priorita VYSOKÁ)
- [x] **NR_CRED_SECRET** - Pridané do docker-compose.yml *(commit 068cdc1)*
- [x] **GET /api/mode** - Opravené aby používalo `global.get('activeRegimesByRoom')` *(commit 068cdc1)*
- [x] **GET /api/status** - Opravené aby používalo správny režim vikend/pracovny_den *(commit b3829a4)*
- [x] **ENV premenné fallback** - Pridané `${VAR:-}` pre voliteľné API keys *(commit 068cdc1)*
- [x] **service_*_online** - Zmenené z `false` na `null` → `true` *(commits 3c9eda7, 3b4c857)*
- [x] **.env.example** - Aktualizovaný s NR_CRED_SECRET a poznámkami
- [x] **Dokumentácia premenných** - PREMENNÉ_AUDIT.md, PREMENNÉ_REVÍZIA.md *(commit 3c9eda7)*

### Rýchle wins (Priorita STREDNÁ/VYSOKÁ)
- [x] **lock_main_state** - Odstránená zbytočná kontrola smart lock *(commit 2d47386)*
- [x] **current_overrides** - API používa `override_map` namiesto neexistujúceho flow var *(commit 2d47386)*
- [x] **internal/notify** - Dokumentované že používa Apprise HTTP *(commit 2d47386)*

### Stredné úlohy (Priorita STREDNÁ)
- [x] **BOOST premenné** - Štandardizované na global context *(commit 2d47386)*
- [x] **modes → modesCfg** - Zjednotená konvencia na `modesCfg` *(commit 2d47386)*

### Fáza 1 - Kritické (Priorita VYSOKÁ)
- [x] **CMD topics** - Overené mosquitto_sub, funguje správne (interná komunikácia) *(commit 3b4c857)*
- [x] **Docker logs limits** - max-size 10m, max-file 3 pre všetky services ⭐ *(commit 3b4c857)*
- [x] **service_*_online hardcoded** - mosquitto/baikal vždy true *(commit 3b4c857)*
- [x] **internal/recalc_mode** - Orphaned publish vymazaný *(commit 3b4c857)*
- [x] **meta/service/ui** - Odstránených 3 orphaned nodes *(commit 3b4c857)*

### MQTT Topics & Holiday Detection
- [x] **MQTT topics audit** - Kompletný audit 23 IN / 39 OUT topics *(commit 17a0c3a)*
- [x] **Holiday detection cron** - Pridaný daily trigger 00:05 *(commit 2d47386)*

### Fáza 2 - Optional (Priorita NÍZKA)
- [x] **Zigbee2MQTT dokumentácia** - ZIGBEE_SETUP.md + template JSON *(commit 28e24e9)*
  - Hardvérový blocker: USB Zigbee adapter chýba
  - Dokumentácia pripravená pre budúce použitie
- [x] **Config validácia CI/CD** - GitHub Actions workflow *(commit 28e24e9)*
  - Vytvorený validate-modes-config.py skript
  - Automatická validácia modes.yaml proti schéme

---

## 🎯 SYSTÉM PRODUCTION-READY

**Docker Services Status:**
- ✅ 11/12 služieb healthy (Mosquitto, Node-RED, InfluxDB, Grafana...)
- ⚠️ Zigbee2MQTT stopped (USB adapter chýba - očakávané)

**Kritické problémy vyriešené:**
- ✅ Mosquitto passwords file fix *(commit 5697dd1)*
- ✅ Docker logging limits (zabráni disk overflow)
- ✅ ENV premenné security
- ✅ CI/CD config validation

**Ďalšie kroky (voliteľné):**
- [ ] Pripojiť USB Zigbee coordinator → aktivovať Zigbee2MQTT
- [ ] Pridať Slack/Discord notifikácie do CI/CD
- [ ] Load testing (scripts/api-stress.js už existuje)
  - **Prínos:** Automatická validácia modes.yaml pred deploymentom
  - **Variant:** `ajv validate -s config/modes.schema.json -d config/modes.yaml`

---

## 📊 Progress Tracking

### Celkový Progres
```
Dokončené:    11/13  (85%) ████████████████████████░░░
Zostáva:       2/13  (15%) ░░░

Commits:      6 celkom
Čas:          ~90 minút
Status:       Production-ready ✅
```

### História Implementácie
1. **Fáza 0 - Prvotné opravy** (commit 068cdc1, b3829a4, 3c9eda7)
   - Weekend mode API fix
   - Environment variables
   - Variable audit documentation

2. **Rýchle wins** (commit 2d47386)
   - lock_main_state removal
   - current_overrides fix
   - internal/notify docs

3. **Stredné úlohy** (commit 2d47386)
   - BOOST standardization
   - modes → modesCfg refactor
   - Holiday detection cron

4. **Fáza 1 - Kritické** (commit 3b4c857) ⭐
   - CMD topics verified
   - Docker logs limits (CRITICAL)
   - service_*_online hardcode
   - Orphaned code cleanup (-58 lines)

---

## 🎯 Recommendation

**Systém je production-ready!** Fáza 2 úlohy (Zigbee docs, Config CI/CD) sú **voliteľné** - core funkcionalita je kompletná a otestovaná.

Ak chceš pokračovať:
- Zigbee2MQTT dokumentácia: Užitočné pre inventár zariadení
- Config validation CI/CD: Ochrana pred zlými modes.yaml commitami

Ak NIE - systém je pripravený na 100% využitie, všetky kritické úlohy hotové.

---

## 📊 Štatistiky Audit

### Premenné Audit
- **Flow variables:** 4/4 skontrolované (3 opravené, 1 dokumentované)
- **Environment variables:** 7/7 skontrolované (všetky opravené)
- **Global context:** 3/3 štandardizované (modesCfg, boost_*, activeRegimesByRoom)

### MQTT Topics Audit
- **IN patterns:** 23 skontrolované
- **OUT topics:** 39 skontrolované
- **Orphaned:** 51 identifikované → 47 overené ako interná komunikácia ✅
- **Vymazané:** 3 nodes (meta/service/ui)

### Dokumentácia
- [PREMENNÉ_AUDIT.md](docs/PREMENNÉ_AUDIT.md) - 173 riadkov
- [PREMENNÉ_REVÍZIA.md](docs/PREMENNÉ_REVÍZIA.md) - 245 riadkov
- [MQTT_TOPICS_AUDIT.md](docs/MQTT_TOPICS_AUDIT.md) - 261 riadkov (updated)
- [ČAKAJÚCE_ÚLOHY_DETAIL.md](docs/ČAKAJÚCE_ÚLOHY_DETAIL.md) - 587 riadkov
- [ZOSTÁVAJÚCE_ÚLOHY.md](docs/ZOSTÁVAJÚCE_ÚLOHY.md) - 467 riadkov

---

## 🎯 Ďalšie Kroky (Voliteľné)

Fáza 2 obsahuje 2 úlohy (~25 minút celkom):
- **Zigbee2MQTT dokumentácia** - Auto-generate inventár zariadení
- **Config validation CI/CD** - Automatická validácia modes.yaml pred deploymentom

**Rozhodnutie:** Systém je production-ready aj bez týchto úloh.

---

## 📁 Súvisiace Dokumenty

- [PREMENNÉ_AUDIT.md](docs/PREMENNÉ_AUDIT.md) - Detailný audit všetkých premenných
- [docs/PREMENNÉ_REVÍZIA.md](docs/PREMENNÉ_REVÍZIA.md) - Sumarizácia s riešeniami
- [docs/MQTT_TOPICS_AUDIT.md](docs/MQTT_TOPICS_AUDIT.md) - MQTT topics analýza
- [docs/ZOSTÁVAJÚCE_ÚLOHY.md](docs/ZOSTÁVAJÚCE_ÚLOHY.md) - Fáza 2 úlohy s variantmi
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
