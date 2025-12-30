**POST /api/calendar/create** - Vytvoriť novú udalosť v Radicale CalDAV

**Request body:**
```json
{
  "summary": "SMH MODE=doma",
  "start": "2025-12-30T10:00:00+01:00",
  "end": "2025-12-30T12:00:00+01:00",
  "description": "Optional description"
}
```

**Flow:**
1. HTTP POST node `/api/calendar/create`
2. Function: Generate iCalendar (ICS) format
3. HTTP Request: PUT to Radicale CalDAV
4. Response: Success/Error

**ICS Template:**
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SmartHome//Manual Event//EN
BEGIN:VEVENT
UID:{uuid}
DTSTAMP:{now}
DTSTART:{start}
DTEND:{end}
SUMMARY:{summary}
DESCRIPTION:{description}
END:VEVENT
END:VCALENDAR
```
