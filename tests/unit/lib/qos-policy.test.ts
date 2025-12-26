import { getQoS, QOS_POLICY } from '../../../ui/smarthome-ui/src/lib/qos-policy';

describe('QoS Policy', () => {
  describe('Exact topic matches', () => {
    it('should return QoS 0 for weather topics', () => {
      expect(getQoS('virt/weather/current')).toBe(0);
      expect(getQoS('virt/weather/forecast')).toBe(0);
    });

    it('should return QoS 1 for command topics', () => {
      expect(getQoS('virt/system/active_mode')).toBe(1);
      expect(getQoS('meta/service/+/online')).toBe(1);
    });

    it('should return QoS 2 for safety topics', () => {
      expect(getQoS('cmd/system/emergency_stop')).toBe(2);
      expect(getQoS('cmd/system/shutdown')).toBe(2);
    });
  });

  describe('Wildcard matching', () => {
    it('should match single-level wildcard (+)', () => {
      expect(getQoS('cmd/room/livingroom/set_target')).toBe(1);
      expect(getQoS('stat/hvac/bedroom/current_temp')).toBe(0);
      expect(getQoS('meta/service/nodered/last_seen')).toBe(0);
    });

    it('should match multi-level wildcard (#)', () => {
      expect(getQoS('event/safety/smoke/upstairs/bedroom')).toBe(2);
      expect(getQoS('event/safety/fire/kitchen')).toBe(2);
      expect(getQoS('event/security/intrusion/door/main')).toBe(2);
    });
  });

  describe('Default fallback', () => {
    it('should return QoS 1 for unknown topics', () => {
      expect(getQoS('unknown/topic')).toBe(1);
      expect(getQoS('stat/random/data')).toBe(1);
    });
  });

  describe('QOS_POLICY structure', () => {
    it('should have valid QoS levels (0, 1, or 2)', () => {
      const validLevels = [0, 1, 2];
      Object.values(QOS_POLICY).forEach(qos => {
        expect(validLevels).toContain(qos);
      });
    });

    it('should include safety-critical topics with QoS 2', () => {
      expect(QOS_POLICY['event/safety/smoke/#']).toBe(2);
      expect(QOS_POLICY['event/safety/fire/#']).toBe(2);
      expect(QOS_POLICY['cmd/system/emergency_stop']).toBe(2);
    });
  });
});
