/**
 * Mapping medzi Node-RED MQTT témami (staré anglické názvy)
 * a UI/Config (nové slovenské názvy)
 */

// MQTT -> Config (Slovak)
export const MQTT_TO_CONFIG: Record<string, string> = {
  bedroom: 'spalna',
  kidroom1: 'detska',
  living: 'obyvacka',
  kitchen: 'kuchyna',
  bathroom: 'kupelna',
};

// Config (Slovak) -> MQTT
export const CONFIG_TO_MQTT: Record<string, string> = {
  spalna: 'bedroom',
  detska: 'kidroom1',
  obyvacka: 'living',
  kuchyna: 'kitchen',
  kupelna: 'bathroom',
};

export function mqttToConfig(mqttRoom: string): string {
  return MQTT_TO_CONFIG[mqttRoom] || mqttRoom;
}

export function configToMqtt(configRoom: string): string {
  return CONFIG_TO_MQTT[configRoom] || configRoom;
}
