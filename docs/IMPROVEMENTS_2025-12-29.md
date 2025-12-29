# SmartHome - Plán Vylepšení (29.12.2025)

## 🎯 Prehľad

Tento dokument obsahuje konkrétne vylepšenia pre SmartHome projekt založené na dôkladnom audite.

**Status projektu:** ✅ Production-Ready (92% služieb healthy)  
**Celkové hodnotenie:** 8.8/10 - Profesionálne spracovaný projekt s priestorom na vylepšenia

---

## 📋 Prioritizované Úlohy

### 🔴 Vysoká Priorita (1-2 týždne)

#### 1. Security Hardening

**Problém:** 6 critical + 6 high NPM vulnerabilities v Node-RED, 1 critical + 2 high v UI

**Riešenie:**
```bash
# Aktualizovať závislosti
cd /home/pi/smarthome/ui/smarthome-ui
npm update next react react-dom
npm audit fix --force

cd /home/pi/smarthome/flows/nodered
npm update
npm audit fix

# Nastaviť automatické scany
# File: .github/workflows/security-scan.yml
```

**Implementácia:**
- [ ] Spustiť `npm update` v UI a Node-RED
- [ ] Otestovať že všetky flows fungujú po update
- [ ] Nastaviť GitHub Dependabot pre automatické PR
- [ ] Pridať weekly security scan do CI/CD

**Časová náročnosť:** 2-3 hodiny

---

#### 2. Monitoring - Kritické Alerty

**Problém:** Chýbajú alerty pre disk space, container restarts, system resources

**Riešenie:**
```yaml
# File: compose/config/prometheus/alerts.yml

groups:
  - name: system_critical
    interval: 1m
    rules:
      # Disk space monitoring
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.15
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Kriticky nízky diskový priestor (< 15%)"
          description: "Zostáva {{ $value | humanizePercentage }} voľného miesta"

      # Container restart tracking
      - alert: ContainerRestarting
        expr: rate(docker_container_restarts_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kontajner {{ $labels.name }} sa opakuje reštartuje"
          description: "{{ $value }} reštartov za posledných 5 minút"

      # Memory pressure
      - alert: HighMemoryUsage
        expr: (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) < 0.10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Vysoké využitie RAM (< 10% voľnej)"
          description: "Zostáva {{ $value | humanizePercentage }} voľnej pamäte"

      # CPU overload
      - alert: HighCPULoad
        expr: (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))) > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Vysoké zaťaženie CPU (> 85%)"
          description: "CPU load: {{ $value | humanizePercentage }}"

      # Temperature monitoring (Raspberry Pi)
      - alert: HighTemperature
        expr: node_hwmon_temp_celsius > 70
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Vysoká teplota Raspberry Pi"
          description: "Teplota: {{ $value }}°C (limit 70°C)"
```

**Implementácia:**
- [ ] Pridať Node Exporter do docker-compose.yml
- [ ] Konfigurovať alerty v prometheus/alerts.yml
- [ ] Otestovať triggery (simulovať disk full, high CPU)
- [ ] Overiť notifikácie v Alertmanager

**Časová náročnosť:** 3-4 hodiny

**Node Exporter setup:**
```yaml
# File: compose/docker-compose.yml

services:
  node-exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    command:
      - '--path.rootfs=/host'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /:/host:ro,rslave
    ports:
      - "9100:9100"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9100/metrics"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

### 🟡 Stredná Priorita (2-4 týždne)

#### 3. Energy Management - Úsporný Režim

**Cieľ:** Znížiť náklady na vykurovanie o 15-20% bez straty komfortu

**Riešenie:**
```yaml
# File: config/modes.yaml

# Nový energy management
energy_profiles:
  STANDARD:
    max_concurrent_rooms: null  # bez limitu
    priority: [obyvacka, spalna, detska, kuchyna, kupelna]
  
  EKONOMICKY:
    max_concurrent_rooms: 3  # vykuruj max 3 miestnosti naraz
    priority: [obyvacka, spalna, detska, kuchyna, kupelna]
    power_limit_watts: 2000
    temp_offset: -0.5  # znížiť všetky teploty o 0.5°C
  
  ULTRA_ECO:
    max_concurrent_rooms: 2
    priority: [spalna, obyvacka]
    power_limit_watts: 1500
    temp_offset: -1.0

# Cenová optimalizácia (hodinové tarify)
electricity_pricing:
  enabled: true
  high_tariff:
    hours: ["07:00-09:00", "17:00-21:00"]
    max_power_watts: 1500  # limit počas high tariff
  low_tariff:
    hours: ["21:00-07:00"]
    allow_preheating: true  # predohrej pred ránom

# Safety limits
safety:
  min_temp_emergency: 5.0  # alarm ak padne pod 5°C (risk of frozen pipes)
  max_humidity_alert: 70.0  # kondenzácia, pleseň
  max_heating_hours_per_day: 18  # ochrana ventilov
  consecutive_failures_limit: 5  # vypni HVAC pri chybách
```

**Node-RED flow logic:**
```javascript
// File: flows/nodered/lib/energy-manager.js

class EnergyManager {
  constructor(config) {
    this.config = config;
    this.activeRooms = new Set();
    this.powerConsumption = 0;
  }

  canActivateRoom(roomName) {
    const profile = this.config.energy_profiles[global.energyMode];
    
    // Check concurrent room limit
    if (profile.max_concurrent_rooms && 
        this.activeRooms.size >= profile.max_concurrent_rooms) {
      return false;
    }
    
    // Check power limit
    const roomPower = this.getRoomPowerConsumption(roomName);
    if (profile.power_limit_watts && 
        this.powerConsumption + roomPower > profile.power_limit_watts) {
      return false;
    }
    
    // Check tariff rules
    if (this.isHighTariffPeriod() && 
        this.powerConsumption + roomPower > this.config.electricity_pricing.high_tariff.max_power_watts) {
      return false;
    }
    
    return true;
  }

  prioritizeRooms(requestedRooms) {
    const profile = this.config.energy_profiles[global.energyMode];
    
    // Sort rooms by priority
    return requestedRooms.sort((a, b) => {
      const aPriority = profile.priority.indexOf(a);
      const bPriority = profile.priority.indexOf(b);
      return aPriority - bPriority;
    });
  }

  isHighTariffPeriod() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return this.config.electricity_pricing.high_tariff.hours.some(range => {
      const [start, end] = range.split('-');
      return currentTime >= start && currentTime < end;
    });
  }
}

module.exports = EnergyManager;
```

**Implementácia:**
- [ ] Pridať energy_profiles do modes.yaml
- [ ] Implementovať EnergyManager class
- [ ] Vytvoriť Node-RED flow pre power limiting
- [ ] Pridať UI toggle pre EKONOMICKY/ULTRA_ECO režim
- [ ] Otestovať s rôznymi scénármi

**Časová náročnosť:** 8-10 hodín

---

#### 4. Inteligentná Optimalizácia - Window Detection

**Cieľ:** Automaticky detekovať otvorené okná a vypnúť vykurovanie

**Riešenie:**
```javascript
// File: flows/nodered/lib/window-detector.js

class WindowDetector {
  constructor(tempThreshold = -2.0, timeWindowMinutes = 5) {
    this.threshold = tempThreshold;  // °C drop
    this.timeWindow = timeWindowMinutes * 60 * 1000;
    this.roomHistory = new Map();
  }

  checkForOpenWindow(roomName, currentTemp, timestamp) {
    if (!this.roomHistory.has(roomName)) {
      this.roomHistory.set(roomName, []);
    }
    
    const history = this.roomHistory.get(roomName);
    history.push({ temp: currentTemp, time: timestamp });
    
    // Keep only recent history
    const cutoff = timestamp - this.timeWindow;
    const recent = history.filter(h => h.time > cutoff);
    this.roomHistory.set(roomName, recent);
    
    if (recent.length < 2) return false;
    
    // Calculate temp drop rate
    const oldest = recent[0];
    const tempDrop = oldest.temp - currentTemp;
    const timeDelta = (timestamp - oldest.time) / 1000 / 60; // minutes
    
    // Rapid drop indicates open window
    // e.g., -2°C in 5 minutes = -0.4°C/min (typical open window)
    if (tempDrop >= Math.abs(this.threshold)) {
      return {
        detected: true,
        tempDrop: tempDrop.toFixed(1),
        timeMinutes: timeDelta.toFixed(1),
        action: 'disable_hvac'
      };
    }
    
    return { detected: false };
  }

  reset(roomName) {
    this.roomHistory.delete(roomName);
  }
}

module.exports = WindowDetector;
```

**Node-RED flow:**
```
[MQTT stat/room/temp] 
  → [Window Detector Function]
  → [Switch: if window detected]
      → [MQTT cmd/room/hvac = OFF]
      → [Send notification: "Okno otvorené v {room}"]
      → [Set override mode for 30 min]
```

**UI notifikácia:**
```typescript
// File: ui/smarthome-ui/src/components/WindowAlert.tsx

export function WindowAlert({ room }: { room: string }) {
  return (
    <div className="alert alert-warning">
      <span className="icon">⚠️</span>
      <span>Detekované otvorené okno v miestnosti: <strong>{room}</strong></span>
      <button onClick={() => dismissAlert(room)}>Zavrieť</button>
      <button onClick={() => forceHVAC(room)}>Vykurovať napriek</button>
    </div>
  );
}
```

**Implementácia:**
- [ ] Vytvoriť WindowDetector class
- [ ] Pridať Node-RED flow pre každú miestnosť
- [ ] Implementovať UI alert komponent
- [ ] Otestovať s otvorenými oknami (real-world test)
- [ ] Fine-tune threshold parametre

**Časová náročnosť:** 6-8 hodín

---

#### 5. Preheating Optimization - ML Model

**Cieľ:** Predpovedať čas potrebný na ohriatie miestnosti a spustiť vykurovanie včas

**Riešenie:**
```python
# File: flows/nodered/ml/preheating_model.py

import numpy as np
from sklearn.linear_model import LinearRegression
import pickle

class PreheatingModel:
    """
    Predikčný model pre čas potrebný na ohriatie miestnosti.
    
    Features:
    - current_temp: Aktuálna teplota
    - target_temp: Cieľová teplota
    - outdoor_temp: Vonkajšia teplota
    - thermal_mass: Tepelná kapacita miestnosti (m³)
    - hvac_power: Výkon kW
    """
    
    def __init__(self):
        self.model = LinearRegression()
        self.is_trained = False
    
    def train(self, historical_data):
        """
        Train model on historical heating events.
        
        Args:
            historical_data: List of dicts with keys:
                - current_temp, target_temp, outdoor_temp, thermal_mass, hvac_power
                - heating_time_minutes (label)
        """
        X = np.array([[
            d['current_temp'],
            d['target_temp'],
            d['outdoor_temp'],
            d['thermal_mass'],
            d['hvac_power']
        ] for d in historical_data])
        
        y = np.array([d['heating_time_minutes'] for d in historical_data])
        
        self.model.fit(X, y)
        self.is_trained = True
    
    def predict_heating_time(self, current_temp, target_temp, outdoor_temp, 
                            thermal_mass=50, hvac_power=2.0):
        """
        Predict minutes needed to reach target temperature.
        
        Returns:
            int: Estimated minutes to reach target temp
        """
        if not self.is_trained:
            # Fallback to simple heuristic
            temp_diff = target_temp - current_temp
            # Assume 1°C per 10 minutes for 50m³ room with 2kW heater
            return max(0, int(temp_diff * 10 * (thermal_mass / 50) / (hvac_power / 2)))
        
        features = np.array([[current_temp, target_temp, outdoor_temp, thermal_mass, hvac_power]])
        prediction = self.model.predict(features)[0]
        return max(0, int(prediction))
    
    def save(self, filepath):
        with open(filepath, 'wb') as f:
            pickle.dump(self.model, f)
    
    def load(self, filepath):
        with open(filepath, 'rb') as f:
            self.model = pickle.load(f)
            self.is_trained = True

# Usage in Node-RED
if __name__ == '__main__':
    model = PreheatingModel()
    
    # Example: Predict for living room at 18°C → 21°C, outdoor -5°C
    minutes = model.predict_heating_time(
        current_temp=18.0,
        target_temp=21.0,
        outdoor_temp=-5.0,
        thermal_mass=60,  # living room size
        hvac_power=2.5
    )
    print(f"Estimated heating time: {minutes} minutes")
```

**Node-RED integration:**
```javascript
// Function node: Calculate Preheat Start Time

const { PythonShell } = require('python-shell');

const currentTemp = msg.payload.temp;
const targetTemp = msg.payload.target;
const outdoorTemp = global.get('weather').temp;
const scheduledTime = new Date(msg.payload.scheduled_time);

// Call Python ML model
PythonShell.run('ml/preheating_model.py', {
  args: [currentTemp, targetTemp, outdoorTemp]
}, (err, results) => {
  if (err) {
    // Fallback heuristic
    const tempDiff = targetTemp - currentTemp;
    const estimatedMinutes = tempDiff * 10;
    msg.preheat_start = new Date(scheduledTime - estimatedMinutes * 60 * 1000);
  } else {
    const estimatedMinutes = parseInt(results[0]);
    msg.preheat_start = new Date(scheduledTime - estimatedMinutes * 60 * 1000);
  }
  
  node.send(msg);
});
```

**Implementácia:**
- [ ] Implementovať Python PreheatingModel class
- [ ] Zbierať historical data (temp logs, heating events)
- [ ] Natrénovať model na 1 týždeň dát
- [ ] Integrovať do Node-RED calendar flow
- [ ] Otestovať presnosť predikcií
- [ ] Fine-tune pre každú miestnosť

**Časová náročnosť:** 12-15 hodín (vrátane data collection)

**Dependencies:**
```bash
# Install in Node-RED container
npm install python-shell

# Python packages (add to Dockerfile)
pip install numpy scikit-learn
```

---

### 🟢 Nízka Priorita (1-2 mesiace)

#### 6. Mobile PWA - Progressive Web App

**Cieľ:** Offline support, push notifikácie, install to home screen

**Riešenie:**
```typescript
// File: ui/smarthome-ui/src/app/manifest.json

{
  "name": "SmartHome Control",
  "short_name": "SmartHome",
  "description": "Ovládanie domáceho vykurovania",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

```typescript
// File: ui/smarthome-ui/src/app/sw.ts (Service Worker)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('smarthome-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/styles/globals.css',
        '/api/rooms',
        '/api/mode',
        '/api/status'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag,
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

**Push Notification API:**
```typescript
// File: ui/smarthome-ui/src/app/api/notifications/subscribe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// Setup VAPID keys (generate once)
webpush.setVapidDetails(
  'mailto:admin@smarthome.local',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const subscription = await req.json();
  
  // Store subscription in database/redis
  await redis.set(`push:${subscription.endpoint}`, JSON.stringify(subscription));
  
  return NextResponse.json({ success: true });
}
```

**Trigger notifications from Node-RED:**
```javascript
// Function node: Send Push Notification

const webpush = require('web-push');

const subscriptions = await redis.keys('push:*');

for (const key of subscriptions) {
  const subscription = JSON.parse(await redis.get(key));
  
  await webpush.sendNotification(subscription, JSON.stringify({
    title: 'Nízka teplota!',
    body: `Spálňa: ${msg.payload.temp}°C (cieľ: ${msg.payload.target}°C)`,
    tag: 'low-temp-spalna',
    url: '/rooms/spalna'
  }));
}
```

**Implementácia:**
- [ ] Pridať manifest.json a service worker
- [ ] Implementovať push notification subscribe API
- [ ] Generovať VAPID keys
- [ ] Vytvoriť Node-RED flow pre notifications
- [ ] Otestovať offline mode
- [ ] Otestovať push notifikácie na mobile

**Časová náročnosť:** 10-12 hodín

---

#### 7. Voice Control - Google Assistant Integration

**Cieľ:** Ovládanie hlasovými príkazmi cez Google Assistant

**Riešenie:**
```typescript
// File: ui/smarthome-ui/src/app/api/google-home/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mqttClient } from '@/lib/mqtt';

// Google Smart Home Action handler
export async function POST(req: NextRequest) {
  const body = await req.json();
  
  switch (body.inputs[0].intent) {
    case 'action.devices.SYNC':
      return handleSync();
    
    case 'action.devices.QUERY':
      return handleQuery(body);
    
    case 'action.devices.EXECUTE':
      return handleExecute(body);
  }
}

function handleSync() {
  return NextResponse.json({
    requestId: crypto.randomUUID(),
    payload: {
      agentUserId: 'smarthome-user-123',
      devices: [
        {
          id: 'spalna',
          type: 'action.devices.types.THERMOSTAT',
          traits: [
            'action.devices.traits.TemperatureSetting'
          ],
          name: {
            defaultNames: ['Spálňa Termostat'],
            name: 'Spálňa',
            nicknames: ['spálňa', 'bedroom']
          },
          willReportState: true,
          attributes: {
            availableThermostatModes: ['heat', 'off'],
            thermostatTemperatureUnit: 'C'
          }
        },
        // ... other rooms
      ]
    }
  });
}

function handleExecute(body) {
  const command = body.inputs[0].payload.commands[0];
  const device = command.devices[0];
  const execution = command.execution[0];
  
  if (execution.command === 'action.devices.commands.ThermostatTemperatureSetpoint') {
    const targetTemp = execution.params.thermostatTemperatureSetpoint;
    
    // Publish MQTT command
    mqttClient.publish(`cmd/${device.id}/temp`, targetTemp.toString());
    
    return NextResponse.json({
      requestId: body.requestId,
      payload: {
        commands: [{
          ids: [device.id],
          status: 'SUCCESS',
          states: {
            thermostatTemperatureSetpoint: targetTemp
          }
        }]
      }
    });
  }
}
```

**Google Cloud Setup:**
1. Vytvoriť Google Cloud projekt
2. Povoliť Smart Home API
3. Nakonfigurovať OAuth2 (pre account linking)
4. Nastaviť webhook URL: `https://smarthome.local/api/google-home`
5. Otestovať cez Google Home app

**Voice Commands:**
- "OK Google, nastav teplotu v spálni na 22 stupňov"
- "OK Google, aká je teplota v obývačke?"
- "OK Google, vypni vykurovanie v detskej"

**Implementácia:**
- [ ] Vytvoriť Google Cloud projekt a Smart Home action
- [ ] Implementovať SYNC/QUERY/EXECUTE endpointy
- [ ] Nakonfigurovať OAuth2 account linking
- [ ] Expose UI na internet (Cloudflare Tunnel / Tailscale)
- [ ] Otestovať hlasové príkazy

**Časová náročnosť:** 8-10 hodín

**Security Note:** Vyžaduje expose na internet! Použiť Cloudflare Tunnel alebo Tailscale VPN.

---

#### 8. Geofencing - Automatic Away Mode

**Cieľ:** Automaticky prepnúť do PREČ režimu keď všetci odídu z domu

**Riešenie:**
```typescript
// File: ui/smarthome-ui/src/app/api/geofence/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { mqttClient } from '@/lib/mqtt';

// Haversine distance formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in meters
}

export async function POST(req: NextRequest) {
  const { userId, latitude, longitude } = await req.json();
  
  const HOME_LAT = parseFloat(process.env.HOME_LATITUDE!);
  const HOME_LON = parseFloat(process.env.HOME_LONGITUDE!);
  const GEOFENCE_RADIUS = 200; // meters
  
  const distance = calculateDistance(latitude, longitude, HOME_LAT, HOME_LON);
  const isHome = distance < GEOFENCE_RADIUS;
  
  // Update user presence in Redis
  await redis.hset('presence', userId, isHome ? 'home' : 'away');
  
  // Check if anyone is home
  const allUsers = await redis.hgetall('presence');
  const anyoneHome = Object.values(allUsers).some(status => status === 'home');
  
  // Auto-switch mode if everyone left
  if (!anyoneHome) {
    mqttClient.publish('cmd/mode', 'PREČ');
    
    // Send notification
    await sendPushNotification({
      title: 'Auto PREČ režim',
      body: 'Všetci opustili domov. Prepínam na úsporný režim.',
      tag: 'auto-away'
    });
  } else if (isHome && allUsers[userId] === 'away') {
    // Someone returned home
    mqttClient.publish('cmd/mode', 'DOMA');
    
    await sendPushNotification({
      title: 'Vítaj doma!',
      body: 'Prepínam na komfortný režim.',
      tag: 'auto-home'
    });
  }
  
  return NextResponse.json({ success: true, isHome, distance });
}
```

**Mobile App Integration (React Native / Flutter):**
```typescript
// Mobile app: Send location updates every 5 minutes

import * as Location from 'expo-location';
import { useEffect } from 'react';

export function useGeofencing(userId: string) {
  useEffect(() => {
    const interval = setInterval(async () => {
      const { coords } = await Location.getCurrentPositionAsync({});
      
      await fetch('https://smarthome.local/api/geofence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          latitude: coords.latitude,
          longitude: coords.longitude
        })
      });
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [userId]);
}
```

**Implementácia:**
- [ ] Pridať geofence API endpoint
- [ ] Implementovať presence tracking v Redis
- [ ] Vytvoriť mobile app (alebo použiť Home Assistant app)
- [ ] Otestovať auto-away/auto-home transitions
- [ ] Fine-tune geofence radius

**Časová náročnosť:** 12-15 hodín (vrátane mobile app)

---

## 📊 Zhrnutie Časovej Náročnosti

| Priorita | Úloha | Hodiny | Benefit |
|----------|-------|--------|---------|
| 🔴 Vysoká | Security Hardening | 2-3h | Kritické bezpečnostné opravy |
| 🔴 Vysoká | Monitoring Alerty | 3-4h | Prevencie výpadkov, early warning |
| 🟡 Stredná | Energy Management | 8-10h | 15-20% úspora nákladov |
| 🟡 Stredná | Window Detection | 6-8h | Auto-optimalizácia, úspora energie |
| 🟡 Stredná | Preheating ML Model | 12-15h | Lepší komfort, presné časovanie |
| 🟢 Nízka | Mobile PWA | 10-12h | Lepší UX, offline support |
| 🟢 Nízka | Voice Control | 8-10h | Hands-free ovládanie |
| 🟢 Nízka | Geofencing | 12-15h | Auto-away, convenience |

**Celkom:** 61-77 hodín (1.5-2 mesiace part-time práce)

---

## 🎯 Odporúčaný Roadmap

### Týždeň 1-2: Security & Stability
- [x] Security audit (hotovo)
- [ ] NPM updates (2-3h)
- [ ] Monitoring alerty (3-4h)
- [ ] Node Exporter setup (1-2h)

### Týždeň 3-4: Energy Optimization
- [ ] Energy Management profily (8-10h)
- [ ] Window Detection (6-8h)

### Mesiac 2: Intelligence
- [ ] Preheating ML model (12-15h)
- [ ] Historical data collection (ongoing)

### Mesiac 3+: UX Enhancements
- [ ] Mobile PWA (10-12h)
- [ ] Voice Control (8-10h)
- [ ] Geofencing (12-15h)

---

## 📝 Poznámky

- **Quick wins:** Security updates + Monitoring alerty = 5-7h, veľký benefit
- **Najväčší ROI:** Energy Management (8-10h práce, 15-20% úspora ročne)
- **Longest term:** ML model vyžaduje 1-2 týždne data collection
- **Optional:** Voice Control a Geofencing vyžadujú internet exposure (zvážiť bezpečnosť)

---

**Pripravené:** 29.12.2025  
**Autor:** GitHub Copilot  
**Projekt:** SmartHome v1.0
