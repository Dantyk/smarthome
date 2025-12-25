# Microservices Extraction Plan

## Current State: Monolithic Node-RED (4363 lines)

Node-RED flows.json obsahuje všetku business logiku v jednom súbore, čo spôsobuje:
- Ťažkú maintainability
- Nemožnosť nezávislého deploymentu
- Scaling limitations
- Testing complexity

## Target Architecture: Service-Oriented

```
┌─────────────────────────────────────────────────────────────┐
│                     MQTT Message Broker                      │
│                   (Eclipse Mosquitto)                        │
└──────────────┬──────────────┬──────────────┬────────────────┘
               │              │              │
       ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
       │  Scheduler   │ │  Rules   │ │   Alert     │
       │  Service     │ │  Engine  │ │   Manager   │
       └──────────────┘ └──────────┘ └─────────────┘
```

## Phase 1: Service Identification & Extraction Plan

### Service 1: Scheduler Service
**Responsibility**: Calendar sync + Edge-based scheduling

**Current Flows**:
- `tab_calendar_google` - Google Calendar REST sync
- `3c9175e0418cb802` - Baikal Delta-Sync
- `tab_planner` - Edge-Based Scheduling
- `planner_subflow` - Planner Engine subflow

**Extracted Service**:
```
services/scheduler/
├── package.json
├── src/
│   ├── index.ts              # Main entry point
│   ├── calendar/
│   │   ├── google.ts         # Google Calendar API client
│   │   ├── baikal.ts         # CalDAV client
│   │   └── parser.ts         # DSL parser (SMH MODE=, BOOST, OFFSET)
│   ├── scheduler/
│   │   ├── planner.ts        # Edge-based scheduling logic
│   │   ├── cron.ts           # Cron job management
│   │   └── edge.ts           # Edge calculation
│   └── mqtt/
│       ├── client.ts         # MQTT connection
│       └── topics.ts         # Topic definitions
├── Dockerfile
└── tests/
    ├── calendar.test.ts
    └── scheduler.test.ts
```

**MQTT Interface**:
- **Subscribe**: `cmd/scheduler/refresh`, `cmd/calendar/sync`
- **Publish**: `virt/room/+/target_temp`, `virt/calendar/events/current`

**Technology Stack**:
- **Language**: TypeScript/Node.js
- **Calendar**: caldav-client, googleapis
- **Scheduling**: node-cron, cron-parser
- **MQTT**: mqtt.js

---

### Service 2: Rules Engine
**Responsibility**: Mode resolution + Weather correlation

**Current Flows**:
- `tab_resolver` - Active Modes resolver
- `tab_loader` - modes.yaml loader
- `tab_holidays` - Holiday detection
- `tab_weather` - OpenWeatherMap integration
- `weather_correlation_subflow` - Weather correlation

**Extracted Service**:
```
services/rules-engine/
├── package.json
├── src/
│   ├── index.ts
│   ├── resolver/
│   │   ├── mode-resolver.ts    # Resolve active modes (dow, tod, calendar_tag)
│   │   ├── priority.ts         # Mode priority evaluation
│   │   └── rules.ts            # Rule evaluation engine
│   ├── config/
│   │   ├── loader.ts           # modes.yaml loader
│   │   ├── validator.ts        # JSON schema validation
│   │   └── watcher.ts          # File change watcher
│   ├── weather/
│   │   ├── client.ts           # OpenWeatherMap API
│   │   ├── correlation.ts      # Temperature correlation logic
│   │   └── cache.ts            # Weather data caching
│   └── holidays/
│       ├── detector.ts         # Holiday detection (static + Easter)
│       └── calendar.ts         # Holiday calendar data
├── Dockerfile
└── tests/
    ├── resolver.test.ts
    ├── weather.test.ts
    └── holidays.test.ts
```

**MQTT Interface**:
- **Subscribe**: `virt/calendar/events/current`, `cmd/modes/reload`
- **Publish**: `virt/system/active_mode`, `virt/weather/current`, `virt/weather/forecast`

**Technology Stack**:
- **Language**: TypeScript/Node.js
- **Config**: js-yaml, ajv (JSON schema)
- **Weather**: axios (OpenWeatherMap API)
- **File Watching**: chokidar

---

### Service 3: Alert Manager
**Responsibility**: Safety & security event processing

**Current Flows**:
- `tab_alerts` - Alerts Router & Decision Matrix

**Extracted Service**:
```
services/alert-manager/
├── package.json
├── src/
│   ├── index.ts
│   ├── alerts/
│   │   ├── router.ts           # Route events to handlers
│   │   ├── decision-matrix.ts  # Severity-based decisions
│   │   └── handlers/
│   │       ├── smoke.ts        # Smoke detector handler
│   │       ├── motion.ts       # Motion sensor handler
│   │       └── service.ts      # Service health handler
│   ├── notifications/
│   │   ├── apprise.ts          # Apprise client
│   │   ├── pushover.ts         # Pushover client
│   │   └── templates.ts        # Message templates
│   └── state/
│       └── cooldown.ts         # Alert cooldown logic
├── Dockerfile
└── tests/
    ├── alerts.test.ts
    └── notifications.test.ts
```

**MQTT Interface**:
- **Subscribe**: `event/safety/#`, `event/security/#`, `meta/service/+/online`
- **Publish**: `cmd/notify/push`, `cmd/notify/sms`, `meta/alert/+/status`

**Technology Stack**:
- **Language**: TypeScript/Node.js
- **Notifications**: axios (Apprise API, Pushover)
- **State**: In-memory store with TTL

---

### Service 4: Device Bridge (Keep in Node-RED Initially)
**Responsibility**: Z-Wave/Zigbee device communication

**Current Flows**:
- `tab_zigbee_monitor` - Zigbee device monitor
- Various HVAC control flows

**Rationale for Keeping**:
- Node-RED má native integrácie pre Z-Wave JS UI a Zigbee2MQTT
- Device-specific logic je komplexná
- Benefit z extrakcie je nízky vs. risk

**Future Consideration**: Extract ak Node-RED stane bottleneck

---

## Phase 2: Implementation Roadmap

### Step 1: Shared Libraries (Week 1-2)
```
libs/
├── mqtt-client/        # Reusable MQTT client wrapper
├── schemas/            # Shared JSON schemas & validators
└── types/              # TypeScript type definitions
```

### Step 2: Extract Scheduler Service (Week 3-4)
1. Create service structure
2. Port calendar sync logic from Node-RED
3. Implement edge-based scheduling
4. Write tests (>80% coverage)
5. Dockerize
6. Deploy alongside Node-RED (parallel run)
7. Validate MQTT message parity
8. Remove calendar flows from Node-RED

### Step 3: Extract Rules Engine (Week 5-6)
1. Create service structure
2. Port mode resolver logic
3. Implement weather correlation
4. Write tests
5. Dockerize
6. Deploy and validate
7. Remove resolver flows from Node-RED

### Step 4: Extract Alert Manager (Week 7-8)
1. Create service structure
2. Port alert routing logic
3. Implement notification clients
4. Write tests
5. Dockerize
6. Deploy and validate
7. Remove alert flows from Node-RED

### Step 5: Cleanup & Documentation (Week 9)
1. Remove extracted flows from Node-RED
2. Update architecture diagrams
3. Write migration guide
4. Performance benchmarking

---

## Phase 3: Docker Compose Integration

### New Service Definitions

```yaml
# compose/docker-compose.yml

services:
  scheduler:
    build: ../services/scheduler
    restart: unless-stopped
    depends_on:
      mosquitto:
        condition: service_healthy
    environment:
      - MQTT_BROKER=mosquitto:1883
      - GOOGLE_CALENDAR_API_KEY=${GOOGLE_CLIENT_SECRET}
      - BAIKAL_BASE_URL=http://baikal:80/dav.php
    volumes:
      - ../config:/config:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  rules-engine:
    build: ../services/rules-engine
    restart: unless-stopped
    depends_on:
      mosquitto:
        condition: service_healthy
    environment:
      - MQTT_BROKER=mosquitto:1883
      - OPENWEATHER_API_KEY=${OPENWEATHER_API_KEY}
    volumes:
      - ../config:/config:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  alert-manager:
    build: ../services/alert-manager
    restart: unless-stopped
    depends_on:
      mosquitto:
        condition: service_healthy
    environment:
      - MQTT_BROKER=mosquitto:1883
      - PUSHOVER_USER=${PUSHOVER_USER}
      - PUSHOVER_TOKEN=${PUSHOVER_TOKEN}
      - APPRISE_URL=http://apprise:8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Migration Strategy

### Parallel Deployment (Zero Downtime)

1. **Week 1-2**: Deploy scheduler service alongside Node-RED
   - Both publish to `virt/room/+/target_temp`
   - Monitor for discrepancies
   - Fix bugs in new service
   
2. **Week 3-4**: Switch traffic to scheduler service
   - Update MQTT routing in Node-RED to delegate to service
   - Disable old scheduler flows (but keep code)
   
3. **Week 5-6**: Remove old flows
   - Backup flows.json
   - Delete extracted flows
   - Test extensively
   
4. **Repeat for rules-engine and alert-manager**

### Rollback Plan

Each extraction phase has rollback capability:
```bash
# Rollback scheduler service
docker compose stop scheduler
# Re-enable flows in Node-RED
docker compose restart nodered
```

---

## Testing Strategy

### Integration Tests (Critical)
```typescript
// tests/integration/scheduler-nodered-parity.test.ts

test('Scheduler service produces same MQTT messages as Node-RED', async () => {
  const mqttClient = await connectMQTT();
  
  // Trigger both systems with same calendar event
  const event = createTestEvent('SMH MODE=doma');
  
  // Collect messages from both sources
  const schedulerMessages = await collectMessages('virt/room/+/target_temp', 'scheduler');
  const noderedMessages = await collectMessages('virt/room/+/target_temp', 'nodered');
  
  // Compare payloads
  expect(schedulerMessages).toEqual(noderedMessages);
});
```

### Performance Benchmarking
- Message processing latency (target: <100ms p95)
- Memory usage (target: <256MB per service)
- CPU usage (target: <10% on Raspberry Pi 4)

### Chaos Testing
- Kill services randomly, verify auto-restart
- Simulate MQTT broker downtime
- Network partition tests

---

## Benefits After Extraction

### Scalability
- ✅ Each service independently scalable
- ✅ Horizontal scaling možný (multiple scheduler instances)

### Maintainability
- ✅ Smaller codebases (500-1000 lines vs. 4363)
- ✅ Clear service boundaries
- ✅ Easier onboarding for new developers

### Reliability
- ✅ Service isolation (scheduler crash != rules engine crash)
- ✅ Independent deployments
- ✅ Granular health monitoring

### Development Velocity
- ✅ Parallel development (teams can work on different services)
- ✅ Faster testing (unit test 1 service vs. entire Node-RED)
- ✅ Language flexibility (can use Python for rules-engine if needed)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Message ordering issues** | Critical | Use MQTT QoS 1, timestamp-based deduplication |
| **Increased complexity** | Medium | Comprehensive documentation, observability |
| **Network latency** | Low | Services on same Docker network (low latency) |
| **Debugging difficulty** | Medium | Distributed tracing with trace_id in messages |
| **Resource usage** | Medium | Monitor with Grafana, set resource limits |

---

## Success Criteria

- [ ] All extracted services pass integration tests with 100% parity
- [ ] Node-RED flows reduced by >70% (4363 → <1300 lines)
- [ ] E2E tests pass with new architecture
- [ ] No increase in p95 latency
- [ ] Memory usage per service <256MB
- [ ] Deployment time <2 minutes per service
- [ ] Rollback capability verified in staging

---

## References

- [Martin Fowler: Microservices](https://martinfowler.com/articles/microservices.html)
- [12 Factor App](https://12factor.net/)
- [MQTT Microservices Pattern](https://www.hivemq.com/blog/mqtt-microservices-architecture/)
