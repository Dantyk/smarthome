/**
 * K6 Load Test - MQTT Flood Simulation
 * 
 * Simuluje vysoké zaťaženie MQTT brokera s rôznymi vzormi správ.
 * 
 * Usage:
 *   k6 run mqtt-flood.js
 *   k6 run --vus 50 --duration 5m mqtt-flood.js
 */

import { check, sleep } from 'k6';
import mqtt from 'k6/x/mqtt';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 VUs
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '2m', target: 50 },   // Stay at 50 VUs
    { duration: '1m', target: 100 },  // Spike to 100 VUs
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'mqtt_pub_duration': ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    'mqtt_pub_errors': ['rate<0.1'],                  // Error rate < 10%
  },
};

const MQTT_BROKER = __ENV.MQTT_BROKER || 'localhost:1883';
const TOPICS = [
  'cmd/living_room/light',
  'cmd/bedroom/shutter',
  'cmd/kitchen/heating',
  'event/safety/alert',
  'virt/sensor/temperature',
  'stat/device/online',
];

export default function () {
  const client = mqtt.connect(`mqtt://${MQTT_BROKER}`, {
    clientId: `k6-${__VU}-${__ITER}`,
    clean: true,
  });

  // Subscribe to topics (simulating listeners)
  TOPICS.forEach(topic => {
    client.subscribe(topic, 0);
  });

  // Publish messages with varying patterns
  const iterations = 10;
  for (let i = 0; i < iterations; i++) {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const payload = JSON.stringify({
      timestamp: Date.now(),
      value: Math.random() * 100,
      iteration: i,
      vu: __VU,
    });

    const start = Date.now();
    const published = client.publish(topic, payload, 0, false);
    const duration = Date.now() - start;

    check(published, {
      'message published': (pub) => pub === true,
    });

    // Record custom metrics
    if (published) {
      __ITER_DURATION.add(duration);
    }

    // Vary delay to simulate realistic traffic
    if (topic.startsWith('cmd/')) {
      sleep(0.1); // Commands are frequent
    } else if (topic.startsWith('event/')) {
      sleep(0.5); // Events are occasional
    } else {
      sleep(0.2); // Stats are moderate
    }
  }

  client.disconnect();
}

export function handleSummary(data) {
  return {
    'load-test-mqtt-results.json': JSON.stringify(data, null, 2),
    stdout: `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MQTT Load Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Iterations:  ${data.metrics.iterations.values.count}
Total Publishes:   ${data.metrics.mqtt_pub_duration?.values.count || 'N/A'}
Error Rate:        ${(data.metrics.mqtt_pub_errors?.values.rate * 100 || 0).toFixed(2)}%

Publish Duration (ms):
  p50:  ${data.metrics.mqtt_pub_duration?.values['p(50)']?.toFixed(2) || 'N/A'}
  p95:  ${data.metrics.mqtt_pub_duration?.values['p(95)']?.toFixed(2) || 'N/A'}
  p99:  ${data.metrics.mqtt_pub_duration?.values['p(99)']?.toFixed(2) || 'N/A'}
  max:  ${data.metrics.mqtt_pub_duration?.values.max?.toFixed(2) || 'N/A'}

Virtual Users:
  min:  ${data.metrics.vus.values.min}
  max:  ${data.metrics.vus.values.max}

Duration:          ${(data.metrics.iteration_duration.values.avg / 1000).toFixed(2)}s avg

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`,
  };
}
