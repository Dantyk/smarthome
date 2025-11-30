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
  const roomListFromStore = useHouse(s=>s.roomList) ?? [];
  const [roomCapabilities, setRoomCapabilities] = useState<Record<string, RoomCapabilities>>({});
  const [roomOrder, setRoomOrder] = useState<string[]>([]);
  const [roomLabels, setRoomLabels] = useState<Record<string, string>>({});
  const [roomIcons, setRoomIcons] = useState<Record<string, string>>({});
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const { theme, toggleTheme } = useTheme();
  const colors = useMemo(() => themes[theme], [theme]);
  const router = useRouter();
  const tz = process.env.NEXT_PUBLIC_TZ || 'Europe/Bratislava';
  const locationNameEnv = process.env.NEXT_PUBLIC_LOCATION || 'Bratislava, SK';
  
  // Use ONLY room order from API (modes.yaml), ignore MQTT-discovered rooms
  const ROOM_LIST = useMemo(() => {
    // Priority: 1) fresh API data, 2) store roomList, 3) empty
    if (roomOrder.length > 0) {
      return roomOrder;
    }
    if (roomListFromStore.length > 0) {
      return roomListFromStore;
    }
    return [];
  }, [roomOrder, roomListFromStore]);
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
    spalna: 1,
    detska: 1,
    obyvacka: 1,
    kuchyna: 1,
    kupelna: 1
  });

  const RoomControls = dynamic(() => import('@/components/RoomControls'), { ssr: false });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  
  // Load dynamic config and room capabilities from API
  const [apiBase, setApiBase] = useState<string>('');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const loadConfig = async () => {
      try {
        // First, load dynamic config (hostname-based URLs)
        const cfgRes = await fetch('/api/config');
        if (!cfgRes.ok) throw new Error(`Config API failed: ${cfgRes.status}`);
        const cfg = await cfgRes.json();
        console.log('[UI] Dynamic config loaded:', cfg);
        setApiBase(cfg.api);
        
        // Get current version
        const verRes = await fetch('/api/version');
        if (verRes.ok) {
          const ver = await verRes.json();
          setCurrentVersion(ver.version);
          console.log('[UI] Current version:', ver.version);
        }
        
        // Then load room capabilities from Node-RED
        const url = `${cfg.api.replace(/\/$/, '')}/api/rooms/capabilities`;
        console.log('[UI] Loading capabilities from:', url);
        const res = await fetch(url, { headers: { accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && json.data) {
          setRoomCapabilities(json.data.capabilities || json.data);
          const newRoomOrder = json.data.rooms || [];
          setRoomOrder(newRoomOrder);
          setRoomLabels(json.data.labels || {});
          setRoomIcons(json.data.icons || {});
          
          // Update store with new room order
          if (newRoomOrder.length > 0) {
            useHouse.setState({ roomList: newRoomOrder });
          }
          
          console.log('[UI] Room data loaded:', json.data);
        }
      } catch (err) {
        console.error('[UI] Failed to load config or room data:', err);
      }
    };
    loadConfig();
    
    // Listen for config updates from MQTT
    const handleCapabilitiesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      console.log('[MQTT] 🔄 Updating capabilities from MQTT event:', data);
      setRoomCapabilities(data.capabilities || data);
      const newRoomOrder = data.rooms || [];
      setRoomOrder(newRoomOrder);
      setRoomLabels(data.labels || {});
      setRoomIcons(data.icons || {});
      
      // Update store with new room order
      if (newRoomOrder.length > 0) {
        useHouse.setState({ roomList: newRoomOrder });
      }
    };
    
    window.addEventListener('capabilities-updated', handleCapabilitiesUpdate);
    
    return () => {
      window.removeEventListener('capabilities-updated', handleCapabilitiesUpdate);
    };
  }, []);
  
  // Check for new UI version periodically
  useEffect(() => {
    if (typeof window === 'undefined' || !currentVersion) return;
    
    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { 
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version !== currentVersion) {
          console.log('[UI] 🔄 Nová verzia detegovaná:', data.version, '(aktuálna:', currentVersion + ')');
          console.log('[UI] Reloadujem stránku za 2 sekundy...');
          
          // Show visual notification
          document.body.style.opacity = '0.7';
          document.body.style.pointerEvents = 'none';
          
          // Wait 2 seconds before reload
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Clear all caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
          }
          
          // Hard reload with cache bypass
          window.location.href = window.location.href + '?t=' + Date.now();
        }
      } catch (err) {
        console.error('[UI] Version check failed:', err);
      }
    };
    
    // Check every 60 seconds (1 minute)
    const interval = setInterval(checkVersion, 60 * 1000);
    
    // Also check immediately after 10 seconds
    const initialCheck = setTimeout(checkVersion, 10000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(initialCheck);
    };
  }, [currentVersion]);
  
  // Sync slider state with incoming target temps from MQTT
  useEffect(() => {
    ROOM_LIST.forEach(room => {
      const rm = rooms[room];
      
      // Update slider based on current state
      let targetTemp: number | undefined;
      
      if (rm?.boostActive && rm.boostTargetTemp !== undefined && !isNaN(rm.boostTargetTemp)) {
        // Boost is active - ONLY use boost temperature (ignore rm.target which gets updated by MQTT)
        targetTemp = rm.boostTargetTemp;
      } else if (rm?.scheduledTemp !== undefined && !isNaN(rm.scheduledTemp)) {
        // No boost - prefer scheduledTemp (baseline from planner)
        targetTemp = rm.scheduledTemp;
      } else if (rm?.target !== undefined && !isNaN(rm.target)) {
        // Fallback - use target if scheduledTemp not available yet
        targetTemp = rm.target;
      }
      
      if (targetTemp !== undefined) {
        setSliders(prev => {
          // Only update if different to avoid infinite loops
          if (prev[room] !== targetTemp) {
            return { ...prev, [room]: targetTemp };
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
    
    // DON'T send setpoint - let Node-RED resolver recalculate from schedule
    // (rooms[room].target is already the boost value, not the original scheduled value)
    
    // Update UI state optimistically
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
    
    // Slider will update from MQTT when Node-RED publishes the new scheduled target
    console.log(`[UI] Override and boost cancelled for ${room}, waiting for scheduled target from Node-RED`);
  }, []);
  
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
              roomLabel={roomLabels[r] || r}
              roomIcon={roomIcons[r]}
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
