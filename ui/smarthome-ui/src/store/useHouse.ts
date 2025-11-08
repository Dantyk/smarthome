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
  weather?: Weather;
  burstDuration: number; // hours, default 1
};

export const useHouse = create<House>()(
  persist(
    () => ({
      rooms: {},
      burstDuration: 1
    }),
    {
      name: 'house-storage',
      // Persist only necessary fields; keep it light
      partialize: (s: House) => ({
        rooms: s.rooms,
        weather: s.weather,
        burstDuration: s.burstDuration,
        mode: s.mode,
      }),
    }
  )
);
