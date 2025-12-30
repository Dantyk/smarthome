# Radicale CalDAV Setup

## Používanie

### 1. Vytvorenie udalosti cez API (POST)

Pošli POST request na Node-RED:

```bash
curl -X POST http://localhost:1880/api/calendar/create \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "SMH MODE=doma",
    "start": "2025-12-30T14:00:00+01:00",
    "end": "2025-12-30T16:00:00+01:00",
    "description": "Režim doma počas víkendu"
  }'
```

### 2. Čítanie udalostí

Google Calendar sync pokračuje normálne (60s polling).
Radicale slúži len pre **manuálne vytvorenie** udalostí cez UI.

### 3. CalDAV URL

- **Server**: `http://localhost:5232`
- **Kalendár**: `/smarthome/calendar.ics/`
- **Autentifikácia**: Žiadna (lokálny prístup)

### 4. Test priamo cez CalDAV

```bash
curl -X PUT http://localhost:5232/smarthome/calendar.ics/event-$(date +%s).ics \
  -H "Content-Type: text/calendar" \
  --data 'BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:manual-123
DTSTART:20251230T100000Z
DTEND:20251230T110000Z
SUMMARY:SMH BOOST room=obyvacka temp=22
END:VEVENT
END:VCALENDAR'
```

## Architektúra

```
Google Calendar (read-only) ──┐
                               ├──> Node-RED ──> MQTT ──> Termostaty
Radicale (write-only) ────────┘
        ↑
        └── UI Form (POST /api/calendar/create)
```

**Poznámky:**
- Google Calendar = primárny zdroj (manuálne + zdieľaný)
- Radicale = sekundárny zdroj (len UI-created eventy)
- Obidva zdroje sa mergujú v Node-RED
