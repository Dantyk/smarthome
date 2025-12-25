# 🔍 Architecture Review - Identifikované Medzery

## Kritické Chýbajúce Komponenty

### 1. ❌ MISSING: Centralized Logging System

**Problém**: Console.log všade, žiadna centralizácia
```typescript
// Aktuálne
console.log('[UI] Weather received:', raw);  // Stratí sa po reštarte
console.error('[MQTT] Handler error:', err); // Žiadny kontext
```

**Riešenie**: Structured logging s Winston/Pino
```typescript
// Správne
logger.info('weather_received', { 
  source: 'openweathermap',
  temp: data.temp,
  trace_id: msg.trace_id 
});
```

**Chýba**:
- `libs/logger/` - shared logger library
- `services/log-collector/` - centrálny log agregátor
- Log rotation policy
- Log levels per environment (dev=debug, prod=warn)

---

### 2. ❌ MISSING: Distributed Tracing Implementation

**Problém**: Trace IDs sú definované v commands.ts, ale nikde nesledované

**Riešenie**:
```
services/tracer/
├── src/
│   ├── middleware.ts      # MQTT message interceptor
│   ├── correlator.ts      # Trace ID propagation
│   └── collector.ts       # Export to Jaeger/Zipkin
└── Dockerfile
```

**Use Case**:
```
[trace_id: abc-123]
  UI → cmd/room/spalna/set_target
    → Node-RED resolver
      → virt/room/spalna/target_temp
        → cmd/hvac/spalna/setpoint
          → Thermostat ACK
```

---

### 3. ❌ MISSING: Error Handling Middleware

**Problém**: Silent failures všade
```typescript
// ui/smarthome-ui/src/hooks/useMqttSubscriptions.ts:191
} catch (e) {
  console.warn('[UI] Active mode parse failed:', e);  // A čo ďalej?
}
```

**Riešenie**: Global error handler
```typescript
class MqttError extends Error {
  constructor(
    message: string,
    public topic: string,
    public payload: unknown,
    public cause?: Error
  ) {
    super(message);
  }
}

// Error boundary
try {
  parseWeather(msg);
} catch (err) {
  errorHandler.capture(new MqttError('Weather parse failed', topic, msg, err));
  // Fallback: use last known good value
  useLastKnownWeather();
}
```

---

### 4. ❌ MISSING: Rate Limiting & Backpressure

**Problém**: Žiadna ochrana proti MQTT message flood

**Riešenie**:
```typescript
// libs/mqtt-middleware/rate-limiter.ts
const limiter = new RateLimiter({
  'cmd/room/+/set_target': { max: 10, window: '1m' },  // Max 10 zmien/min na miestnosť
  'event/safety/#': { max: 100, window: '1m' }         // Max 100 safety events/min
});

limiter.check(topic, () => {
  // Publish message
});
```

---

### 5. ❌ MISSING: API Authentication & Authorization

**Problém**: API endpoints sú kompletne otvorené
```typescript
// /api/rooms/[room]/route.ts
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  // ❌ Žiadna autentifikácia!
  publish(`cmd/room/${room}/set_target`, body);
}
```

**Riešenie**:
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // Check API key or JWT
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || !isValidKey(apiKey)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
}

export const config = {
  matcher: '/api/:path*'
};
```

---

### 6. ❌ MISSING: MQTT Message Deduplication

**Problém**: Retained messages + reconnect = duplicates

**Riešenie**:
```typescript
// libs/mqtt-middleware/deduplicator.ts
class MessageDeduplicator {
  private seen = new Map<string, number>(); // topic:hash -> timestamp
  
  isDuplicate(topic: string, payload: Buffer): boolean {
    const hash = this.hash(payload);
    const key = `${topic}:${hash}`;
    const lastSeen = this.seen.get(key);
    
    if (lastSeen && Date.now() - lastSeen < 5000) {
      return true; // Duplicate within 5s
    }
    
    this.seen.set(key, Date.now());
    return false;
  }
}
```

---

### 7. ❌ MISSING: Config Validation on Startup

**Problém**: modes.yaml môže byť invalid, systém spadne až za behu

**Riešenie**:
```typescript
// services/config-validator/
import Ajv from 'ajv';
import yaml from 'js-yaml';

const ajv = new Ajv();
const schema = require('../../../config/modes.schema.json');

async function validateConfig() {
  const config = yaml.load(fs.readFileSync('/config/modes.yaml', 'utf8'));
  const valid = ajv.validate(schema, config);
  
  if (!valid) {
    logger.error('Invalid modes.yaml', ajv.errors);
    process.exit(1);  // Fail fast
  }
  
  logger.info('Config validated successfully');
}

validateConfig();
```

---

### 8. ❌ MISSING: Graceful Shutdown Handling

**Problém**: Containers dostanú SIGTERM, ale service môže byť uprostred MQTT publish

**Riešenie**:
```typescript
// services/scheduler/src/index.ts
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  logger.info('Received SIGTERM, graceful shutdown...');
  
  // 1. Stop accepting new requests
  await stopHealthEndpoint();
  
  // 2. Finish pending MQTT publishes
  await mqttClient.end(true);  // force=true after timeout
  
  // 3. Close connections
  await closeConnections();
  
  process.exit(0);
});

// Docker: stopSignal: SIGTERM, stopGracePeriod: 30s
```

---

### 9. ❌ MISSING: Circuit Breaker Pattern

**Problém**: Ak OpenWeatherMap API je down, bombardujeme ho requests

**Riešenie**:
```typescript
// libs/circuit-breaker/
import CircuitBreaker from 'opossum';

const options = {
  timeout: 10000,        // 10s timeout
  errorThresholdPercentage: 50,  // Open after 50% errors
  resetTimeout: 30000    // Try again after 30s
};

const breaker = new CircuitBreaker(fetchWeather, options);

breaker.on('open', () => {
  logger.warn('Weather API circuit breaker OPEN');
  // Fallback: use cached weather data
});

const weather = await breaker.fire();
```

---

### 10. ❌ MISSING: Database Migrations for InfluxDB

**Problém**: Schema changes = manual work

**Riešenie**:
```
services/influx-migrator/
├── migrations/
│   ├── 001_create_temperature_measurement.flux
│   ├── 002_add_humidity_field.flux
│   └── 003_add_indexes.flux
└── migrator.ts
```

---

### 11. ❌ MISSING: MQTT QoS Strategy Documentation

**Problém**: Všetky messages používajú default QoS (pravdepodobne 0)

**Riešenie**: Explicitná QoS policy
```typescript
// libs/mqtt-client/qos.ts
export const QOS_POLICY = {
  // QoS 0 - At most once (fire and forget)
  'virt/weather/current': 0,
  'stat/hvac/+/current_temp': 0,
  
  // QoS 1 - At least once (guaranteed delivery)
  'cmd/room/+/set_target': 1,
  'virt/room/+/target_temp': 1,
  
  // QoS 2 - Exactly once (critical)
  'event/safety/smoke/#': 2,
  'cmd/system/emergency_stop': 2
} as const;

publish(topic, payload, { qos: QOS_POLICY[topic] || 1 });
```

---

### 12. ❌ MISSING: Health Check Endpoints for Services

**Problém**: Docker healthchecks volajú root URL, services nemajú `/health`

**Riešenie**:
```typescript
// services/scheduler/src/health.ts
import express from 'express';

const app = express();

app.get('/health', async (req, res) => {
  const checks = {
    mqtt: await checkMqttConnection(),
    calendar: await checkCalendarSync(),
    memory: process.memoryUsage().heapUsed < 512 * 1024 * 1024  // <512MB
  };
  
  const healthy = Object.values(checks).every(v => v);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    uptime: process.uptime()
  });
});

app.listen(3001);
```

---

### 13. ❌ MISSING: Environment-Specific Configuration

**Problém**: Jedna konfigurácia pre dev/staging/prod

**Riešenie**:
```
config/
├── modes.yaml              # Base config
├── modes.dev.yaml          # Dev overrides
├── modes.staging.yaml      # Staging overrides
└── modes.prod.yaml         # Production overrides

# Load strategy
const env = process.env.NODE_ENV || 'production';
const config = merge(
  loadYaml('modes.yaml'),
  loadYaml(`modes.${env}.yaml`)
);
```

---

### 14. ❌ MISSING: Metrics Collection from Custom Services

**Problém**: InfluxDB je optional, ale služby by mali publikovať metriky

**Riešenie**:
```typescript
// libs/metrics/
import { Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  mqttMessagesReceived: new Counter({
    name: 'mqtt_messages_received_total',
    help: 'Total MQTT messages received',
    labelNames: ['topic', 'service']
  }),
  
  mqttPublishDuration: new Histogram({
    name: 'mqtt_publish_duration_seconds',
    help: 'MQTT publish duration',
    buckets: [0.001, 0.01, 0.1, 1]
  }),
  
  activeConnections: new Gauge({
    name: 'mqtt_active_connections',
    help: 'Active MQTT connections'
  })
};

// Expose on /metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});
```

---

### 15. ❌ MISSING: Retry Logic for Failed Operations

**Problém**: Calendar sync fail = data loss

**Riešenie**:
```typescript
// libs/retry/
import retry from 'async-retry';

async function syncCalendar() {
  await retry(
    async (bail) => {
      try {
        const events = await fetchBaikalEvents();
        return events;
      } catch (err) {
        if (err.code === 'AUTH_FAILED') {
          bail(err);  // Don't retry auth errors
        }
        throw err;  // Retry network errors
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
      maxTimeout: 5000,
      onRetry: (err, attempt) => {
        logger.warn(`Calendar sync retry ${attempt}/3`, { error: err.message });
      }
    }
  );
}
```

---

### 16. ❌ MISSING: MQTT Message Schemas Integration

**Problém**: Schemas existujú v `config/mqtt-schemas.json`, ale nie sú použité v UI

**Riešenie**:
```typescript
// ui/smarthome-ui/src/lib/schema-validator.ts
import Ajv from 'ajv';
import schemas from '../../../config/mqtt-schemas.json';

const ajv = new Ajv();
const validators = {};

// Compile schemas
for (const [topic, schema] of Object.entries(schemas.schemas)) {
  validators[topic] = ajv.compile(schema);
}

export function validateMessage(topic: string, payload: unknown): boolean {
  const validator = findValidator(topic);  // Match wildcards
  if (!validator) return true;  // No schema = pass
  
  const valid = validator(payload);
  if (!valid) {
    logger.error('Schema validation failed', {
      topic,
      errors: validator.errors
    });
  }
  return valid;
}
```

---

### 17. ❌ MISSING: Backup Automation

**Problém**: Manuálne backup scripty v docs

**Riešenie**:
```yaml
# compose/docker-compose.yml
services:
  backup:
    image: alpine:latest
    profiles: [backup]
    volumes:
      - mosquitto_data:/data/mosquitto:ro
      - baikal_data:/data/baikal:ro
      - ../backups:/backups
    environment:
      - BACKUP_RETENTION_DAYS=30
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        while true; do
          DATE=$(date +%Y%m%d-%H%M%S)
          tar czf /backups/backup-$$DATE.tar.gz \
            /data/mosquitto /data/baikal
          # Cleanup old backups
          find /backups -name "backup-*.tar.gz" -mtime +30 -delete
          sleep 86400  # Daily
        done
```

---

### 18. ❌ MISSING: Integration Tests Infrastructure

**Problém**: Testy existujú len ako šablóny, nie sú spustiteľné

**Riešenie**:
```typescript
// tests/integration/mqtt-flow.test.ts
import mqtt from 'mqtt';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

let client: mqtt.MqttClient;

beforeAll(async () => {
  // Start test containers
  await exec('docker compose --profile test up -d');
  
  // Connect to test MQTT broker
  client = mqtt.connect('mqtt://localhost:1883');
  await new Promise(resolve => client.on('connect', resolve));
});

test('Temperature change triggers HVAC setpoint', async () => {
  const received = [];
  
  client.subscribe('cmd/hvac/+/setpoint');
  client.on('message', (topic, msg) => {
    received.push({ topic, payload: JSON.parse(msg.toString()) });
  });
  
  // Publish temp change
  client.publish('cmd/room/spalna/set_target', JSON.stringify({
    value: 22,
    source: 'test'
  }));
  
  // Wait for setpoint
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  expect(received).toContainEqual({
    topic: 'cmd/hvac/spalna/setpoint',
    payload: { value: 22 }
  });
});

afterAll(async () => {
  client.end();
  await exec('docker compose --profile test down -v');
});
```

---

### 19. ❌ MISSING: .env Validation

**Problém**: Chýbajúce environment premenné = runtime crash

**Riešenie**:
```typescript
// libs/env-validator/
import { z } from 'zod';

const envSchema = z.object({
  MQTT_BROKER: z.string().url().default('mqtt://mosquitto:1883'),
  GOOGLE_CALENDAR_API_KEY: z.string().min(1).optional(),
  OPENWEATHER_API_KEY: z.string().min(1),
  PUSHOVER_USER: z.string().optional(),
  PUSHOVER_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('production'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export const env = envSchema.parse(process.env);

// Startup validation
try {
  env;
  logger.info('Environment validated');
} catch (err) {
  logger.error('Invalid environment variables', err.errors);
  process.exit(1);
}
```

---

### 20. ❌ MISSING: API Request/Response Logging

**Problém**: Žiadny audit trail pre API calls

**Riešenie**:
```typescript
// ui/smarthome-ui/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  // Log request
  logger.info('api_request', {
    request_id: requestId,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers),
    user_agent: request.headers.get('user-agent')
  });
  
  // Intercept response
  return NextResponse.next({
    headers: {
      'x-request-id': requestId
    }
  }).then(response => {
    const duration = Date.now() - start;
    
    logger.info('api_response', {
      request_id: requestId,
      status: response.status,
      duration_ms: duration
    });
    
    return response;
  });
}

export const config = {
  matcher: '/api/:path*'
};
```

---

## Priority Matrix

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| **Centralized Logging** | 🔴 High | Medium | 1 |
| **Error Handling Middleware** | 🔴 High | Low | 2 |
| **Config Validation on Startup** | 🔴 High | Low | 3 |
| **Health Check Endpoints** | 🟡 Medium | Low | 4 |
| **MQTT QoS Strategy** | 🟡 Medium | Low | 5 |
| **Graceful Shutdown** | 🟡 Medium | Medium | 6 |
| **.env Validation** | 🟡 Medium | Low | 7 |
| **API Authentication** | 🟡 Medium | Medium | 8 |
| **Distributed Tracing** | 🟢 Low | High | 9 |
| **Rate Limiting** | 🟢 Low | Medium | 10 |

## Quick Wins (Implement This Week)

1. **Config Validation** (2h)
2. **Health Endpoints** (3h)
3. **.env Validation** (1h)
4. **MQTT QoS Strategy** (1h)
5. **Error Boundaries** (2h)

**Total**: 9 hours → Significant stability improvement
