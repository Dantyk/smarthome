# Bezpečnostný Audit Report - 27.12.2025

## 📊 Súhrn

| Kategória | Kritické | Vysoké | Stredné | Nízke | Stav |
|-----------|----------|--------|---------|-------|------|
| Node-RED NPM | 6 | 6 | 5 | 2 | ⚠️ Vyžaduje pozornosť |
| UI NPM | 1 | 2 | 0 | 0 | ⚠️ Vyžaduje pozornosť |
| MQTT ACL | - | - | - | - | ✅ OK |
| Network Security | - | - | - | - | ✅ OK (LAN-only) |

---

## 🔍 Detailné Výsledky

### 1. NPM Vulnerabilities - Node-RED

**Počet zraniteľností:** 19 (6 critical, 6 high, 5 moderate, 2 low)

**Odporúčania:**
- ✅ Automatický `npm audit fix` aplikovaný
- ⚠️ Niektoré vulnerabilities nemožné opraviť bez breaking changes
- 📌 Monitorovať Node-RED release notes pre security patches
- 🔒 Riešenie: LAN-only deployment minimalizuje riziko

**Akceptované riziko:**
- Node-RED beží len v LAN sieti (firewall blocked z internetu)
- Žiadny external prístup k MQTT alebo Node-RED API
- UI má Basic Auth + session cookies (24h TTL)

---

### 2. NPM Vulnerabilities - Next.js UI

**Počet zraniteľností:** 3 (1 critical, 2 high)

**Odporúčania:**
- ✅ Automatický `npm audit fix` aplikovaný
- 📦 Zvážiť update Next.js na najnovšiu verziu
- 🔐 UI už má Basic Auth implementovaný

**Akceptované riziko:**
- UI je LAN-only (port 8088 blocked z internetu)
- Basic Auth + session management implementované
- Rate limiting na MQTT API endpoints

---

### 3. MQTT ACL - ✅ Bezpečné

**Konfigurácia:**
```
admin    - readwrite #              (full access)
nodered  - cmd/# virt/# event/# sys/# (system control)
ui       - cmd/# stat/# virt/#      (user interface)
monitor  - stat/# virt/# event/#    (read-only monitoring)
```

**Bezpečnostné opatrenia:**
- ✅ Topic-level permissions implementované
- ✅ Žiadne anonymous connections
- ✅ ACL file je read-only v kontajneri
- ✅ Mosquitto port 1883 exposed len v LAN

---

### 4. Network Security - ✅ Bezpečné

**Firewall (UFW):**
- ✅ SSH (port 22) - len z LAN
- ✅ HTTP/HTTPS - blocked z internetu
- ✅ MQTT ports - blocked z internetu
- ✅ Default: deny incoming, allow outgoing

**Docker Ports:**
- 8088 (UI) - mapped na 0.0.0.0 (LAN only z firewall)
- 1883 (MQTT) - mapped na 0.0.0.0 (LAN only z firewall)
- 9001 (MQTT WS) - mapped na 0.0.0.0 (LAN only z firewall)

---

## ✅ Akčný Plán

### Vysoká Priorita
- [ ] Update Next.js UI dependencies (`npm update` v ui/smarthome-ui)
- [ ] Review Node-RED flow security (žiadne hardcoded credentials)
- [ ] Pravidelný monitoring security-reports/

### Stredná Priorita
- [ ] Nastaviť automated security scans (GitHub Dependabot/Renovate)
- [ ] Zvážiť Codecov pre test coverage tracking
- [ ] Docker image scanning v CI/CD pipeline

### Nízka Priorita
- [ ] Implementovať MQTT TLS/SSL (ak potrebné pre remote access)
- [ ] Zvážiť 2FA pre UI (ak accessibility z internetu)

---

## 📝 Poznámky

**LAN-Optimized Security:**
Tento projekt je optimalizovaný pre **LAN-only deployment**. Väčšina security vulnerabilities je mitigovaných network-level security (firewall, no external access).

**Production Deployment:**
Ak plánujete external access:
1. Enable MQTT TLS/SSL
2. Implement stronger UI authentication (OAuth2/SAML)
3. Use VPN pre remote access namiesto public exposure
4. Resolve všetky critical/high NPM vulnerabilities

**Last Audit:** 27.12.2025  
**Next Audit:** Q1 2026 (alebo pri major version updates)
