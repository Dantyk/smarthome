/**
 * MQTT Quality of Service (QoS) Policy
 * 
 * Defines QoS levels for all MQTT topics.
 * Ensures critical messages are delivered reliably.
 */

export const QOS_POLICY = {
  // QoS 0 - At most once (fire and forget)
  // Used for: Non-critical status updates, weather data
  'virt/weather/current': 0,
  'virt/weather/forecast': 0,
  'virt/weather/hourly': 0,
  'stat/hvac/+/current_temp': 0,
  'stat/hvac/+/humidity': 0,
  'meta/service/+/last_seen': 0,
  
  // QoS 1 - At least once (guaranteed delivery)
  // Used for: Commands, target temperatures, mode changes
  'cmd/room/+/set_target': 1,
  'virt/room/+/target_temp': 1,
  'virt/room/+/enabled': 1,
  'cmd/hvac/+/setpoint': 1,
  'virt/system/active_mode': 1,
  'virt/boost/+/minutes': 1,
  'virt/boost/+/target_temp': 1,
  'virt/calendar/events/current': 1,
  'meta/service/+/online': 1,
  'meta/service/+/version': 1,
  
  // QoS 2 - Exactly once (critical, no duplicates)
  // Used for: Safety events, emergency commands
  'event/safety/smoke/#': 2,
  'event/safety/fire/#': 2,
  'event/security/intrusion/#': 2,
  'cmd/system/emergency_stop': 2,
  'cmd/system/shutdown': 2
} as const;

export type QoSLevel = 0 | 1 | 2;

/**
 * Get QoS level for a topic (supports wildcards)
 */
export function getQoS(topic: string): QoSLevel {
  // Exact match first
  if (topic in QOS_POLICY) {
    return QOS_POLICY[topic as keyof typeof QOS_POLICY];
  }
  
  // Match wildcards
  for (const [pattern, qos] of Object.entries(QOS_POLICY)) {
    if (matchesPattern(pattern, topic)) {
      return qos;
    }
  }
  
  // Default: QoS 1 (guaranteed delivery)
  return 1;
}

/**
 * Match MQTT topic pattern with wildcards (+, #)
 */
function matchesPattern(pattern: string, topic: string): boolean {
  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '#') {
      return true; // Multi-level wildcard matches rest
    }
    if (patternParts[i] === '+') {
      continue; // Single-level wildcard matches any
    }
    if (patternParts[i] !== topicParts[i]) {
      return false; // Mismatch
    }
  }
  
  return patternParts.length === topicParts.length;
}

// Export for documentation
export const QOS_DOCUMENTATION = {
  0: 'At most once - Fire and forget (non-critical data)',
  1: 'At least once - Guaranteed delivery (commands, states)',
  2: 'Exactly once - No duplicates (safety-critical events)'
} as const;
