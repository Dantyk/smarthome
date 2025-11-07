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
  detska: '🧸',
  obyvacka: '🛋️',
  kuchyna: '🍳',
  kupelna: '🚿'
};

export default function Home() {
  // Setup MQTT subscriptions for this page
  useMqttSubscriptions();
  
  const mode = useHouse(s=>s.mode) ?? '—';
  const rooms = useHouse(s=>s.rooms);
  const weather = useHouse(s=>s.weather);
  const { theme, toggleTheme } = useTheme();
  const colors = themes[theme];
  
  const [sliders, setSliders] = useState<Record<string,number>>({});
  
  // Helper to determine if room has override and get icon
  const getRoomIcon = (room: string, current?: number, target?: number, override?: boolean) => {
    if (!override) return ROOM_ICONS[room];
    if (!current || !target) return ROOM_ICONS[room];
    return current > target + 0.5 ? '🔥' : '❄️';
  };
  
  return (
    <main style={{ 
      minHeight: '100vh',
      background: colors.bg,
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Navigation Bar with Weather */}
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
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: colors.currentTemp, textDecoration: 'none' }}>
            🏠 SmartHome
          </Link>
          <Link href="/weather" style={{ fontSize: 16, color: colors.textSecondary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            ☁️ Počasie
          </Link>
        </div>
        
        {/* Weather info in header */}
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
          
          {/* Theme toggle */}
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
            title={`Prepnúť na ${theme === 'dark' ? 'svetlý' : 'tmavý'} režim`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Režim: <span style={{ fontWeight: 600, color: colors.text }}>{mode}</span>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
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
          
          return (
            <div key={r} style={{
              background: colors.cardBg,
              backdropFilter: 'blur(10px)',
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${colors.border}`,
              boxShadow: theme === 'dark' 
                ? '0 4px 12px rgba(0,0,0,0.4)' 
                : '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              {/* Room Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>{icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: colors.text }}>
                    {ROOM_NAMES[r]}
                  </h3>
                  {rm.override && (
                    <span style={{ fontSize: 11, color: colors.currentTemp, fontWeight: 500 }}>
                      OVERRIDE {rm.overrideValue?.toFixed(1)}°C
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
                  }} title="Online" />
                )}
              </div>

              {/* Temperature Display */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
                  AKTUÁLNA TEPLOTA
                </div>
                <div style={{ 
                  fontSize: 56, 
                  fontWeight: 700, 
                  color: colors.currentTemp,
                  lineHeight: 1
                }}>
                  {hasData ? `${currentValue.toFixed(1)}°C` : '— °C'}
                </div>
              </div>

              {/* Target Temperature Display */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                  CIEĽ
                </div>
                <div style={{ 
                  fontSize: 28, 
                  fontWeight: 600, 
                  color: colors.targetTemp
                }}>
                  {sliderValue.toFixed(1)}°C
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  onClick={() => {
                    const newVal = Math.max(16, sliderValue - 1);
                    setSliders(prev => ({ ...prev, [r]: newVal }));
                    publish(`cmd/hvac/${r}/setpoint`, String(newVal));
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: colors.cardBg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 20,
                    color: colors.text
                  }}
                >
                  ❄️
                </button>
                <button
                  onClick={() => {
                    setSliders(prev => ({ ...prev, [r]: 21 }));
                    publish(`cmd/hvac/${r}/setpoint`, '21');
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: colors.targetTemp,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'white'
                  }}
                >
                  AUTO
                </button>
                <button
                  onClick={() => {
                    const newVal = Math.min(28, sliderValue + 1);
                    setSliders(prev => ({ ...prev, [r]: newVal }));
                    publish(`cmd/hvac/${r}/setpoint`, String(newVal));
                  }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: colors.cardBg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 20,
                    color: colors.text
                  }}
                >
                  🔥
                </button>
              </div>

              {/* Temperature Slider */}
              <input
                type="range"
                min={16}
                max={28}
                step={0.5}
                value={sliderValue}
                onChange={(e) => setSliders(prev => ({ ...prev, [r]: parseFloat(e.target.value) }))}
                onMouseUp={() => publish(`cmd/hvac/${r}/setpoint`, String(sliderValue))}
                onTouchEnd={() => publish(`cmd/hvac/${r}/setpoint`, String(sliderValue))}
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
