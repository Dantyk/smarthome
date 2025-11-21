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
      const raw = td.decode(m);
      let v: number | undefined;
      try {
        const obj = JSON.parse(raw);
        v = typeof obj === 'object' && obj.value !== undefined ? parseFloat(obj.value) : parseFloat(raw);
      } catch {
        v = parseFloat(raw);
      }
      v = Number.isFinite(v) ? v : undefined;
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
    
    // Subscribe to active mode (single dominant regime for entire household)
    const offC = subscribe('virt/system/active_mode', (_t, m) => {
      try {
        const raw = td.decode(m);
        const mode = raw.trim();
        console.log('[UI] Active mode received:', mode);
        set({ mode });
      } catch (e) {
        console.warn('[UI] Active mode parse failed:', e);
      }
    });
    
  const offD = subscribe('virt/weather/current', (_t, m) => {
      try {
        const raw = td.decode(m);
        let data: any;
        try { data = JSON.parse(raw); } catch { data = raw; }
        console.log('[UI] Weather received (raw):', raw);

        // If payload is plain number or string, coerce to temp only
        if (typeof data === 'string' || typeof data === 'number') {
          const temp = parseFloat(String(data));
          set((s: any) => ({ weather: { ...(s.weather || {}), temp } }));
          return;
        }

        // Parse JSON weather object
        set((s: any) => ({ weather: {
          ...(s.weather || {}),
          temp: data.temp,
          description: data.description,
          icon: data.icon,
          humidity: data.humidity,
          wind_speed: data.wind_speed,
          location: data.location || (s.weather ? s.weather.location : undefined),
          country: data.country || (s.weather ? s.weather.country : undefined)
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
          let timeStr = '';
          
          if (ts) {
            try {
              // Check if ts is ISO string or UNIX timestamp
              const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
              if (!isNaN(date.getTime())) {
                timeStr = date.toLocaleTimeString('sk-SK', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
              } else {
                console.warn('[UI] Invalid date from ts:', ts);
                timeStr = String(h.hour || '').padStart(2, '0') + ':00';
              }
            } catch (err) {
              console.error('[UI] Date parsing error:', err, 'ts:', ts);
              timeStr = String(h.hour || '').padStart(2, '0') + ':00';
            }
          } else if (h.hour !== undefined) {
            // Fallback: use hour field
            timeStr = String(h.hour).padStart(2, '0') + ':00';
          } else {
            timeStr = (typeof h.time === 'string' ? h.time : (h.dt_txt ? h.dt_txt : '—'));
          }
          
          return {
            time: timeStr || '—',
            temp: h.main?.temp ?? h.temp ?? h.temperature ?? 0,
            icon: h.weather?.[0]?.icon ?? h.icon ?? '01d'
          };
        });
        set((s: any) => ({ weather: { ...(s.weather || {}), hourly: mapped }}));
        console.log('[UI] Hourly weather received:', mapped.length, 'first time:', mapped[0]?.time);
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
          let timeStr = '';
          
          if (ts) {
            try {
              // Check if ts is ISO string or UNIX timestamp
              const date = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
              if (!isNaN(date.getTime())) {
                timeStr = date.toLocaleTimeString('sk-SK', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
              } else {
                timeStr = String(h.hour || '').padStart(2, '0') + ':00';
              }
            } catch (err) {
              timeStr = String(h.hour || '').padStart(2, '0') + ':00';
            }
          } else if (h.hour !== undefined) {
            timeStr = String(h.hour).padStart(2, '0') + ':00';
          } else {
            timeStr = (h.dt_txt || h.time || '—');
          }
          
          const temp = h.main?.temp ?? h.temp ?? h.temperature ?? h.temp_min ?? 0;
          const icon = h.weather?.[0]?.icon ?? h.icon ?? '01d';
          return { time: timeStr || '—', temp, icon };
        });
        set((s: any) => ({ weather: { ...(s.weather || {}), hourly: mapped }}));
        console.log('[UI] Forecast mapped to hourly:', mapped.length, 'first time:', mapped[0]?.time);
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
    
    // Subscribe to boost minutes (virt/boost/+/minutes)
    const offBoostMinutes = subscribe('virt/boost/+/minutes', (t, m) => {
      const room = t.split('/')[2];
      const minutes = parseInt(td.decode(m), 10);
      console.log(`[UI] Boost minutes for ${room}:`, minutes);
      set((s: any) => ({ 
        rooms: { 
          ...s.rooms, 
          [room]: { 
            ...s.rooms[room], 
            boostMinutes: minutes,
            boostActive: minutes > 0
          }
        }
      }));
    });
    
    // Subscribe to boost target temp (virt/boost/+/target_temp)
    const offBoostTemp = subscribe('virt/boost/+/target_temp', (t, m) => {
      const room = t.split('/')[2];
      const temp = parseFloat(td.decode(m));
      console.log(`[UI] Boost target temp for ${room}:`, temp);
      set((s: any) => ({ 
        rooms: { 
          ...s.rooms, 
          [room]: { 
            ...s.rooms[room], 
            boostTargetTemp: temp
          }
        }
      }));
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
      offBoostMinutes();
      offBoostTemp();
      releaseMqtt();
    };
  }, [set]);
}
