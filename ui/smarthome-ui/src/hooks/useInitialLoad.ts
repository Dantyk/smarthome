import { useEffect } from 'react';
import { useHouse } from '@/store/useHouse';

// Tries a few likely endpoints to fetch initial state. If none work, it fails silently.
// Expected shape (flexible): { mode?, weather?, rooms? }
export function useInitialLoad() {
  const set = useHouse.setState;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const base = process.env.NEXT_PUBLIC_API_BASE;
    // We'll still proceed even if API is not set: at the end, we can seed defaults if needed

    const tryEndpoints = base ? [
      `${base.replace(/\/$/, '')}/ui/state`,
      `${base.replace(/\/$/, '')}/state`,
      `${base.replace(/\/$/, '')}/status`,
    ] : [];

    const controller = new AbortController();

    (async () => {
      let loaded = false;
      for (const url of tryEndpoints) {
        try {
          const res = await fetch(url, { signal: controller.signal, headers: { 'accept': 'application/json' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          console.log('[useInitialLoad] Initial state loaded from', url);
          set((s: any) => {
            // Extract rooms from API response: convert array [{name, ...}] to object {name: {...}}
            const roomsObj: Record<string, any> = {};
            if (Array.isArray(data.rooms)) {
              for (const room of data.rooms) {
                roomsObj[room.name] = { current_temp: room.current_temp, target_temp: room.target_temp, ...room };
              }
            }
            return {
              mode: data.mode ?? s.mode,
              weather: data.weather ? { ...(s.weather || {}), ...data.weather } : s.weather,
              rooms: mergeRooms(s.rooms, roomsObj || data.hvac || data.zones || {})
            };
          });
          loaded = true;
          break;
        } catch (e) {
          console.warn('[useInitialLoad] Failed', url, e);
          continue;
        }
      }
      if (!loaded) {
        console.log('[useInitialLoad] No initial REST endpoint responded – relying on retained MQTT and persisted store');
      }
      // After attempts (or no API), if store is still effectively empty, seed defaults
      set((s: any) => seedDefaultsIfEmpty(s));
    })();

    return () => controller.abort();
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

function seedDefaultsIfEmpty(state: any) {
  const next = { ...state };
  const hasAnyRoom = Object.keys(state.rooms || {}).length > 0;
  const hasWeather = !!(state.weather && (state.weather.temp !== undefined || (state.weather.hourly && state.weather.hourly.length)));
  
  // Default rooms - will be overridden by API if available
  const DEFAULT_ROOMS = ['bedroom','kidroom1','living','kitchen','bathroom'];
  const ROOMS = hasAnyRoom ? Object.keys(state.rooms) : DEFAULT_ROOMS;
  
  // Seed rooms
  if (!hasAnyRoom) {
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
