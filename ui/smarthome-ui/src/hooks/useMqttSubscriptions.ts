import { useEffect } from 'react';
import { subscribe, getMqtt, releaseMqtt } from '@/lib/mqtt';
import { useHouse } from '@/store/useHouse';

export function useMqttSubscriptions() {
  const set = useHouse.setState;
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('[useMqttSubscriptions] Initializing MQTT connection and subscriptions');
    
    // Initialize connection
    const client = getMqtt();
    if (!client) {
      console.error('[useMqttSubscriptions] Failed to get MQTT client');
      return;
    }
    
    const td = new TextDecoder();
    
    // Subscribe to all topics
    const offA = subscribe('stat/hvac/+/current_temp', (t, m) => {
      const room = t.split('/')[2];
      const v = parseFloat(td.decode(m));
      set((s: any) => ({ rooms: { ...s.rooms, [room]: { ...s.rooms[room], current: v }}}));
    });
    
    const offB = subscribe('virt/room/+/target_temp', (t, m) => {
      const room = t.split('/')[2];
      const v = parseFloat(td.decode(m));
      set((s: any) => ({ rooms: { ...s.rooms, [room]: { ...s.rooms[room], target: v }}}));
    });
    
    const offHum = subscribe('stat/hvac/+/humidity', (t, m) => {
      const room = t.split('/')[2];
      const v = parseFloat(td.decode(m));
      set((s: any) => ({ rooms: { ...s.rooms, [room]: { ...s.rooms[room], humidity: v }}}));
    });
    
    const offHvac = subscribe('stat/hvac/+/enabled', (t, m) => {
      const room = t.split('/')[2];
      const raw = td.decode(m).toLowerCase();
      const v = raw === 'true' || raw === '1' || raw === 'on';
      set((s: any) => ({ rooms: { ...s.rooms, [room]: { ...s.rooms[room], hvacEnabled: v }}}));
    });

    // Also accept enabled updates from virt topic (e.g., UI echo or flows)
    const offHvacVirt = subscribe('virt/room/+/enabled', (t, m) => {
      const room = t.split('/')[2];
      const raw = td.decode(m).toLowerCase();
      const v = raw === 'true' || raw === '1' || raw === 'on';
      set((s: any) => ({ rooms: { ...s.rooms, [room]: { ...s.rooms[room], hvacEnabled: v }}}));
    });
    
    const offC = subscribe('virt/mode/current', (_t, m) => { 
      try {
        const data = JSON.parse(td.decode(m));
        console.log('[UI] Mode received:', data.mode);
        set({ mode: data.mode });
      } catch (e) {
        console.error('[UI] Failed to parse mode:', e);
      }
    });
    
  const offD = subscribe('virt/weather/current', (_t, m) => {
      try {
        const data = JSON.parse(td.decode(m));
        console.log('[UI] Weather received:', data.temp);
        // Extract hourly forecast if present; otherwise keep existing hourly
        const incomingHourly = Array.isArray(data.hourly)
          ? (data.hourly as any[]).slice(0, 6).map((h: any) => ({
              time: h.dt_txt || new Date((h.dt || h.ts || Date.now()/1000) * 1000).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' }),
              temp: h.main?.temp ?? h.temp,
              icon: h.weather?.[0]?.icon || h.icon || '01d'
            }))
          : undefined;

        set((s: any) => ({ weather: {
          ...(s.weather || {}),
          temp: data.temp,
          description: data.description,
          icon: data.icon,
          humidity: data.humidity,
          wind_speed: data.wind_speed,
          location: data.location || (s.weather ? s.weather.location : undefined),
          country: data.country || (s.weather ? s.weather.country : undefined),
          ...(incomingHourly && incomingHourly.length ? { hourly: incomingHourly } : {})
        }}));
      } catch (e) {
        console.error('[UI] Failed to parse weather:', e);
      }
    });
    
    // Dedicated hourly forecast feed (flexible schema support)
    const offHourly = subscribe('virt/weather/hourly', (_t, m) => {
      try {
        const raw = td.decode(m);
        const data = JSON.parse(raw);
        let hourly: any[] = [];
        if (Array.isArray(data)) {
          hourly = data;
        } else if (Array.isArray(data.list)) {
          hourly = data.list;
        } else if (Array.isArray(data.hourly)) {
          hourly = data.hourly;
        }
        const tz = process.env.NEXT_PUBLIC_TZ || undefined;
        const mapped = (hourly || []).map((h: any) => {
          const ts = h.dt || h.ts;
          const timeStr = ts
            ? new Date(ts * 1000).toLocaleTimeString('sk-SK', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
            : (typeof h.time === 'string' ? h.time : (h.dt_txt ? h.dt_txt : ''));
          return {
            time: timeStr,
            temp: h.main?.temp ?? h.temp ?? h.temperature ?? 0,
            icon: h.weather?.[0]?.icon ?? h.icon ?? '01d'
          };
        });
        set((s: any) => ({ weather: { ...(s.weather || {}), hourly: mapped }}));
        console.log('[UI] Hourly weather received:', mapped.length);
      } catch (e) {
        console.error('[UI] Failed to parse hourly weather:', e);
      }
    });

    // Some flows publish forecast instead of hourly – map it to hourly too
    const offForecast = subscribe('virt/weather/forecast', (_t, m) => {
      try {
        const raw = td.decode(m);
        const data = JSON.parse(raw);
        const tz = process.env.NEXT_PUBLIC_TZ || undefined;
        const list: any[] = Array.isArray(data) ? data : (Array.isArray(data?.list) ? data.list : []);
        const mapped = list.map((h: any) => {
          const ts = h.dt || h.ts;
          const timeStr = ts
            ? new Date(ts * 1000).toLocaleTimeString('sk-SK', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
            : (h.dt_txt || h.time || '');
          const temp = h.main?.temp ?? h.temp ?? h.temperature ?? h.temp_min ?? 0;
          const icon = h.weather?.[0]?.icon ?? h.icon ?? '01d';
          return { time: timeStr, temp, icon };
        });
        set((s: any) => ({ weather: { ...(s.weather || {}), hourly: mapped }}));
        console.log('[UI] Forecast mapped to hourly:', mapped.length);
      } catch (e) {
        console.error('[UI] Failed to parse forecast:', e);
      }
    });
    
    // Subscribe to override info (virt/room/+/override)
    const offE = subscribe('virt/room/+/override', (t, m) => {
      const room = t.split('/')[2];
      try {
        const data = JSON.parse(td.decode(m));
        set((s: any) => ({ 
          rooms: { 
            ...s.rooms, 
            [room]: { 
              ...s.rooms[room], 
              override: data.active || false,
              overrideValue: data.value,
              overrideUntil: data.until
            }
          }
        }));
      } catch (e) {
        const rawValue = td.decode(m);
        if (rawValue === 'false' || rawValue === '0') {
          set((s: any) => ({ 
            rooms: { 
              ...s.rooms, 
              [room]: { 
                ...s.rooms[room], 
                override: false
              }
            }
          }));
        }
      }
    });
    
    // Cleanup function
    return () => {
      console.log('[useMqttSubscriptions] Cleaning up subscriptions');
      offA();
      offB();
      offHum();
      offHvac();
  offHvacVirt();
      offC();
      offD();
  offHourly();
  offForecast();
      offE();
      releaseMqtt();
    };
  }, [set]);
}
