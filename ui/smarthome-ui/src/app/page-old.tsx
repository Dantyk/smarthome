'use client';
import { useHouse } from '@/store/useHouse';
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
  const mode = useHouse(s=>s.mode) ?? '—';
  const rooms = useHouse(s=>s.rooms);
  const weather = useHouse(s=>s.weather);
  const [sliders, setSliders] = useState<Record<string,number>>({});
  
  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Navigation Bar */}
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: '#ff6b35', textDecoration: 'none' }}>
            🏠 SmartHome
          </Link>
          <Link href="/weather" style={{ fontSize: 16, color: '#666', textDecoration: 'none' }}>
            ☁️ Počasie
          </Link>
        </div>
        <div style={{ fontSize: 16, color: '#666', fontWeight: 600 }}>
          Režim: <span style={{ color: '#ff6b35' }}>{mode}</span>
        </div>
      </div>

      {/* Weather Summary Card */}
      {weather && (
        <Link href="/weather" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            {weather.icon && (
              <img 
                src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
                alt={weather.description}
                style={{ width: 80, height: 80 }}
              />
            )}
            <div style={{ flex: 1, color: 'white' }}>
              <div style={{ fontSize: 42, fontWeight: 700 }}>
                {weather.temp?.toFixed(1) ?? '—'}°C
              </div>
              <div style={{ fontSize: 16, opacity: 0.9, textTransform: 'capitalize' }}>
                {weather.description ?? 'načítavam...'}
              </div>
            </div>
            <div style={{ color: 'white', fontSize: 14, opacity: 0.9, textAlign: 'right' }}>
              <div>💧 {weather.humidity ?? '—'}%</div>
              <div>💨 {weather.wind_speed ?? '—'} km/h</div>
            </div>
          </div>
        </Link>
      )}

      {/* Room Cards */}
      <div style={{ 
        display: 'grid', 
        gap: 16, 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        maxWidth: 1600
      }}>
        {ROOMS.map(r => {
          const rs = rooms[r] || {};
          const hasData = rs.current !== undefined || rs.target !== undefined;
          const sliderValue = sliders[r] ?? rs.target ?? 21;
          
          return (
            <div key={r} style={{ 
              background: 'white',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: hasData ? '2px solid #f0f0f0' : '2px solid #e0e0e0',
              opacity: hasData ? 1 : 0.6
            }}>
              {/* Room Header */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{ROOM_ICONS[r]}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#333' }}>{ROOM_NAMES[r]}</span>
                </div>
                <div style={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  background: hasData ? '#4ade80' : '#e0e0e0' 
                }}/>
              </div>
              
              {/* Current Temperature - Big Orange */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Aktuálna teplota
                </div>
                <div style={{ 
                  fontSize: 56, 
                  fontWeight: 700, 
                  color: hasData ? '#ff6b35' : '#ccc',
                  lineHeight: 1,
                  marginBottom: 4
                }}>
                  {rs.current?.toFixed(1) ?? '—'}
                  <span style={{fontSize: 32, color: '#999'}}>°C</span>
                </div>
              </div>
              
              {/* Target Temperature Slider */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 12
                }}>
                  <span style={{ fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Cieľ
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: hasData ? '#3b82f6' : '#ccc' }}>
                    {sliderValue.toFixed(1)}<span style={{fontSize: 18}}>°C</span>
                  </span>
                </div>
                
                <input 
                  type="range"
                  min="16"
                  max="28"
                  step="0.5"
                  value={sliderValue}
                  disabled={!hasData}
                  className={`temp-slider ${hasData ? 'active' : 'disabled'}`}
                  onChange={(e) => setSliders({...sliders, [r]: parseFloat(e.target.value)})}
                  onMouseUp={() => {
                    if (hasData) {
                      publish(`cmd/hvac/${r}/setpoint`, String(sliderValue));
                    }
                  }}
                  onTouchEnd={() => {
                    if (hasData) {
                      publish(`cmd/hvac/${r}/setpoint`, String(sliderValue));
                    }
                  }}
                  style={{ 
                    width: '100%',
                    height: 8,
                    borderRadius: 4,
                    outline: 'none',
                    background: hasData 
                      ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((sliderValue-16)/12)*100}%, #e5e7eb ${((sliderValue-16)/12)*100}%, #e5e7eb 100%)`
                      : '#e0e0e0',
                    cursor: hasData ? 'pointer' : 'not-allowed'
                  }}
                />
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 11,
                  color: '#999'
                }}>
                  <span>16°C</span>
                  <span>28°C</span>
                </div>
              </div>
              
              {/* Quick Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button
                  disabled={!hasData}
                  onClick={() => {
                    const newVal = Math.max(16, sliderValue - 1);
                    setSliders({...sliders, [r]: newVal});
                    publish(`cmd/hvac/${r}/setpoint`, String(newVal));
                  }}
                  style={{
                    padding: '10px',
                    background: hasData ? 'white' : '#f5f5f5',
                    border: hasData ? '2px solid #e5e7eb' : '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontSize: 18,
                    cursor: hasData ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  ❄️
                </button>
                <button
                  disabled={!hasData}
                  onClick={() => {
                    const newVal = 21;
                    setSliders({...sliders, [r]: newVal});
                    publish(`cmd/hvac/${r}/setpoint`, String(newVal));
                  }}
                  style={{
                    padding: '10px',
                    background: hasData ? '#3b82f6' : '#e0e0e0',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: hasData ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  AUTO
                </button>
                <button
                  disabled={!hasData}
                  onClick={() => {
                    const newVal = Math.min(28, sliderValue + 1);
                    setSliders({...sliders, [r]: newVal});
                    publish(`cmd/hvac/${r}/setpoint`, String(newVal));
                  }}
                  style={{
                    padding: '10px',
                    background: hasData ? 'white' : '#f5f5f5',
                    border: hasData ? '2px solid #e5e7eb' : '2px solid #e0e0e0',
                    borderRadius: 8,
                    fontSize: 18,
                    cursor: hasData ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  🔥
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Footer */}
      <div style={{
        marginTop: 32,
        textAlign: 'center',
        color: '#999',
        fontSize: 13
      }}>
        SmartHome UI • Real-time MQTT
      </div>
    </main>
  );
}
