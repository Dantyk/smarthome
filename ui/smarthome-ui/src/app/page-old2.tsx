'use client';
import { useHouse } from '@/store/useHouse';
import { useTheme, themes } from '@/store/useTheme';
import { useMqttSubscriptions } from '@/hooks/useMqttSubscriptions';
import { publish } from '@/lib/mqtt';
import { useState } from 'react';
import Link from 'next/link';

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
  detska: '��',
  obyvacka: '🛋️',
  kuchyna: '🍳',
  kupelna: '🚿'
};

export default function Home() {
  useMqttSubscriptions();
  
  const mode = useHouse(s=>s.mode) ?? '—';
  const rooms = useHouse(s=>s.rooms);
  const weather = useHouse(s=>s.weather);
  const burstDuration = useHouse(s=>s.burstDuration);
  const { theme, toggleTheme } = useTheme();
  const colors = themes[theme];
  
  const [sliders, setSliders] = useState<Record<string,number>>({});
  
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
    if (!override || !current || !target) return ROOM_ICONS[room];
    return current > target + 0.5 ? '��' : '❄️';
  };
  
  const activateBurst = (room: string, targetTemp: number) => {
    const until = new Date(Date.now() + burstDuration * 60 * 60 * 1000).toISOString();
    publish(`cmd/hvac/${room}/override`, JSON.stringify({
      active: true,
      value: targetTemp,
      duration: burstDuration,
      until: until
    }), true);
    publish(`cmd/hvac/${room}/setpoint`, String(targetTemp));
    console.log(`[UI] Burst activated for ${room}: ${targetTemp}°C for ${burstDuration}h`);
  };
  
  const cancelOverride = (room: string) => {
    publish(`cmd/hvac/${room}/override`, JSON.stringify({ active: false }), true);
    publish(`cmd/hvac/${room}/setpoint`, '21');
    setSliders(prev => ({ ...prev, [room]: 21 }));
    console.log(`[UI] Override cancelled for ${room}`);
  };
  
  const updateBurstDuration = (hours: number) => {
    useHouse.setState({ burstDuration: hours });
    publish('virt/settings/burst_duration', String(hours), true);
    console.log(`[UI] Burst duration set to ${hours}h`);
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
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {weather?.temp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {weather.icon && (
                <img 
                  src={`https://openweathermap.org/img/wn/${weather.icon}.png`} 
                  alt="weather" 
                  style={{ width: 40, height: 40 }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
                  {weather.temp.toFixed(1)}°C
                </span>
                <span style={{ fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' }}>
                  {weather.description || 'Načítavam...'}
                </span>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleTheme}
            style={{
              background: 'transparent',
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
          
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Režim: <span style={{ fontWeight: 600, color: colors.text }}>{mode}</span>
          </div>
        </div>
      </div>

      <Link href="/weather" style={{ textDecoration: 'none' }}>
        <div style={{
          background: colors.weatherGradient,
          borderRadius: 12,
          padding: 24,
          marginBottom: 16,
          cursor: 'pointer',
          border: `1px solid ${colors.border}`,
          boxShadow: theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {weather?.icon && (
                <img 
                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} 
                  alt="weather" 
                  style={{ width: 80, height: 80 }}
                />
              )}
              <div>
                <div style={{ fontSize: 42, fontWeight: 700, color: 'white' }}>
                  {weather?.temp ? `${weather.temp.toFixed(1)}°C` : '—'}
                </div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.9)', textTransform: 'capitalize' }}>
                  {weather?.description || 'Takmer Jasno'}
                </div>
              </div>
            </div>
            
            {weather?.hourly && weather.hourly.length > 0 && (
              <div style={{ display: 'flex', gap: 16 }}>
                {weather.hourly.map((h, i) => (
                  <div key={i} style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 8
                  }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
                      {h.time}
                    </div>
                    <img 
                      src={`https://openweathermap.org/img/wn/${h.icon}.png`} 
                      alt="weather" 
                      style={{ width: 40, height: 40 }}
                    />
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
                      {h.temp.toFixed(0)}°C
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>

      <div style={{
        background: colors.cardBg,
        backdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        border: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: theme === 'dark' ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div>
          <div style={{ fontSize: 14, color: colors.text, fontWeight: 600, marginBottom: 4 }}>
            ⏱️ Trvanie Burst režimu
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            Ako dlho má trvať override po aktivácii
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input
            type="range"
            min={1}
            max={6}
            step={0.5}
            value={burstDuration}
            onChange={(e) => updateBurstDuration(parseFloat(e.target.value))}
            className="temp-slider active"
            style={{ width: 200 }}
          />
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.currentTemp, minWidth: 60 }}>
            {burstDuration}h
          </span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16
      }}>
        {ROOMS.map(r => {
          const rm = rooms[r] || {};
          const hasData = rm.current !== undefined;
          const currentValue = rm.current ?? 0;
          const targetValue = rm.target ?? 21;
          const sliderValue = sliders[r] ?? targetValue;
          const icon = getRoomIcon(r, currentValue, targetValue, rm.override);
          const remaining = getRemainingTime(rm.overrideUntil);
          
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
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: colors.text }}>
                    {ROOM_NAMES[r]}
                  </h3>
                  {rm.override && remaining && (
                    <span style={{ fontSize: 11, color: colors.currentTemp, fontWeight: 500 }}>
                      OVERRIDE {remaining}
                    </span>
                  )}
                </div>
                {hasData && (
                  <div style={{
                    marginLeft: 'auto',
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#10b981'
                  }} />
                )}
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                  AKTUÁLNA TEPLOTA
                </div>
                <div style={{ fontSize: 56, fontWeight: 700, color: colors.currentTemp, lineHeight: 1 }}>
                  {hasData ? `${currentValue.toFixed(1)}°C` : '— °C'}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                  CIEĽ
                </div>
                <div style={{ fontSize: 28, fontWeight: 600, color: colors.targetTemp }}>
                  {sliderValue.toFixed(1)}°C
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => {
                    const newVal = Math.max(16, sliderValue - 1);
                    setSliders(prev => ({ ...prev, [r]: newVal }));
                    activateBurst(r, newVal);
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
                  {rm.override && remaining ? remaining : 'AUTO'}
                </button>
                <button
                  onClick={() => {
                    const newVal = Math.min(28, sliderValue + 1);
                    setSliders(prev => ({ ...prev, [r]: newVal }));
                    activateBurst(r, newVal);
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
                step={0.5}
                value={sliderValue}
                onChange={(e) => setSliders(prev => ({ ...prev, [r]: parseFloat(e.target.value) }))}
                onMouseUp={() => activateBurst(r, sliderValue)}
                onTouchEnd={() => activateBurst(r, sliderValue)}
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
            </div>
          );
        })}
      </div>
    </main>
  );
}
