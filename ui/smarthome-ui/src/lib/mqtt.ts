import mqtt, { MqttClient } from 'mqtt';

let client: MqttClient | null = null;
let refCount = 0;
let lastDisconnectAt: number | null = null;

export function getMqtt() {
  // Only initialize in browser
  if (typeof window === 'undefined') {
    console.log('[MQTT] Skipping - not in browser');
    return null as any;
  }
  
  if (client) {
    refCount++;
    console.log('[MQTT] Reusing existing connection (refCount:', refCount, ')');
    return client;
  }
  
  // Use hardcoded localhost for testing, then switch to dynamic
  const wsUrl = `ws://${window.location.hostname}:9001`;
  
  console.log('[MQTT] Initializing NEW connection');
  console.log('[MQTT] WebSocket URL:', wsUrl);
  
  client = mqtt.connect(wsUrl, {
    reconnectPeriod: 1500,
    connectTimeout: 10000,
    clientId: `smarthome_${Math.random().toString(16).substr(2, 8)}`,
  });

  refCount = 1;

  client.on('connect', () => {
    console.log('[MQTT] ✓ Connected to MQTT broker');
    const now = Date.now();
    const wasDownFor = lastDisconnectAt ? now - lastDisconnectAt : 0;
    // Notify listeners in the app about status
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'connect', wasDownFor } })); } catch {}
    lastDisconnectAt = null;
  });

  client.on('error', (err) => {
    console.error('[MQTT] Connection error:', err.message);
  });

  client.on('close', () => {
    console.log('[MQTT] Disconnected');
    lastDisconnectAt = Date.now();
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'close' } })); } catch {}
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Attempting to reconnect...');
    try { window.dispatchEvent(new CustomEvent('mqtt:status', { detail: { status: 'reconnect' } })); } catch {}
  });

  return client;
}

export function releaseMqtt() {
  if (!client) return;
  refCount--;
  console.log('[MQTT] Released connection (refCount:', refCount, ')');
  if (refCount <= 0) {
    console.log('[MQTT] Closing connection');
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
    console.log('[MQTT] Subscribe skipped - not in browser');
    return () => {};
  }
  const handler = (t: string, m: Buffer) => {
    if (topicMatches(topic, t)) cb(t, m);
  };
  c.on('message', handler);
  c.subscribe(topic, (err) => {
    if (err) console.error(`[MQTT] Subscribe error (${topic}):`, err);
    else console.log(`[MQTT] Subscribed to: ${topic}`);
  });
  return () => { c.off('message', handler); c.unsubscribe(topic); };
}

export function publish(topic: string, payload: string | object, retain = false) {
  const c = getMqtt();
  if (!c) {
    console.log('[MQTT] Publish skipped - not in browser');
    return;
  }
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  console.log(`[MQTT] Publishing: ${topic}`, data, `(retain=${retain})`);
  c.publish(topic, data, { retain });
}
