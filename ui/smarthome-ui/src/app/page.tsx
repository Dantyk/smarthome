'use client';
import { useHouse } from '@/store/useHouse';
import { useTheme, themes } from '@/store/useTheme';
import { useMqttSubscriptions } from '@/hooks/useMqttSubscriptions';
import { useInitialLoad } from '@/hooks/useInitialLoad';
import { useMqttReconnectGuard } from '@/hooks/useMqttReconnectGuard';
import { publish } from '@/lib/mqtt';
import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import React from 'react';
import RoomCard from '@/components/RoomCard';

type RoomCapabilities = {
  temp_sensor?: boolean;
  humidity_sensor?: boolean;
  hvac_control?: boolean;
  temp_control?: boolean;
};

export default function Home() {
  useMqttSubscriptions();
  useInitialLoad();
  useMqttReconnectGuard();
  
  const mode = useHouse(s=>s.mode) ?? '—';
  const rooms = useHouse(s=>s.rooms);
  const weather = useHouse(s=>s.weather);
  const [roomCapabilities, setRoomCapabilities] = useState<Record<string, RoomCapabilities>>({});
  const { theme, toggleTheme } = useTheme();
  const colors = useMemo(() => themes[theme], [theme]);
  const router = useRouter();
  const tz = process.env.NEXT_PUBLIC_TZ || 'Europe/Bratislava';
  const locationNameEnv = process.env.NEXT_PUBLIC_LOCATION || 'Bratislava, SK';
  
  // Initialize and stabilize room list in state to avoid re-renders changing order
  const roomList = useHouse(s => s.roomList);
  useEffect(() => {
    if (Object.keys(rooms).length > 0 && (!roomList || roomList.length === 0)) {
      const newRoomList = Object.keys(rooms).sort();
      useHouse.setState({ roomList: newRoomList });
      console.log('[UI] Initialized stable roomList:', newRoomList);
    }
  }, [rooms, roomList]);
  
  // Build room list from persisted `roomList` if present, otherwise from actual rooms keys.
  const ROOM_LIST = roomList && roomList.length > 0 ? roomList : (rooms ? Object.keys(rooms).sort() : []);
  const [now, setNow] = useState<string>('');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('sk-SK', { 
      timeZone: tz, 
      hour: '2-digit', minute: '2-digit', second: undefined, 
      weekday: 'short', day: '2-digit', month: '2-digit'
    });
    const update = () => setNow(fmt.format(new Date()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [tz]);
  // Note: removed direct DOM-manipulation here (previously attempted to
  // enable sliders after hydrate). With `RoomControls` loaded client-side
  // (ssr: false) we avoid server-side disabled inputs and shouldn't need
  // to touch DOM directly — direct DOM changes could interrupt pointer
  // interactions and cause the flicker observed during drag.
  
  const [sliders, setSliders] = useState<Record<string,number>>({});
  const [burstDurations, setBurstDurations] = useState<Record<string,number>>({
    bedroom: 1,
    kidroom1: 1,
    living: 1,
    kitchen: 1,
    bathroom: 1
  });

  const RoomControls = dynamic(() => import('@/components/RoomControls'), { ssr: false });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  
  // Load room capabilities from API
  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
        if (!apiBase) {
          console.warn('[UI] No API base configured for capabilities');
          return;
        }
        const url = `${apiBase.replace(/\/$/, '')}/api/rooms/capabilities`;
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && json.data) {
          setRoomCapabilities(json.data);
          console.log('[UI] Room capabilities loaded:', json.data);
        }
      } catch (err) {
        console.error('[UI] Failed to load room capabilities:', err);
      }
    };
    loadCapabilities();
  }, []);
  
  // Sync slider state with incoming boost target temps from MQTT
  useEffect(() => {
    ROOM_LIST.forEach(room => {
      const rm = rooms[room];
      if (rm?.boostActive && rm.boostTargetTemp !== undefined && !isNaN(rm.boostTargetTemp)) {
        setSliders(prev => {
          // Only update if different to avoid infinite loops
          if (prev[room] !== rm.boostTargetTemp) {
            return { ...prev, [room]: rm.boostTargetTemp };
          }
          return prev;
        });
      }
    });
  }, [rooms, ROOM_LIST]);
  
  // Initialize sliders from MQTT data (no UI-invented defaults)
  useEffect(() => {
    ROOM_LIST.forEach(room => {
      const rm = rooms[room];
      
      // Only set slider if we have actual MQTT data
      if (sliders[room] === undefined) {
        if (rm?.boostActive && rm.boostTargetTemp !== undefined && !isNaN(rm.boostTargetTemp)) {
          setSliders(prev => ({ ...prev, [room]: rm.boostTargetTemp }));
        } else if (rm?.target !== undefined && !isNaN(rm.target)) {
          setSliders(prev => ({ ...prev, [room]: rm.target }));
        }
        // If no MQTT data, don't set anything - wait for Node-RED defaults
      }
    });
  }, [rooms, ROOM_LIST]);
  
  const getRemainingTime = (overrideUntil?: string) => {
    if (!overrideUntil) return null;
    const now = new Date();
    const until = new Date(overrideUntil);
    const diff = until.getTime() - now.getTime();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  
  const getRoomIcon = (room: string, current?: number, target?: number, override?: boolean, boostActive?: boolean) => {
    // Icon rendering is controlled by room config (rm.icon). This helper keeps
    // the old logic for deciding special icons like 🔥/❄️ when override/boost
    // is active, but if no icon is configured we won't show a default emoji.
    if (boostActive) return '🔥';
    if (!override) return undefined as any;
    if (!current || !target) return undefined as any;
    if (current > target + 0.5) return '🔥';
    if (current < target) return '❄️';
    return undefined as any;
  };
  
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
  const refreshState = async () => {
    if (!apiBase) {
      console.warn('[UI] No API base configured, cannot refresh');
      return;
    }
    try {
      const url = `${apiBase.replace(/\/$/, '')}/ui/state`;
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.weather) {
        useHouse.setState((s:any) => ({ weather: { ...(s.weather || {}), ...data.weather } }));
        console.log('[UI] Weather refreshed from API');
      }
      if (data.mode) {
        useHouse.setState({ mode: data.mode });
      }
      if (data.rooms) {
        // Merge simple room names/labels into store
        const roomsObj: Record<string, any> = {};
        if (Array.isArray(data.rooms)) {
          for (const room of data.rooms) {
            roomsObj[room.name] = { ...room };
          }
        }
        useHouse.setState((s:any) => ({ rooms: { ...s.rooms, ...roomsObj } }));
      }
    } catch (e) {
      console.warn('[UI] refreshState failed', e);
    }
  };
  const activateBurst = useCallback((room: string, targetTemp: number, duration: number) => {
    const until = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    
    // NEW: Send boost messages (duration in minutes!)
    const durationMinutes = Math.round(duration * 60);
    publish(`virt/boost/${room}/minutes`, String(durationMinutes), true);
    publish(`virt/boost/${room}/target_temp`, String(targetTemp), true);
    
    // LEGACY: Keep old override topics for compatibility
    publish(`virt/room/${room}/override_request`, { value: targetTemp, duration }, true);
    publish(`cmd/hvac/${room}/override_duration`, String(duration), true);
    publish(`cmd/hvac/${room}/setpoint`, String(targetTemp), true);
    publish(`cmd/hvac/${room}/override`, { active: true, value: targetTemp, duration, until }, true);
    
    // Optimistically update UI state
    useHouse.setState((s: any) => ({
      rooms: {
        ...s.rooms,
        [room]: { 
          ...s.rooms[room], 
          override: true, 
          overrideValue: targetTemp, 
          overrideUntil: until,
          boostActive: true,
          boostMinutes: durationMinutes,
          boostTargetTemp: targetTemp
        }
      }
    }));
    console.log(`[UI] Burst activated for ${room}: ${targetTemp}°C for ${duration}h (${durationMinutes}min)`);
  }, []);
  
  const cancelOverride = useCallback((room: string) => {
    // Clear boost state
    publish(`virt/boost/${room}/minutes`, '0', true);
    publish(`virt/boost/${room}/target_temp`, '0', true);
    
    // Clear legacy override
    publish(`cmd/hvac/${room}/cancel_override`, 'true', false);
    publish(`virt/room/${room}/override_request`, { active: false }, true);
    const defaultTemp = rooms[room]?.target ?? 21;
    publish(`cmd/hvac/${room}/setpoint`, String(defaultTemp), true);
    setSliders(prev => ({ ...prev, [room]: defaultTemp }));
    
    // Update UI state
    useHouse.setState((s: any) => ({
      rooms: {
        ...s.rooms,
        [room]: { 
          ...s.rooms[room], 
          override: false, 
          overrideUntil: undefined, 
          overrideValue: undefined,
          boostActive: false,
          boostMinutes: 0,
          boostTargetTemp: undefined
        }
      }
    }));
    console.log(`[UI] Override and boost cancelled for ${room}`);
  }, [setSliders, rooms]);
  
  const toggleHvac = useCallback((room: string, enabled: boolean) => {
    // Optimistic UI update so the switch flips immediately
    useHouse.setState((s: any) => ({
      rooms: {
        ...s.rooms,
        [room]: { ...s.rooms[room], hvacEnabled: enabled }
      }
    }));
    publish(`cmd/hvac/${room}/enabled`, String(enabled), true);
    publish(`virt/room/${room}/enabled`, String(enabled), true);
    console.log(`[UI] HVAC ${enabled ? 'enabled' : 'disabled'} for ${room}`);
  }, []);

  // Stable handlers to avoid passing inline functions to child
  const setSlidersHandler = useCallback((updater: (prev: Record<string,number>) => Record<string,number>) => {
    setSliders(prev => updater(prev));
  }, [setSliders]);

  const setBurstDurationsHandler = useCallback((v: Record<string,number>) => {
    setBurstDurations(v);
  }, [setBurstDurations]);
  
  return (
    <main style={{ 
      minHeight: '100vh',
      background: colors.bg,
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <style>{`
        @media (max-width: 640px) {
          .weather-info { flex-direction: column !important; gap: 8px !important; }
          .header-controls { flex-direction: column !important; gap: 8px !important; align-items: flex-end !important; }
          .room-title { font-size: 16px !important; }
          .temp-current { font-size: 32px !important; }
          .temp-target { font-size: 20px !important; }
        }
      `}</style>
      <div style={{
        background: colors.headerBg,
        backdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: colors.headerShadow,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: `1px solid ${colors.border}`,
        flexWrap: 'wrap',
        gap: 12
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: colors.currentTemp }}>
          🏠 SmartHome
        </span>
        
        <div 
          onClick={() => router.push('/weather')}
          className="weather-info"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.cardBg,
            transition: 'all 0.2s'
          }}
        >
          {weather?.icon && (
            <img 
              src={`https://openweathermap.org/img/wn/${weather.icon}.png`} 
              alt="weather" 
              style={{ width: 40, height: 40 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
              {weather?.temp ? `${weather.temp.toFixed(1)}°C` : '—'}
            </span>
            <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
              {weather?.description || 'Načítavam...'}
            </span>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>
              {now} • {weather?.location ? `${weather.location}${weather.country ? ', ' + weather.country : ''}` : locationNameEnv}
            </span>
          </div>
        </div>
        
        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={toggleTheme}
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 20,
              color: colors.text
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>Mód</div>
            <div style={{ padding: '6px 10px', borderRadius: 999, background: colors.cardBg, border: `1px solid ${colors.border}`, fontWeight: 600, color: colors.text }}>{mode}</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}>
        {ROOM_LIST.map(r => (
          <div key={r}>
            <RoomCard
              room={r}
              colors={colors}
              theme={theme}
              capabilities={roomCapabilities[r]}
              activateBurst={activateBurst}
              cancelOverride={cancelOverride}
              toggleHvac={toggleHvac}
              setSlidersHandler={setSlidersHandler}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
