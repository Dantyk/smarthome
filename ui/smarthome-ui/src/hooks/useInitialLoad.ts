import { useEffect } from 'react';
import { useHouse } from '@/store/useHouse';

// Tries a few likely endpoints to fetch initial state. If none work, it fails silently.
// Expected shape (flexible): { mode?, weather?, rooms? }
export function useInitialLoad() {
  const set = useHouse.setState;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Načítaj zoznam miestností z Node-RED (/api/status) – bez hardcodu názvov
    (async () => {
      try {
        const cfgRes = await fetch('/api/config');
        const cfg = await cfgRes.json();
        const apiBase: string | undefined = cfg?.api;
        let roomsFromApi: string[] | undefined;
        if (apiBase) {
          const res = await fetch(`${apiBase}/api/status`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            // Extract room names from API response (handle both array of strings and array of objects)
            if (Array.isArray(data?.rooms)) {
              roomsFromApi = data.rooms.map((r: any) => typeof r === 'string' ? r : r.name);
            } else if (Array.isArray(data?.modes?.rooms)) {
              roomsFromApi = data.modes.rooms.map((r: any) => typeof r === 'string' ? r : r.name);
            }
          }
        }
        set((s: any) => seedDefaultsIfEmpty(s, roomsFromApi));
      } catch {
        // Tichý fallback – bez seedovania miestností, MQTT doplní retained dáta
        set((s: any) => seedDefaultsIfEmpty(s));
      }
    })();
  }, [set]);
}

function mergeRooms(current: Record<string, any>, incoming: Record<string, any>) {
  // Normalize a few common shapes; keep existing values if missing.
  const result: Record<string, any> = { ...current };
  Object.entries(incoming || {}).forEach(([room, v]) => {
    const src = v || {};
    const prev = current[room] || {};

    // Accept various key names for enabled/target/current/humidity
    const enabled = coerceBool(src.enabled ?? src.hvacEnabled ?? prev.hvacEnabled);
    const target = coerceNum(src.target ?? src.setpoint ?? src.target_temp ?? prev.target) ?? 21; // Default to 21 if undefined
    const currentTemp = coerceNum(src.current ?? src.current_temp ?? src.temperature ?? prev.current);
    const humidity = coerceNum(src.humidity ?? src.rh ?? prev.humidity);

    result[room] = {
      ...prev,
      hvacEnabled: enabled,
      target,
      current: currentTemp,
      humidity,
      override: src.override?.active ?? prev.override,
      overrideValue: src.override?.value ?? prev.overrideValue,
      overrideUntil: src.override?.until ?? prev.overrideUntil,
    };
  });
  return result;
}

function coerceBool(v: any): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'yes';
}

function coerceNum(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function seedDefaultsIfEmpty(state: any, roomsFromApi?: string[]) {
  const next = { ...state };
  const hasAnyRoom = Object.keys(state.rooms || {}).length > 0;
  const hasWeather = !!(state.weather && (state.weather.temp !== undefined || (state.weather.hourly && state.weather.hourly.length)));
  
  // Zoznam miestností berieme z API (modes.yaml). Žiadne hardcodované názvy.
  // Použijeme roomList zo store (zachováva poradie) alebo roomsFromApi
  const ROOMS = Array.isArray(roomsFromApi) && roomsFromApi.length > 0
    ? roomsFromApi
    : (Array.isArray(state.roomList) && state.roomList.length > 0)
      ? state.roomList
      : [];
  
  // Uložíme poradie miestností do store
  if (Array.isArray(roomsFromApi) && roomsFromApi.length > 0) {
    next.roomList = roomsFromApi;
  }
  
  // Seed rooms
  if (!hasAnyRoom && ROOMS.length > 0) {
    next.rooms = {};
    for (const r of ROOMS) {
      next.rooms[r] = {
        target: 21,
        hvacEnabled: true,
        current: undefined,
        humidity: undefined,
        override: false
      };
    }
  }
  // Seed weather sample
  if (!hasWeather) {
    const loc = process.env.NEXT_PUBLIC_LOCATION || 'Bratislava, SK';
    const baseTemp = 20;
    const now = new Date();
    const tz = process.env.NEXT_PUBLIC_TZ || 'Europe/Bratislava';
    const hourly = Array.from({ length: 12 }).map((_, i) => {
      const t = new Date(now.getTime() + (i+1) * 60 * 60 * 1000);
      const temp = baseTemp + Math.sin(i/3) * 1.5; // mierna variácia
      const time = new Intl.DateTimeFormat('sk-SK', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(t);
      return { time, temp: Math.round(temp*10)/10, icon: '02d' };
    });
    next.weather = {
      temp: baseTemp,
      description: 'čiastočne oblačno',
      icon: '02d',
      humidity: 50,
      wind_speed: 5,
      hourly,
      location: loc.split(',')[0],
      country: (loc.split(',')[1] || '').trim()
    };
  }
  return next;
}
