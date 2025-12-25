/**
 * Command Publisher - Centralized business logic for MQTT commands
 * Removes command logic from UI components - they only call these functions
 */

import { publish } from './mqtt';
import { getQoS } from './qos-policy';
import { logger } from './logger';

export interface SetTargetTempCommand {
  room: string;
  value: number;
  source?: 'ui' | 'api' | 'automation';
}

export interface SetBoostCommand {
  room: string;
  minutes: number;
  targetTemp: number;
}

export interface SetHvacEnabledCommand {
  room: string;
  enabled: boolean;
}

/**
 * Set target temperature for a room
 */
export function setRoomTargetTemp({ room, value, source = 'ui' }: SetTargetTempCommand): void {
  // Validation
  if (value < 10 || value > 30) {
    throw new Error(`Invalid temperature: ${value}°C (must be 10-30°C)`);
  }
  
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    throw new Error(`Invalid room: ${room}`);
  }
  
  const topic = `cmd/room/${room}/set_target`;
  const traceId = crypto.randomUUID();
  
  // Publish command with trace ID
  publish(topic, {
    value,
    source,
    trace_id: traceId,
    timestamp: new Date().toISOString()
  }, { qos: getQoS(topic) });
  
  logger.info('Set room target temperature', { 
    room, 
    value, 
    source, 
    trace_id: traceId 
  });
}

/**
 * Enable/disable HVAC for a room
 */
export function setRoomHvacEnabled({ room, enabled }: SetHvacEnabledCommand): void {
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    throw new Error(`Invalid room: ${room}`);
  }
  
  const topic = `virt/room/${room}/enabled`;
  publish(topic, enabled ? 'true' : 'false', { qos: getQoS(topic) });
  
  logger.info('Set room HVAC enabled', { room, enabled });
}

/**
 * Start boost mode for a room
 */
export function startRoomBoost({ room, minutes, targetTemp }: SetBoostCommand): void {
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    throw new Error(`Invalid room: ${room}`);
  }
  
  if (minutes < 1 || minutes > 480) {
    throw new Error(`Invalid boost duration: ${minutes} min (must be 1-480)`);
  }
  
  if (targetTemp < 10 || targetTemp > 30) {
    throw new Error(`Invalid boost temperature: ${targetTemp}°C (must be 10-30°C)`);
  }
  
  // Publish boost commands
  const minutesTopic = `virt/boost/${room}/minutes`;
  const tempTopic = `virt/boost/${room}/target_temp`;
  
  publish(minutesTopic, minutes.toString(), { qos: getQoS(minutesTopic) });
  publish(tempTopic, targetTemp.toString(), { qos: getQoS(tempTopic) });
  
  logger.info('Start room boost', { room, minutes, targetTemp });
}

/**
 * Cancel boost mode for a room
 */
export function cancelRoomBoost(room: string): void {
  const validRooms = ['spalna', 'detska', 'obyvacka', 'kuchyna', 'kupelna'];
  if (!validRooms.includes(room)) {
    throw new Error(`Invalid room: ${room}`);
  }
  
  const topic = `virt/boost/${room}/minutes`;
  publish(topic, '0', { qos: getQoS(topic) });
  
  logger.info('Cancel room boost', { room });
}

/**
 * Request full system state refresh
 */
export function requestStateRefresh(): void {
  publish('cmd/system/refresh_state', {
    source: 'ui',
    timestamp: new Date().toISOString()
  });
  
  console.log('[Command] Requested system state refresh');
}
