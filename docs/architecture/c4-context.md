# C4 Model - System Context Diagram (Level 1)

## SmartHome System Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                            External Systems                             │
│                                                                         │
│  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐ │
│  │ Google Calendar  │     │ OpenWeatherMap   │     │  Pushover API   │ │
│  │   (CalDAV)       │     │   (REST API)     │     │  (Push Notify)  │ │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬────────┘ │
│           │                        │                        │          │
└───────────┼────────────────────────┼────────────────────────┼──────────┘
            │                        │                        │
            │                        │                        │
            ▼                        ▼                        ▼
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                       SmartHome System                                │
│                  (Automated Heating Control)                          │
│                                                                       │
│  Responsibilities:                                                    │
│  - Manage room temperature setpoints based on calendar events        │
│  - Monitor current temperature and humidity from sensors             │
│  - Control HVAC thermostats (Z-Wave, Zigbee)                        │
│  - Provide web UI for manual override and monitoring                │
│  - Send alerts for safety events (smoke, security)                  │
│  - Correlate weather data with heating schedules                    │
│                                                                       │
└───────────┬───────────────────────────────────────────────┬───────────┘
            │                                               │
            │                                               │
            ▼                                               ▼
┌─────────────────────────┐                   ┌─────────────────────────┐
│                         │                   │                         │
│    End Users            │                   │   Physical Devices      │
│                         │                   │                         │
│  - Homeowners           │                   │  - Z-Wave Thermostats   │
│  - Family members       │                   │  - Zigbee Sensors       │
│                         │                   │  - HVAC Controllers     │
│  Interactions:          │                   │  - Smoke Detectors      │
│  - View dashboard       │                   │  - Motion Sensors       │
│  - Set temperatures     │                   │                         │
│  - Create calendar      │                   │  Protocol: MQTT         │
│    events               │                   │  Connection: USB/WiFi   │
│  - Override schedules   │                   │                         │
│                         │                   │                         │
└─────────────────────────┘                   └─────────────────────────┘
```

## Actors & Systems

### Users
- **Homeowners**: Primary users who configure schedules and monitor the system
- **Family Members**: Secondary users who can override temperatures and view status

### External Systems
- **Google Calendar**: Provides calendar events with special tags for mode switching
- **OpenWeatherMap**: Supplies weather data for temperature correlation
- **Pushover**: Delivers push notifications for critical alerts

### Physical Devices
- **Z-Wave Thermostats**: Temperature sensors and HVAC controllers
- **Zigbee Sensors**: Additional temperature, humidity, motion sensors
- **Smoke Detectors**: Safety event sources
- **Motion Sensors**: Security event sources

## Key Interactions

1. **User → SmartHome**: Web UI access, manual commands, calendar event creation
2. **SmartHome → Google Calendar**: Fetch upcoming events, parse DSL commands
3. **SmartHome → OpenWeatherMap**: Retrieve current weather and forecasts
4. **SmartHome → Physical Devices**: Publish MQTT commands, subscribe to sensor data
5. **SmartHome → Pushover**: Send alert notifications for emergencies

## Bounded Context

SmartHome system boundary includes:
- Event processing (calendar, sensors, weather)
- Business logic (mode resolution, scheduling)
- Device control (MQTT command publishing)
- State management (current temperatures, active modes)
- User interface (web dashboard)

External dependencies:
- Calendar storage (Google, Baïkal)
- Weather data provider
- Notification delivery
- Physical device firmware
