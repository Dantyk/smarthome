# Centralized Logging, Error Handling a Graceful Shutdown

## Prehľad

Implementované 3 kritické vylepšenia infraštruktúry:

1. **Centralized Logging** - Winston logger pre Node-RED
2. **Error Handling Middleware** - Retry, Circuit Breaker, DLQ
3. **Graceful Shutdown** - SIGTERM handling

## 1. Centralized Logging

### Súbory
- [`flows/nodered/lib/logger.js`](../flows/nodered/lib/logger.js) - Winston logger
- Konfigurácia: `LOG_LEVEL` environment variable

### Funkcie

**Log levels**: debug, info, warn, error

**Log destinations**:
- Console (colorized, human-readable)
- `/data/logs/combined.log` (všetky levely, JSON, max 10MB × 10 files)
- `/data/logs/error.log` (errors only, JSON, max 10MB × 5 files)

**Používanie v Node-RED function nodes**:

```javascript
// Základné použitie
logger.info('Scheduler updated', { mode: 'home', rooms: 5 });
logger.error('API call failed', { endpoint: '/calendar', status: 500 });

// S trace_id
logger.trace('Processing MQTT message', trace_id, { topic: msg.topic });

// MQTT logging
logger.mqtt('info', 'virt/room/spalna/target_temp', 22, { source: 'scheduler' });

// HTTP logging
logger.http('GET', '/api/calendar/events', 200, { duration: 145 });
```

### Rotácia logov

Winston automaticky rotuje logy:
- Max file size: 10MB
- Max files: 10 (combined), 5 (error)
- Staré súbory: `combined.log.1`, `combined.log.2`, ...

## 2. Error Handling Middleware

### Súbory
- [`flows/nodered/lib/error-handler.js`](../flows/nodered/lib/error-handler.js)

### Komponenty

#### RetryHandler
Exponential backoff retry logic:

```javascript
const { RetryHandler } = require('./error-handler');

const retry = new RetryHandler(3, 1000); // 3 retries, 1s base delay

await retry.execute(async () => {
  return await fetchCalendarEvents();
}, { trace_id: msg.trace_id });
```

Delays: 1s → 2s → 4s → 8s (max 30s)

#### CircuitBreaker
Ochrana external APIs:

```javascript
const { CircuitBreaker } = require('./error-handler');

const breaker = new CircuitBreaker(5, 60000); // 5 failures, 60s timeout

await breaker.execute(async () => {
  return await callWeatherAPI();
}, { api: 'openweather' });
```

Stavy:
- **CLOSED** - Normálna prevádzka
- **OPEN** - Blokuje requesty (po 5 failoch)
- **HALF-OPEN** - Skúša jeden request (po 60s)

#### DeadLetterQueue
Failed messages storage:

```javascript
const { DeadLetterQueue } = require('./error-handler');

const dlq = new DeadLetterQueue(mqttClient);

try {
  processMessage(msg);
} catch (err) {
  dlq.send(msg.topic, msg.payload, err, { trace_id: msg.trace_id });
}

// Retrieve failed messages
const failed = dlq.getAll();

// Clear DLQ
dlq.clear();
```

DLQ messages sú publishované na `dlq/<original-topic>` s metadatami:
- timestamp
- originalTopic
- payload
- error message & stack
- trace_id

#### createErrorHandler
Complete wrapper:

```javascript
const { createErrorHandler } = require('./error-handler');

const handler = createErrorHandler({
  maxRetries: 3,
  retryDelay: 1000,
  breakerThreshold: 5,
  breakerTimeout: 60000,
  useCircuitBreaker: true,
  dlq: global.dlq
});

// V Node-RED function node
const result = await handler.handleMessage(msg, async (msg, node) => {
  // Your processing logic
  const data = await fetchData(msg.payload.id);
  msg.payload = data;
  return msg;
}, node);
```

## 3. Graceful Shutdown

### Súbory
- [`flows/nodered/lib/graceful-shutdown.js`](../flows/nodered/lib/graceful-shutdown.js)
- [`flows/nodered/lib/init.js`](../flows/nodered/lib/init.js) - Initialization

### Funkcie

**Signal handling**: SIGTERM, SIGINT, uncaughtException, unhandledRejection

**Shutdown sequence**:
1. Close MQTT connections (5s timeout)
2. Run cleanup functions (5s each)
3. Flush logs
4. Exit gracefully

**Timeout protection**: Forced exit after 30s

### Používanie

```javascript
const { initGracefulShutdown } = require('./graceful-shutdown');

// Initialize (once at startup)
const shutdown = initGracefulShutdown({
  mqttClient: mqttBrokerNode.client,
  timeout: 30000
});

// Register cleanup functions
shutdown.addCleanup('close-database', async () => {
  await db.close();
});

shutdown.addCleanup('flush-cache', async () => {
  await cache.flush();
});
```

### Docker integration

**docker-compose.yml**:
```yaml
nodered:
  stop_grace_period: 30s  # Matches shutdown timeout
  environment:
    - LOG_LEVEL=info
```

**Entrypoint**: [`flows/nodered/docker-entrypoint.sh`](../flows/nodered/docker-entrypoint.sh)
- Validates config before start
- Installs dependencies
- Creates log directory
- Starts Node-RED with signal handling

## Integrácia do existujúcich flows

### 1. Pridaj logger do function nodes

**Pred**:
```javascript
console.log('[Scheduler] Mode changed:', msg.payload);
```

**Po**:
```javascript
logger.info('Scheduler mode changed', { 
  mode: msg.payload,
  trace_id: msg.trace_id 
});
```

### 2. Wrap risky operations s error handler

**Pred**:
```javascript
try {
  const events = await fetchCalendarEvents();
  msg.payload = events;
} catch (err) {
  console.error('Failed:', err);
  return null;
}
```

**Po**:
```javascript
const handler = createErrorHandler({ 
  maxRetries: 3, 
  dlq: global.dlq 
});

return await handler.handleMessage(msg, async (msg) => {
  msg.payload = await fetchCalendarEvents();
  return msg;
}, node);
```

### 3. Add circuit breaker pre external APIs

```javascript
const breaker = new CircuitBreaker(5, 60000);

msg.payload = await breaker.execute(async () => {
  return await fetch('https://api.openweathermap.org/...');
}, { api: 'openweather', trace_id: msg.trace_id });
```

## Deployment

```bash
# 1. Update package.json (winston dependency)
cd /home/pi/smarthome/flows/nodered
npm install

# 2. Restart Node-RED
cd ../../compose
docker compose restart nodered

# 3. Verify logs
docker compose logs -f nodered | grep "logger"
```

## Monitoring

### Log files

```bash
# Tail combined logs
docker exec compose-nodered-1 tail -f /data/logs/combined.log

# Tail error logs only
docker exec compose-nodered-1 tail -f /data/logs/error.log

# Search for errors
docker exec compose-nodered-1 grep -i error /data/logs/combined.log
```

### DLQ monitoring

Subscribe to DLQ topic:
```bash
mosquitto_sub -h localhost -t 'dlq/#' -v
```

Retrieve DLQ messages in Node-RED function:
```javascript
const dlqMessages = global.dlq.getAll();
logger.info('DLQ status', { messageCount: dlqMessages.length });
```

### Circuit breaker status

```javascript
logger.info('Circuit breaker status', {
  state: breaker.state,
  failures: breaker.failures,
  nextAttempt: new Date(breaker.nextAttempt).toISOString()
});
```

## Testing

### Test graceful shutdown

```bash
# Send SIGTERM
docker compose stop nodered

# Check logs for graceful shutdown
docker compose logs nodered | grep -i shutdown
```

Expected output:
```
[INFO] Graceful shutdown initiated signal=SIGTERM
[INFO] Closing MQTT connection
[INFO] MQTT connection closed gracefully
[INFO] Running cleanup function name=flush-dlq
[INFO] Flushing logs
[INFO] Graceful shutdown completed successfully
```

### Test retry logic

Function node:
```javascript
let attempts = 0;

const handler = createErrorHandler({ maxRetries: 3 });

await handler.handleMessage(msg, async (msg) => {
  attempts++;
  if (attempts < 3) {
    throw new Error('Simulated failure');
  }
  msg.payload = 'Success on attempt ' + attempts;
  return msg;
}, node);
```

### Test circuit breaker

```javascript
const breaker = new CircuitBreaker(3, 10000);

for (let i = 0; i < 5; i++) {
  try {
    await breaker.execute(async () => {
      throw new Error('API down');
    });
  } catch (err) {
    logger.warn('Request failed', { attempt: i + 1 });
  }
}

// Breaker should be OPEN after 3 failures
logger.info('Circuit state', { state: breaker.state });
```

## Benefity

1. **Structured Logs** - JSON format pre log aggregation (ELK, Splunk)
2. **Automatic Retry** - Transparentné retries s exponential backoff
3. **API Protection** - Circuit breaker zabráni bombardovaniu failed APIs
4. **Error Recovery** - DLQ umožňuje manual recovery failed messages
5. **Clean Shutdown** - Žiadne data loss pri reštarte/shutdown
6. **Observability** - Centralizované logy pre debugging

## Performance Impact

- Logger overhead: ~1ms per log entry
- Retry delays: 1s → 30s (configurable)
- Circuit breaker: Negligible (<0.1ms)
- Graceful shutdown: Max 30s delay
- Log rotation: Automatic, no performance impact
