# Security Configuration Documentation

Tento dokument popisuje bezpečnostné nastavenia pre SmartHome systém optimalizované pre interné siete (LAN-only deployment).

## 📋 Obsah

- [MQTT Access Control](#mqtt-access-control)
- [UI Authentication](#ui-authentication)
- [Network Security](#network-security)
- [Environment Variables](#environment-variables)
- [Setup Scripts](#setup-scripts)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## 🔐 MQTT Access Control

### Užívateľské Roly

| Užívateľ | Prístup | Účel |
|----------|---------|------|
| **admin** | Všetky topics (read/write) | Administrácia, konfigurácia |
| **nodered** | cmd/stat/virt/event/sys (read/write) | Automatizácie, flow logic |
| **ui** | cmd (write), stat/virt/event/config (read) | Web interface |
| **monitor** | Všetky topics (read-only) | Dashboardy, logging |
| **guest** | stat/event (read), cmd/living_room (write) | Obmedzený prístup |
| **zigbee2mqtt** | zigbee2mqtt/# (full), stat (write) | Zigbee zariadenia |
| **zwave** | zwave/# (full), stat (write) | Z-Wave zariadenia |

### Topic Pattern

```
cmd/       - Príkazy (commands) pre zariadenia
stat/      - Statusy zariadení
virt/      - Virtuálne senzory/aktuátory
event/     - Eventy (alerty, notifikácie)
sys/       - Systémové interné eventy
config/    - Konfiguračné topics
```

### ACL File: `/compose/config/mosquitto/acl.conf`

Príklad:

```conf
user nodered
topic write cmd/#
topic read stat/#
topic readwrite virt/#

user ui
topic write cmd/#
topic read stat/#
```

### Setup

```bash
# 1. Vytvor MQTT užívateľov a heslá
cd /home/pi/smarthome
./scripts/setup-mqtt-acl.sh

# 2. Zadaj heslá pre:
#    - admin (full access)
#    - nodered (automation)
#    - ui (web interface)
#    - monitor (dashboards)

# 3. Reštartuj Mosquitto
cd compose
docker compose restart mosquitto

# 4. Overpreheld ACL funguje
mosquitto_sub -h localhost -u monitor -P <password> -t 'stat/#' -v
```

### Password File

**Lokácia**: `/compose/config/mosquitto/passwords`

Vytvorený pomocou `mosquitto_passwd`:

```bash
# Vytvor nový password file
mosquitto_passwd -c passwords admin

# Pridaj ďalších užívateľov
mosquitto_passwd passwords nodered
mosquitto_passwd passwords ui
```

**Bezpečnosť**:
- Heslá sú bcrypt hashované
- File má permissions `600` (read/write len owner)
- Nie je commitnutý do git (v `.gitignore`)

---

## 🔑 UI Authentication

**Typ**: Basic Authentication s session cookies  
**Použitie**: LAN-only (jednoduchá ochrana, nie production-grade)

### Features

- ✅ Username/password login
- ✅ Session cookies (24h TTL)
- ✅ SHA-256 password hashing
- ✅ HttpOnly, SameSite=Strict cookies
- ❌ TLS/SSL (nie je potrebné pre LAN)
- ❌ OAuth2 (overkill pre internú sieť)
- ❌ bcrypt (SHA-256 je dostatočný pre LAN)

### Setup

```bash
# 1. Generuj credentials
./scripts/setup-ui-auth.sh

# Zadaj:
# - Username (default: admin)
# - Password (silné heslo)

# 2. Rebuild UI
cd ui/smarthome-ui
npm run build

# 3. Reštartuj UI kontajner
cd ../../compose
docker compose build ui
docker compose up -d ui

# 4. Test login
curl -u admin:<password> http://localhost:3000
```

### Environment Variables

**File**: `ui/smarthome-ui/.env.local`

```bash
UI_AUTH_ENABLED=true
UI_AUTH_USERNAME=admin
UI_AUTH_PASSWORD_HASH=<sha256_hash>
SESSION_SECRET=<random_32_byte_secret>
SESSION_MAX_AGE=86400  # 24 hours
```

### Middleware

**File**: `ui/smarthome-ui/src/middleware.ts`

Automaticky:
- Overuje session cookies
- Parsuje Basic Auth header
- Vyžaduje login pre všetky routes (okrem `/api/`, statických súborov)
- Vytvára session po úspešnom logine

---

## 🛡️ Network Security

**Stratégia**: Firewall-based isolation (UFW) pre LAN-only deployment

### Port Access Rules

| Port | Service | Access | Comment |
|------|---------|--------|---------|
| 22 | SSH | ANY | Vždy otvorené (prevent lockout) |
| 1880 | Node-RED | LAN-only | Automation engine |
| 1883 | MQTT | LAN-only | MQTT protocol |
| 9001 | MQTT WS | LAN-only | WebSocket for UI |
| 3000 | UI (dev) | LAN-only | Dev server |
| 8088 | UI (prod) | LAN-only | Production UI |
| 9090 | Prometheus | LAN-only | Metrics |
| 9093 | Alertmanager | LAN-only | Alerts |
| 16686 | Jaeger UI | LAN-only | Tracing |
| 3001 | Grafana | LAN-only | Dashboards |
| 8086 | InfluxDB | LAN-only | Time series DB |

### Setup

```bash
# 1. Hardening script
sudo ./scripts/harden-network.sh

# Automaticky deteguje:
# - Local IP (napr. 192.168.1.100)
# - Subnet (napr. 192.168.1.0/24)

# 2. Konfirmuj firewall rules
sudo ufw status verbose

# 3. Test z LAN zariadenia
curl http://192.168.1.100:1880  # OK
curl http://192.168.1.100:9090  # OK

# 4. Test z externej siete (cez VPN)
# Spojenie blokované ak nie je VPN aktívny
```

### UFW Rules

```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# SSH (always)
ufw allow 22/tcp

# LAN-only services
ufw allow from 192.168.1.0/24 to any port 1880 proto tcp
ufw allow from 192.168.1.0/24 to any port 1883 proto tcp
ufw allow from 192.168.1.0/24 to any port 9001 proto tcp
# ... (see script for full list)

# Enable
ufw enable
```

### Remote Access

Pre prístup z vonku:

1. **VPN** (odporúčané):
   - WireGuard alebo OpenVPN
   - Spojenie do LAN subnet
   - Firewall automaticky povolí prístup

2. **SSH Tunnel** (temporary):
   ```bash
   ssh -L 8088:localhost:8088 pi@<public_ip>
   # Potom otvoriť http://localhost:8088
   ```

3. **Cloudflare Tunnel** (advanced):
   - Expose UI cez Cloudflare
   - Vyžaduje Cloudflare account
   - SSL/TLS automaticky

---

## 🔧 Environment Variables

### MQTT Credentials

**File**: `compose/.env`

```bash
# MQTT Authentication
MQTT_USER=nodered
MQTT_PASSWORD=<strong_password>

# UI MQTT client
MQTT_UI_USER=ui
MQTT_UI_PASSWORD=<strong_password>

# Alertmanager webhooks
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### Generate Secrets

```bash
# MQTT password
openssl rand -base64 24

# Session secret
openssl rand -base64 32

# Password hash
echo -n "your_password" | sha256sum | cut -d' ' -f1
```

---

## 📜 Setup Scripts

### 1. `setup-mqtt-acl.sh`

Vytvorí MQTT užívateľov a password file.

```bash
./scripts/setup-mqtt-acl.sh

# Interaktívne:
# - admin password
# - nodered password
# - ui password
# - monitor password
# - zigbee2mqtt password (optional)
# - zwave password (optional)

# Výstup:
# - /compose/config/mosquitto/passwords
# - Permissions 600
```

### 2. `setup-ui-auth.sh`

Konfiguruje Basic Auth pre UI.

```bash
./scripts/setup-ui-auth.sh

# Interaktívne:
# - UI username (default: admin)
# - UI password

# Výstup:
# - ui/smarthome-ui/.env.local
# - Password hash (SHA-256)
# - Session secret (random)
```

### 3. `harden-network.sh`

Nastavuje UFW firewall rules.

```bash
sudo ./scripts/harden-network.sh

# Automaticky:
# - Deteguje LAN subnet
# - Nastavuje default policies
# - Povolí SSH
# - Povolí services len pre LAN
# - Enableuje UFW

# Interaktívne:
# - Reset existing rules? (y/n)
# - Add trusted IP? (y/n)
```

---

## 🧪 Testing

### MQTT ACL

```bash
# Test admin (full access)
mosquitto_pub -h localhost -u admin -P <password> -t 'cmd/test' -m 'hello'
mosquitto_sub -h localhost -u admin -P <password> -t '#' -v

# Test nodered (cmd write, stat read)
mosquitto_pub -h localhost -u nodered -P <password> -t 'cmd/living_room/light' -m 'ON'
mosquitto_sub -h localhost -u nodered -P <password> -t 'stat/#' -v

# Test ui (cmd write, stat read)
mosquitto_pub -h localhost -u ui -P <password> -t 'cmd/bedroom/temp' -m '21'
mosquitto_sub -h localhost -u ui -P <password> -t 'stat/#' -v

# Test monitor (read-only)
mosquitto_sub -h localhost -u monitor -P <password> -t '#' -v
# Should work

mosquitto_pub -h localhost -u monitor -P <password> -t 'cmd/test' -m 'fail'
# Should fail: Connection Error: Not authorized.

# Test guest (limited)
mosquitto_pub -h localhost -u guest -P <password> -t 'cmd/living_room/light' -m 'ON'
# OK

mosquitto_pub -h localhost -u guest -P <password> -t 'cmd/bedroom/light' -m 'ON'
# Fail: Not authorized
```

### UI Authentication

```bash
# Test unauthenticated request
curl http://localhost:3000
# HTTP 401 Unauthorized
# WWW-Authenticate: Basic realm="SmartHome UI"

# Test with credentials
curl -u admin:<password> http://localhost:3000
# HTTP 200 OK
# Set-Cookie: session=...

# Test with session cookie
curl -b "session=<token>" http://localhost:3000
# HTTP 200 OK (no re-auth needed)

# Test expired session (after 24h)
curl -b "session=<old_token>" http://localhost:3000
# HTTP 401 Unauthorized (session expired)
```

### Network Firewall

```bash
# From LAN device (192.168.1.x)
curl http://192.168.1.100:1880
# OK - Node-RED UI

curl http://192.168.1.100:9090
# OK - Prometheus

# From external IP (not in 192.168.1.0/24)
curl http://<public_ip>:1880
# Timeout or Connection refused (UFW blocked)

# Through VPN (appears as 192.168.1.x)
# VPN connects -> IP in range -> OK
```

---

## 🐛 Troubleshooting

### MQTT Connection Refused

**Problém**: `Connection Error: Not authorized.`

```bash
# 1. Check password file exists
ls -la /home/pi/smarthome/compose/config/mosquitto/passwords

# 2. Check ACL file exists
ls -la /home/pi/smarthome/compose/config/mosquitto/acl.conf

# 3. Check mosquitto.conf settings
cat compose/config/mosquitto/mosquitto.conf | grep -E 'password_file|acl_file|allow_anonymous'

# Should show:
# allow_anonymous false
# password_file /mosquitto/config/passwords
# acl_file /mosquitto/config/acl.conf

# 4. Restart Mosquitto
docker compose restart mosquitto
docker compose logs mosquitto | tail -50
```

### UI Login Not Working

**Problém**: Always returns 401 Unauthorized

```bash
# 1. Check .env.local exists
ls -la ui/smarthome-ui/.env.local

# 2. Check environment variables
cat ui/smarthome-ui/.env.local

# Should have:
# UI_AUTH_ENABLED=true
# UI_AUTH_USERNAME=admin
# UI_AUTH_PASSWORD_HASH=<hash>
# SESSION_SECRET=<secret>

# 3. Verify password hash
echo -n "your_password" | sha256sum
# Compare with UI_AUTH_PASSWORD_HASH

# 4. Rebuild UI
cd ui/smarthome-ui
npm run build
cd ../../compose
docker compose build ui
docker compose up -d ui

# 5. Check logs
docker compose logs ui | tail -50
```

### Firewall Blocking Legitimate Traffic

**Problém**: Cannot access from LAN device

```bash
# 1. Check UFW status
sudo ufw status verbose

# 2. Verify subnet matches your network
ip addr show | grep inet
# Compare with UFW rules (should match)

# 3. Check specific rule
sudo ufw status numbered
# Find rule number for service

# 4. Temporarily disable UFW (testing only)
sudo ufw disable
# Test connection
curl http://localhost:1880
# Re-enable
sudo ufw enable

# 5. Add specific IP if needed
sudo ufw allow from 192.168.1.50 comment "Laptop"
```

### Node-RED Cannot Connect to MQTT

**Problém**: MQTT nodes show "disconnected"

```bash
# 1. Check environment variables
docker compose exec nodered env | grep MQTT
# Should show:
# MQTT_USER=nodered
# MQTT_PASSWORD=<password>

# 2. Update MQTT broker node in Node-RED
# - Server: mosquitto
# - Port: 1883
# - Username: ${MQTT_USER}
# - Password: ${MQTT_PASSWORD}

# 3. Test from container
docker compose exec nodered sh
mosquitto_sub -h mosquitto -u nodered -P <password> -t 'stat/#' -v

# 4. Check Mosquitto logs
docker compose logs mosquitto | grep nodered
```

---

## 🔄 Credential Rotation

### MQTT Passwords

```bash
# 1. Update password
mosquitto_passwd /home/pi/smarthome/compose/config/mosquitto/passwords nodered

# 2. Update .env
nano compose/.env
# Change MQTT_PASSWORD=<new_password>

# 3. Restart services
docker compose restart mosquitto
docker compose restart nodered
docker compose restart ui
```

### UI Password

```bash
# 1. Generate new hash
echo -n "new_password" | sha256sum | cut -d' ' -f1

# 2. Update .env.local
nano ui/smarthome-ui/.env.local
# Change UI_AUTH_PASSWORD_HASH=<new_hash>

# 3. Rebuild UI
cd ui/smarthome-ui
npm run build
cd ../../compose
docker compose build ui
docker compose up -d ui
```

### Session Secret

```bash
# 1. Generate new secret
openssl rand -base64 32

# 2. Update .env.local
nano ui/smarthome-ui/.env.local
# Change SESSION_SECRET=<new_secret>

# 3. Rebuild UI (all sessions invalidated)
cd ui/smarthome-ui
npm run build
cd ../../compose
docker compose build ui
docker compose up -d ui
```

---

## 📚 References

- [Mosquitto ACL Documentation](https://mosquitto.org/man/mosquitto-conf-5.html)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [UFW Firewall Guide](https://help.ubuntu.com/community/UFW)
- [Basic Authentication RFC 7617](https://datatracker.ietf.org/doc/html/rfc7617)

---

## 📝 Summary

- **MQTT ACL**: Topic-level permissions pre rôzne užívateľské roly
- **UI Auth**: Basic Authentication s session cookies (LAN-only)
- **Network**: UFW firewall, LAN-only access, VPN pre remote
- **Credentials**: Secure storage, rotation procedures, testing

Pre externú sieť odporúčame:
- TLS/SSL (Let's Encrypt)
- OAuth2/OIDC (Google, GitHub)
- Rate limiting (už implementované)
- WAF (Cloudflare)
- VPN (WireGuard)
