# MQTT Topics Reference

## Topic Hierarchy

```
/
├── virt/          # Virtual topics (internal state)
├── stat/          # Status topics (device → system)
├── cmd/           # Command topics (system → device)
├── event/         # Event topics (alerts, triggers)
└── meta/          # Metadata topics (health, version)
```

## Topic Catalog

### Virtual Topics (virt/*)

Interné topics pre stav systému, nie sú priamo publikované zariadeniami.

| Topic | Payload Schema | Retained | Description |
|-------|----------------|----------|-------------|
| `virt/room/{room}/target_temp` | `{ value: number, source: string }` alebo `number` | ✅ | Cieľová teplota pre miestnosť |
| `virt/room/{room}/enabled` | `boolean` alebo `"true"/"false"` | ✅ | HVAC zapnuté/vypnuté |
| `virt/boost/{room}/minutes` | `integer` (0-480) | ✅ | Zostávajúce minúty boost režimu |
| `virt/boost/{room}/target_temp` | `number` (10-30) | ✅ | Teplota v boost režime |
| `virt/system/active_mode` | `string` | ✅ | Aktívny režim (doma, praca, spanok, ...) |
| `virt/weather/current` | `{ temp, description, icon, ... }` | ✅ | Aktuálne počasie |
| `virt/weather/forecast` | `[{ time, temp, icon }]` | ✅ | Predpoveď na 24h |
| `virt/calendar/events/current` | `[{ start, end, summary, mode }]` | ✅ | Aktuálne kalendárne udalosti |

### Status Topics (stat/*)

Topics publikované zariadeniami alebo senzormi.

| Topic | Payload Schema | Retained | Description |
|-------|----------------|----------|-------------|
| `stat/hvac/{room}/current_temp` | `number` | ✅ | Aktuálna nameraná teplota |
| `stat/hvac/{room}/humidity` | `number` (0-100) | ✅ | Relatívna vlhkosť vzduchu |
| `stat/hvac/{room}/enabled` | `boolean` | ✅ | HVAC stav (z termostatu) |
| `stat/sensor/{room}/battery` | `number` (0-100) | ✅ | Stav batérie senzora |
| `stat/device/{id}/online` | `boolean` | ✅ | Zariadenie online/offline |

### Command Topics (cmd/*)

Topics pre príkazy smerom k zariadeniam.

| Topic | Payload Schema | Retained | Description |
|-------|----------------|----------|-------------|
| `cmd/room/{room}/set_target` | `{ value: number, source: string, trace_id: uuid }` | ❌ | Príkaz na nastavenie teploty |
| `cmd/hvac/{room}/setpoint` | `number` alebo `{ value: number }` | ❌ | Priamy setpoint pre termostat |
| `cmd/hvac/{room}/enable` | `boolean` | ❌ | Zapnúť/vypnúť HVAC |
| `cmd/system/refresh_state` | `{ source: string }` | ❌ | Požiadavka na refresh všetkých stavov |

### Event Topics (event/*)

Topics pre udalosti (alerty, bezpečnostné eventy).

| Topic | Payload Schema | Retained | Description |
|-------|----------------|----------|-------------|
| `event/safety/smoke/{room}` | `{ detected: bool, severity: string, timestamp }` | ❌ | Dym detekovaný |
| `event/security/motion/{room}` | `{ detected: bool, location, timestamp }` | ❌ | Pohyb detekovaný |
| `event/system/error` | `{ code: string, message: string, component }` | ❌ | Systémová chyba |

### Metadata Topics (meta/*)

Topics pre metadata služieb (health checks, verzie).

| Topic | Payload Schema | Retained | Description |
|-------|----------------|----------|-------------|
| `meta/service/{name}/online` | `boolean` alebo `{ online: bool, version, uptime }` | ✅ | Service heartbeat |
| `meta/service/{name}/version` | `string` | ✅ | Verzia služby |
| `meta/service/{name}/last_seen` | `timestamp` | ✅ | Posledný heartbeat |

## Topic Naming Conventions

### Room Identifiers
- `spalna` - Spálňa
- `detska` - Detská izba
- `obyvacka` - Obývačka
- `kuchyna` - Kuchyňa
- `kupelna` - Kúpeľňa

### Service Names
- `nodered` - Node-RED orchestrator
- `mosquitto` - MQTT broker
- `baikal` - CalDAV server
- `google_calendar` - Google Calendar sync
- `weather` - Weather service
- `zwavejsui` - Z-Wave controller
- `zigbee2mqtt` - Zigbee coordinator

## QoS Levels

- **QoS 0** (At most once): Event topics, non-critical logs
- **QoS 1** (At least once): Command topics, alerts
- **QoS 2** (Exactly once): Critical safety events (smoke, emergency)

## Retained Messages

Retained messages (✅) sú vhodné pre:
- Stavové informácie (teplota, enabled/disabled)
- Konfiguračné hodnoty (active_mode)
- Service health status

Neretained messages (❌) sú vhodné pre:
- Príkazy (set_target, refresh)
- Udalosti (smoke detected, motion)
- Logy a diagnostiku

## Schema Validation

Všetky MQTT messages sú validované proti JSON schemám v [`config/mqtt-schemas.json`](../../config/mqtt-schemas.json).

Validácia je implementovaná v Node-RED pomocí [`mqtt_schema_validator.js`](../../flows/nodered/lib/mqtt_schema_validator.js).

## Examples

### Set Room Temperature
```javascript
publish('cmd/room/spalna/set_target', {
  value: 22,
  source: 'ui',
  trace_id: 'abc-123-def',
  timestamp: '2025-12-25T10:30:00Z'
});
```

### Subscribe to All Room Temperatures
```javascript
subscribe('stat/hvac/+/current_temp', (topic, message) => {
  const room = topic.split('/')[2];
  const temp = parseFloat(message.toString());
  console.log(`${room}: ${temp}°C`);
});
```

### Smoke Alert
```javascript
publish('event/safety/smoke/kuchyna', {
  detected: true,
  severity: 'emergency',
  location: 'kuchyna',
  timestamp: new Date().toISOString()
});
```
