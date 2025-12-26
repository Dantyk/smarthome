/**
 * Metrics tracking utility
 */

export const metrics = {
  startTime: Date.now(),
  httpRequests: 0,
  mqttMessages: 0,
  mqttErrors: 0,
  apiErrors: 0
};

export function incHttpRequests() {
  metrics.httpRequests++;
}

export function incMqttMessages() {
  metrics.mqttMessages++;
}

export function incMqttErrors() {
  metrics.mqttErrors++;
}

export function incApiErrors() {
  metrics.apiErrors++;
}
