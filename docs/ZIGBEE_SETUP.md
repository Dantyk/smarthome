# Zigbee2MQTT Setup

## Hardware Requirements

**CRITICAL**: Zigbee2MQTT vyžaduje USB Zigbee coordinator pripojený k Raspberry Pi.

### Podporované USB Zigbee adaptery:
- **ConBee II** (Texas Instruments CC2652)
- **SONOFF Zigbee 3.0 USB Dongle Plus**
- **Electrolama zzh!** (CC2652R)
- **slaesh's CC2652RB stick**

## Inštalácia

### 1. Pripojenie USB adapteru

```bash
# Over, že systém vidí USB zariadenie
lsusb | grep -i zigbee

# Over, že je vytvorené /dev/ttyUSB0 alebo /dev/ttyACM0
ls -la /dev/ttyUSB* /dev/ttyACM*
```

### 2. Spustenie služby

```bash
cd /home/pi/smarthome/compose
docker compose up -d zigbee2mqtt
```

### 3. Verifikácia

```bash
# Over logy
docker compose logs -f zigbee2mqtt

# Over API endpoint
curl http://localhost:8090/api/devices | jq .
```

### 4. Auto-generovanie dokumentácie

Po úspešnom spustení Zigbee2MQTT aktualizuj device inventory:

```bash
# Stiahni aktuálny zoznam zariadení
curl -s http://localhost:8090/api/devices > docs/zigbee-devices.json

# Over počet zariadení
cat docs/zigbee-devices.json | jq '.devices | length'
```

## Troubleshooting

### Zigbee2MQTT nespustí službu

```bash
# Over prístupové práva k USB portu
sudo usermod -a -G dialout $USER
sudo chmod 666 /dev/ttyUSB0

# Reštartuj službu
docker compose restart zigbee2mqtt
```

### Web UI nie je prístupné (port 8090)

```bash
# Over či je kontajner healthy
docker compose ps zigbee2mqtt

# Over bind portu
netstat -tuln | grep 8090
```

## Node-RED integrácia

Po spustení Zigbee2MQTT sú MQTT topics dostupné na:
- `zigbee2mqtt/<device_friendly_name>` - Device state
- `zigbee2mqtt/<device_friendly_name>/set` - Commands
- `zigbee2mqtt/bridge/info` - Bridge status

Node-RED flows v `/flows/nodered/flows.json` automaticky spracujú nové zariadenia.
