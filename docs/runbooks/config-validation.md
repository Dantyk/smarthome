# Config Validation pre modes.yaml

Tento script validuje modes.yaml konfiguráciu pred štartom služieb.

## Použitie

```bash
# Standalone validácia
cd /home/pi/smarthome
node scripts/validate-config.js

# V Docker Compose (automaticky pri štarte)
docker compose up -d
```

## Čo sa kontroluje

1. **JSON Schema validácia**:
   - Štruktúra modes.yaml zodpovedá modes.schema.json
   - Všetky povinné polia sú vyplnené
   - Typy hodnôt sú správne

2. **Sémantická validácia**:
   - Žiadne duplicitné názvy režimov
   - Target teploty v rozsahu 10-30°C
   - Priority sú čísla 1-100
   - Dátumové rozsahy sú platné

3. **Upozornenia**:
   - Režimy s rovnakou prioritou
   - Režimy bez časových obmedzení

## Exit kódy

- `0` - Konfigurácia je platná
- `1` - Validácia zlyhala (kritická chyba)

## Príklad výstupu

```
✅ modes.yaml validated successfully
✅ Validated 5 modes
⚠️  Modes "vacation" and "away" have same priority 50
```

## Integrácia s Node-RED

Node-RED by mal spúšťať tento script pri:
- Štarte kontajnera (docker-entrypoint.sh)
- Zmene modes.yaml (file watcher)
- Manuálnom reload (cez MQTT cmd/system/reload_config)

## Príklad Docker entrypoint

```bash
#!/bin/bash
set -e

# Validate config before starting Node-RED
node /data/scripts/validate-config.js

# Start Node-RED
exec npm start -- --userDir /data
```
