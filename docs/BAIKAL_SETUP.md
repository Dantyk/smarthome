# Baïkal CalDAV Server - Setup Guide

## 🚀 Fresh Installation Steps

Pri novej inštalácii je potrebné vykonať tieto kroky:

### 1. Spustenie služieb

```bash
cd compose
docker compose up -d
```

### 2. Baïkal Initial Setup (JEDNORAZOVO)

Baïkal vyžaduje manuálnu inicializáciu cez web UI pri prvom spustení:

1. **Otvor admin interface:**
   ```
   http://localhost:8800/admin/
   ```

2. **Login credentials:**
   - Username: `admin`
   - Password: `admin`

3. **Vytvor používateľa `smarthome`:**
   - Settings → Users → Add user
   - Username: `smarthome`
   - Password: `smarthome`
   - Display name: `SmartHome System`
   - Email: `smarthome@localhost`

4. **Vytvor kalendár `default`:**
   - Automaticky sa vytvorí pri prvom prístupe
   - Alebo manuálne: Calendars → Add calendar
   - Name: `default`
   - Display name: `SmartHome Events`

### 3. Overenie funkčnosti

Po dokončení setup:

```bash
# Test CalDAV PROPFIND
curl -u smarthome:smarthome -X PROPFIND \
  -H "Depth: 1" \
  http://localhost:8800/dav.php/calendars/smarthome/default/

# Mal by vrátiť XML s <d:displayname>SmartHome Events</d:displayname>
```

### 4. Google Calendar Sync

Google Calendar eventy sa automaticky syncujú do Baïkal každých 60 sekúnd:

- **Zdrojový kalendár:** Definovaný v `GOOGLE_CALENDAR_ID` env premennej
- **Sync flow:** Node-RED `tab_calendar_google`
- **Cieľová databáza:** `/var/www/baikal/Specific/db/db.sqlite`

**Logs:**
```bash
docker logs compose-nodered-1 --tail 50 | grep "gcal→baikal"
```

Očakávaný výstup:
```
[gcal→baikal] Prepared 1 CalDAV PUT requests
[gcal→baikal] ✅ Synced: SMH MODE=doma (HTTP 200)
```

---

## 📋 Konfiguračné súbory

### `compose/config/baikal/baikal.yaml`

Automaticky mount-nutý do kontajnera. **Netreba editovať** pri štandardnom použití.

```yaml
system:
  timezone: Europe/Bratislava
  admin_passwordhash: d033e22ae348aeb5660fc2140aec35850c4da997  # admin/admin

database:
  mysql: false
  sqlite_file: Specific/db/db.sqlite
```

### Environment premenné (docker-compose.yml)

```yaml
- BAIKAL_BASE_URL=http://baikal:80/dav.php
- BAIKAL_USER=smarthome
- BAIKAL_PASS=smarthome
- BAIKAL_CAL_ID=default
```

---

## 🔧 Riešenie problémov

### ⚠️ Known Limitation: CalDAV GET Error

**Symptóm:** 
```
curl -u smarthome:smarthome http://localhost:8800/dav.php/calendars/smarthome/default/event.ics
```
Vráti: "The FOLDER containing the DB file is not writable"

**Príčina:** 
Možný bug v Baïkal 0.10.1 - CalDAV PUT operácie fungujú (HTTP 200), ale GET operácie hlásia permissions error aj keď permissions sú správne nastavené.

**Workaround:**
1. **Google→Baïkal sync funguje** - hlavná funkcionalita OK (CalDAV PUT dostáva HTTP 200)
2. **Data sú v databáze** - možno čítať cez PHP PDO:
   ```bash
   docker compose exec baikal php -r "
   \$db = new PDO('sqlite:/var/www/baikal/Specific/db/db.sqlite');
   \$events = \$db->query('SELECT uri, calendardata FROM calendarobjects')->fetchAll();
   print_r(\$events);
   "
   ```
3. **CalDAV klient** - môže fungovať lepšie ako curl (napr. Thunderbird, Evolution, iOS Calendar)
4. **PROPFIND môže fungovať** - zoznam eventov:
   ```bash
   curl -X PROPFIND -u smarthome:smarthome -H "Depth: 1" \
     http://localhost:8800/dav.php/calendars/smarthome/default/
   ```

**Status:** ✅ Sync funguje, ❌ GET cez curl nefunguje (nie kritické pre SmartHome use case)

---

### Permissions Error pri CalDAV GET

**Symptóm:** "The FOLDER containing the DB file is not writable"

**Fix:**
```bash
docker compose exec baikal chmod 775 /var/www/baikal/Specific/db
docker compose exec baikal chmod 664 /var/www/baikal/Specific/db/db.sqlite
docker compose restart baikal
```

### Google eventy sa nesyncujú

**Check:**
1. Env premenné `GOOGLE_CALENDAR_API_KEY` a `GOOGLE_CALENDAR_ID` sú nastavené
2. Google Calendar obsahuje eventy v rozsahu -1 až +7 dní od aktuálneho dátumu
3. Node-RED flow `tab_calendar_google` je aktívny

**Test:**
```bash
# Check Google Calendar API priamo
curl "https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events?key=${API_KEY}&maxResults=5"
```

### User smarthome neexistuje

Po vytvorení user cez web UI, overenie v databáze:

```bash
docker compose exec baikal php -r "
\$db = new PDO('sqlite:/var/www/baikal/Specific/db/db.sqlite');
\$users = \$db->query('SELECT uri, displayname FROM principals')->fetchAll(PDO::FETCH_ASSOC);
print_r(\$users);
"
```

---

## 📦 Backup & Restore

### Backup

```bash
# SQLite databáza
docker compose exec baikal sqlite3 /var/www/baikal/Specific/db/db.sqlite ".backup /tmp/baikal.backup"
docker cp compose-baikal-1:/tmp/baikal.backup ./backups/baikal-$(date +%Y%m%d).sqlite

# Alebo celý volume
docker run --rm -v compose_baikal_data:/data -v $(pwd)/backups:/backup alpine tar czf /backup/baikal-data-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore

```bash
# SQLite restore
docker cp ./backups/baikal-20251229.sqlite compose-baikal-1:/tmp/baikal.backup
docker compose exec baikal sqlite3 /var/www/baikal/Specific/db/db.sqlite ".restore /tmp/baikal.backup"
docker compose restart baikal
```

---

## ✅ Verifikačný checklist

- [ ] Baïkal admin UI je prístupné na http://localhost:8800/admin/
- [ ] Používateľ `smarthome` existuje
- [ ] Kalendár `default` existuje
- [ ] CalDAV PROPFIND vracia eventy
- [ ] Google Calendar sync beží (logy `gcal→baikal ✅`)
- [ ] Node-RED vidí `virt/calendar/events/current` MQTT topic
- [ ] SMH MODE/BOOST/OFFSET eventy sú parsované správne

---

## 📚 Dokumentácia

- **Baïkal docs:** https://sabre.io/baikal/
- **CalDAV spec:** https://datatracker.ietf.org/doc/html/rfc4791
- **Node-RED flow:** `/home/pi/smarthome/flows/nodered/flows.json` (tab_calendar_google)
