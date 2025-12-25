import mqtt, { MqttClient, IClientPublishOptions } from 'mqtt';
import { logger } from './logger';

let client: MqttClient | null = null;
let refCount = 0;
let lastDisconnectAt: number | null = null;
let globalHandlers: Map<string, Set<(t: string, m: Uint8Array) => void>> = new Map();

export function getMqtt() {
  // Only initialize in browser
  if (typeof window === 'undefined') {
    logger.debug('MQTT: Skipping - not in browser');
    return null as any;
  }
  
  if (client) {
    refCount++;
    logger.debug('MQTT: Reusing existing connection', { refCount });
    return client;
  }
  
  // Use hardcoded localhost for testing, then switch to dynamic
  const wsUrl = `ws://${window.location.hostname}:9001`;
  
  logger.info('MQTT: Initializing NEW connection', { wsUrl });
  
  client = mqtt.connect(wsUrl, {
    reconnectPeriod: 1500,
    connectTimeout: 10000,
    clientId: `smarthome_${Math.random().toString(16).substr(2, 8)}`,
  });

  refCount = 1;

  // Single global message handler - dispatch to all subscriptions
  client.on('message', (topic: string, message: Buffer) => {
    for (const [filter, callbacks] of globalHandlers.entries()) {
      if (topicMatches(filter, topic)) {
        for (const cb of callbacks) {
          try {
            cb(topic, message);
          } catch (err) {
            logger.error('MQTT: Handler error', { topic, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
    }
  });

  client.on('connect', () => {
    const now = Date.now();
    const wasDownFor = lastDisconnectAt ? now - lastDisconnectAt : 0;
    logger.info('MQTT: Connected to broker', { wasDownFor });
    
    // Notify listeners in the app about status
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'connect', wasDownFor } })); } catch {}
    lastDisconnectAt = null;
  });

  client.on('error', (err) => {
    logger.error('MQTT: Connection error', { error: err.message });
  });

  client.on('close', () => {
    lastDisconnectAt = Date.now();
    logger.warn('MQTT: Disconnected');
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'close' } })); } catch {}
  });

  client.on('reconnect', () => {
    logger.info('MQTT: Attempting to reconnect');
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'reconnect' } })); } catch {}
  });

  return client;
}

export function releaseMqtt() {
  if (!client) return;
  refCount--;
  logger.debug('MQTT: Released connection', { refCount });
  if (refCount <= 0) {
    logger.info('MQTT: Closing connection');
    client.end();
    client = null;
    refCount = 0;
  }
}

function topicMatches(filter: string, topic: string): boolean {
  // MQTT wildcard matching supporting + and #
  const f = filter.split('/');
  const t = topic.split('/');
  let i = 0;
  for (; i < f.length; i++) {
    const fp = f[i];
    const tp = t[i];
    if (fp === '#') {
      // multi-level wildcard must be last
      return i === f.length - 1;
    }
    if (fp === '+') {
      if (tp === undefined) return false;
      continue;
    }
    if (tp !== fp) return false;
  }
  return i === t.length;
}

export function subscribe(topic: string, cb: (t: string, m: Uint8Array) => void) {
  const c = getMqtt();
  if (!c) {
    logger.debug('MQTT: Subscribe skipped - not in browser');
    return () => {};
  }
  
  // Add callback to global handlers map
  if (!globalHandlers.has(topic)) {
    globalHandlers.set(topic, new Set());
    // Only subscribe to MQTT broker once per unique topic filter
    c.subscribe(topic, (err) => {
      if (err) {
        logger.error('MQTT: Subscribe error', { topic, error: err.message });
      } else {
        logger.info('MQTT: Subscribed', { topic });
      }
    });
  }
  
  globalHandlers.get(topic)!.add(cb);
  
  // Return cleanup function
  return () => {
    const handlers = globalHandlers.get(topic);
    if (handlers) {
      handlers.delete(cb);
      if (handlers.size === 0) {
        globalHandlers.delete(topic);
        c.unsubscribe(topic);
      }
    }
  };
}

export function publish(
  topic: string, 
  payload: string | object, 
  options?: { retain?: boolean; qos?: 0 | 1 | 2 }
) {
  const c = getMqtt();
  if (!c) {
    logger.debug('MQTT: Publish skipped - not in browser');
    return;
  }
  
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const publishOpts: IClientPublishOptions = {
    retain: options?.retain ?? false,
    qos: options?.qos ?? 1
  };
  
  logger.debug('MQTT: Publishing', { topic, payload: data, ...publishOpts });
  c.publish(topic, data, publishOpts);
}
