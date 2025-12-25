/**
 * Unit tests for command publisher
 */

import { setRoomTargetTemp, setRoomHvacEnabled, startRoomBoost } from '../../../ui/smarthome-ui/src/lib/commands';

// Mock MQTT publish
jest.mock('../../../ui/smarthome-ui/src/lib/mqtt', () => ({
  publish: jest.fn(),
}));

import { publish } from '../../../ui/smarthome-ui/src/lib/mqtt';

describe('Command Publisher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setRoomTargetTemp', () => {
    it('should publish valid temperature command', () => {
      setRoomTargetTemp({ room: 'spalna', value: 22 });
      
      expect(publish).toHaveBeenCalledWith(
        'cmd/room/spalna/set_target',
        expect.objectContaining({
          value: 22,
          source: 'ui',
          trace_id: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should reject invalid temperature', () => {
      expect(() => {
        setRoomTargetTemp({ room: 'spalna', value: 35 });
      }).toThrow('Invalid temperature');
    });

    it('should reject invalid room', () => {
      expect(() => {
        setRoomTargetTemp({ room: 'invalid', value: 22 });
      }).toThrow('Invalid room');
    });
  });

  describe('setRoomHvacEnabled', () => {
    it('should publish HVAC enable command', () => {
      setRoomHvacEnabled({ room: 'detska', enabled: true });
      
      expect(publish).toHaveBeenCalledWith('virt/room/detska/enabled', 'true');
    });

    it('should publish HVAC disable command', () => {
      setRoomHvacEnabled({ room: 'detska', enabled: false });
      
      expect(publish).toHaveBeenCalledWith('virt/room/detska/enabled', 'false');
    });
  });

  describe('startRoomBoost', () => {
    it('should publish boost commands', () => {
      startRoomBoost({ room: 'obyvacka', minutes: 120, targetTemp: 24 });
      
      expect(publish).toHaveBeenCalledWith('virt/boost/obyvacka/minutes', '120');
      expect(publish).toHaveBeenCalledWith('virt/boost/obyvacka/target_temp', '24');
    });

    it('should reject invalid duration', () => {
      expect(() => {
        startRoomBoost({ room: 'obyvacka', minutes: 500, targetTemp: 24 });
      }).toThrow('Invalid boost duration');
    });
  });
});
