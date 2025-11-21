import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type RoomState = { 
  current?: number; 
  target?: number; 
  humidity?: number;
  override?: boolean;
  overrideValue?: number;
  overrideUntil?: string; // ISO timestamp when override ends
  readonly?: boolean; // Cannot adjust temperature
  hvacEnabled?: boolean; // HVAC on/off
  boostActive?: boolean; // Boost mode active
  boostMinutes?: number; // Remaining boost minutes
  boostTargetTemp?: number; // Boost target temperature
  label?: string; // Display name from config
  displayName?: string;
  title?: string;
};

type WeatherHourly = {
  time: string;
  temp: number;
  icon: string;
};

type Weather = { 
  temp?: number; 
  description?: string; 
  icon?: string; 
  humidity?: number;
  wind_speed?: number;
  hourly?: WeatherHourly[];
  location?: string;
  country?: string;
};

type House = { 
  mode?: string; 
  rooms: Record<string, RoomState>; 
  roomList?: string[]; // stable ordered list of room keys
  weather?: Weather;
  burstDuration: number; // hours, default 1
  burstDurations?: Record<string, number>; // per-room last selected burst durations
};

export const useHouse = create<House>()(
  persist(
    () => ({
      rooms: {},
      roomList: [],
      burstDuration: 1,
      burstDurations: {}
    }),
    {
      name: 'house-storage',
      // Persist only necessary fields; keep it light
      partialize: (s: House) => ({
        rooms: s.rooms,
        roomList: s.roomList,
        weather: s.weather,
        burstDuration: s.burstDuration,
        burstDurations: s.burstDurations,
        mode: s.mode,
      }),
    }
  )
);

// Cross-tab sync: listen to localStorage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'house-storage' && e.newValue) {
      try {
        const newState = JSON.parse(e.newValue);
        const currentState = useHouse.getState();
        
        // Sync burstDurations from other tabs
        if (newState.state?.burstDurations && 
            JSON.stringify(newState.state.burstDurations) !== JSON.stringify(currentState.burstDurations)) {
          console.log('[Storage] Syncing burstDurations from other tab:', newState.state.burstDurations);
          useHouse.setState({ burstDurations: newState.state.burstDurations });
        }
        
        // Also sync rooms (boost target temps, slider values)
        if (newState.state?.rooms) {
          const updatedRooms = { ...currentState.rooms };
          let hasChanges = false;
          
          Object.keys(newState.state.rooms).forEach(room => {
            const newRoom = newState.state.rooms[room];
            const currentRoom = currentState.rooms[room] || {};
            
            // Sync boostTargetTemp if changed
            if (newRoom.boostTargetTemp !== undefined && 
                newRoom.boostTargetTemp !== currentRoom.boostTargetTemp) {
              updatedRooms[room] = { ...currentRoom, boostTargetTemp: newRoom.boostTargetTemp };
              hasChanges = true;
              console.log(`[Storage] Syncing ${room} boostTargetTemp: ${newRoom.boostTargetTemp}`);
            }
          });
          
          if (hasChanges) {
            useHouse.setState({ rooms: updatedRooms });
          }
        }
      } catch (err) {
        console.error('[Storage] Failed to parse storage event:', err);
      }
    }
  });
}
