'use client';
import { useHouse } from '@/store/useHouse';
import { useTheme, themes } from '@/store/useTheme';
import { useMqttSubscriptions } from '@/hooks/useMqttSubscriptions';
import { useInitialLoad } from '@/hooks/useInitialLoad';
import { useMqttReconnectGuard } from '@/hooks/useMqttReconnectGuard';
import { publish } from '@/lib/mqtt';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ROOMS = ['spalna','detska','obyvacka','kuchyna','kupelna'];
const ROOM_NAMES: Record<string,string> = {
  spalna: 'Spálňa',
  detska: 'Detská',
  obyvacka: 'Obývačka',
  kuchyna: 'Kuchyňa',
  kupelna: 'Kúpeľňa'
};
const ROOM_ICONS: Record<string,string> = {
  spalna: '🛏️',
  detska: '🧸',
  obyvacka: '🛋️',
  kuchyna: '🍳',
  kupelna: '🚿'
};

const ROOM_CONFIG: Record<string, {readonly?: boolean}> = {
  kupelna: { readonly: true }
};

export default function Home() {
  useMqttSubscriptions();
  useInitialLoad();
  useMqttReconnectGuard();
  
  const mode = useHouse(s=>s.mode) ?? '—';
  const rooms = useHouse(s=>s.rooms);
  const weather = useHouse(s=>s.weather);
  const { theme, toggleTheme } = useTheme();
  const colors = themes[theme];
  const router = useRouter();
  const tz = process.env.NEXT_PUBLIC_TZ || 'Europe/Bratislava';
  const locationNameEnv = process.env.NEXT_PUBLIC_LOCATION || 'Bratislava, SK';
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
  
  const [sliders, setSliders] = useState<Record<string,number>>({});
  const [burstDurations, setBurstDurations] = useState<Record<string,number>>({
    spalna: 1,
    detska: 1,
    obyvacka: 1,
    kuchyna: 1,
    kupelna: 1
  });
  
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
  
  const getRoomIcon = (room: string, current?: number, target?: number, override?: boolean) => {
    // Show burst/frost icons ONLY when override is active
    if (!override) return ROOM_ICONS[room];
    if (!current || !target) return ROOM_ICONS[room];
    
    if (current > target + 0.5) return '🔥'; // Burst (heating)
    if (current < target) return '❄️'; // Frost protection
    return ROOM_ICONS[room];
  };
  
  const activateBurst = (room: string, targetTemp: number, duration: number) => {
    const until = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    // Compatibility: publish to multiple topics that downstream flows môžu použiť
    publish(`virt/room/${room}/override_request`, { value: targetTemp, duration }, true);
    publish(`cmd/hvac/${room}/override_duration`, String(duration), true);
    publish(`cmd/hvac/${room}/setpoint`, String(targetTemp), true);
    publish(`cmd/hvac/${room}/override`, { active: true, value: targetTemp, duration, until }, true);
    // Optimisticky nastav override v UI, aby hneď vidieť trvanie
    useHouse.setState((s: any) => ({
      rooms: {
        ...s.rooms,
        [room]: { ...s.rooms[room], override: true, overrideValue: targetTemp, overrideUntil: until }
      }
    }));
    console.log(`[UI] Burst activated for ${room}: ${targetTemp}°C for ${duration}h`);
  };
  
  const cancelOverride = (room: string) => {
    publish(`cmd/hvac/${room}/cancel_override`, 'true', false);
    publish(`virt/room/${room}/override_request`, { active: false }, true);
    const defaultTemp = rooms[room]?.target ?? 21;
    publish(`cmd/hvac/${room}/setpoint`, String(defaultTemp), true);
    setSliders(prev => ({ ...prev, [room]: defaultTemp }));
    useHouse.setState((s: any) => ({
      rooms: {
        ...s.rooms,
        [room]: { ...s.rooms[room], override: false, overrideUntil: undefined, overrideValue: undefined }
      }
    }));
    console.log(`[UI] Override cancelled for ${room}`);
  };
  
  const toggleHvac = (room: string, enabled: boolean) => {
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
  };
  
  return (
    <main style={{ 
      minHeight: '100vh',
      background: colors.bg,
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
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
        border: `1px solid ${colors.border}`
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: colors.currentTemp }}>
          🏠 SmartHome
        </span>
        
        <div 
          onClick={() => router.push('/weather')}
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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
            {theme === 'dark' ? '☀️' : '��'}
          </button>
          
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Režim: <span style={{ fontWeight: 600, color: colors.text }}>{mode}</span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}>
        {ROOMS.map(r => {
          const rm = rooms[r] || {};
          const config = ROOM_CONFIG[r] || {};
          const hasData = rm.current !== undefined;
          const currentValue = rm.current ?? 0;
          const targetValue = Number(isFinite(Number(rm.target)) ? Number(rm.target) : 21);
          const sliderValue = Number(isFinite(Number(sliders[r])) ? Number(sliders[r]) : targetValue);
          const icon = getRoomIcon(r, currentValue, targetValue, rm.override);
          const remaining = getRemainingTime(rm.overrideUntil);
          const isReadonly = config.readonly || false;
          const hvacEnabled = rm.hvacEnabled ?? true;
          const roomBurstDuration = burstDurations[r] ?? 1;
          
          return (
            <div key={r} style={{
              background: colors.cardBg,
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${colors.border}`,
              boxShadow: theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32, pointerEvents: 'none' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: colors.text }}>
                    {ROOM_NAMES[r]}
                  </h3>
                  {rm.override && remaining && (
                    <span style={{ fontSize: 11, color: colors.currentTemp, fontWeight: 500 }}>
                      OVERRIDE {remaining}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasData && (
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#10b981'
                    }} />
                  )}
                  {!isReadonly && (
                    <button
                      onClick={() => toggleHvac(r, !hvacEnabled)}
                      title={hvacEnabled ? 'Vypnúť' : 'Zapnúť'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '4px 10px', borderRadius: 999,
                        border: `1px solid ${colors.border}`,
                        background: hvacEnabled ? '#064e3b' : '#3f3f46',
                        color: 'white', cursor: 'pointer'
                      }}
                    >
                      <span style={{
                        display: 'inline-block', width: 28, height: 16,
                        background: hvacEnabled ? '#10b981' : '#a1a1aa',
                        borderRadius: 999, position: 'relative'
                      }}>
                        <span style={{
                          position: 'absolute', top: 2, left: hvacEnabled ? 14 : 2,
                          width: 12, height: 12, background: 'white', borderRadius: '50%'
                        }} />
                      </span>
                      {hvacEnabled ? 'Zapnuté' : 'Vypnuté'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                  AKTUÁLNA TEPLOTA
                </div>
                <div style={{ fontSize: 40, fontWeight: 700, color: colors.currentTemp, lineHeight: 1 }}>
                  {hasData ? `${currentValue.toFixed(1)}°C` : '— °C'}
                </div>
                {rm.humidity !== undefined && (
                  <div style={{ fontSize: 16, color: colors.textSecondary, marginTop: 8 }}>
                    💧 {rm.humidity.toFixed(0)}%
                  </div>
                )}
              </div>

              {!isReadonly && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                      CIEĽ
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: colors.targetTemp }}>
                      {sliderValue.toFixed(1)}°C
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6 }}>
                      ⏱️ Burst
                    </div>
                    <select
                      value={roomBurstDuration}
                      onChange={(e) => {
                        const newDur = parseFloat(e.target.value);
                        setBurstDurations(prev => ({...prev, [r]: newDur}));
                        // Inform backend about selected duration
                        publish(`cmd/hvac/${r}/override_duration`, String(newDur), true);
                        // If override beží, predĺž/aktualizuj s aktuálnym cieľom
                        if (rm.override) {
                          activateBurst(r, sliderValue, newDur);
                        }
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.cardBg, color: colors.text }}
                    >
                      <option value={0.5}>30 min</option>
                      <option value={1}>1 h</option>
                      <option value={2}>2 h</option>
                      <option value={3}>3 h</option>
                      <option value={5}>5 h</option>
                      <option value={10}>10 h</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      onClick={() => {
                        const newVal = Math.max(16, sliderValue - 1);
                        setSliders(prev => ({ ...prev, [r]: newVal }));
                        activateBurst(r, newVal, roomBurstDuration);
                      }}
                      disabled={!hasData}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: colors.cardBg,
                        border: `2px solid ${colors.border}`,
                        borderRadius: 8,
                        cursor: hasData ? 'pointer' : 'not-allowed',
                        fontSize: 20,
                        color: colors.text,
                        opacity: hasData ? 1 : 0.5
                      }}
                    >
                      ❄️
                    </button>
                    <button
                      onClick={() => cancelOverride(r)}
                      disabled={!hasData}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: rm.override ? '#10b981' : colors.targetTemp,
                        border: 'none',
                        borderRadius: 8,
                        cursor: hasData ? 'pointer' : 'not-allowed',
                        fontSize: rm.override && remaining ? 10 : 13,
                        fontWeight: 700,
                        color: 'white',
                        opacity: hasData ? 1 : 0.5
                      }}
                    >
                      {rm.override && remaining ? `⏱️ ${remaining}` : 'AUTO'}
                    </button>
                    <button
                      onClick={() => {
                        const newVal = Math.min(28, sliderValue + 1);
                        setSliders(prev => ({ ...prev, [r]: newVal }));
                        activateBurst(r, newVal, roomBurstDuration);
                      }}
                      disabled={!hasData}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: colors.cardBg,
                        border: `2px solid ${colors.border}`,
                        borderRadius: 8,
                        cursor: hasData ? 'pointer' : 'not-allowed',
                        fontSize: 20,
                        color: colors.text,
                        opacity: hasData ? 1 : 0.5
                      }}
                    >
                      🔥
                    </button>
                  </div>

                  <input
                    type="range"
                    min={16}
                    max={28}
                    step={0.1}
                    value={sliderValue}
                    onChange={(e) => setSliders(prev => ({ ...prev, [r]: parseFloat(e.target.value) }))}
                    onMouseUp={() => activateBurst(r, sliderValue, roomBurstDuration)}
                    onTouchEnd={() => activateBurst(r, sliderValue, roomBurstDuration)}
                    className={hasData ? 'temp-slider active' : 'temp-slider disabled'}
                    style={{ width: '100%' }}
                    disabled={!hasData}
                  />
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: 12, 
                    color: colors.textSecondary,
                    marginTop: 8
                  }}>
                    <span>16°C</span>
                    <span>28°C</span>
                  </div>
                </>
              )}
              
              {isReadonly && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: colors.textSecondary, fontSize: 14 }}>
                  ⚙️ Teplota sa nedá nastaviť
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
