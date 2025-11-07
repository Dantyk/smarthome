'use client';
import { useHouse } from '@/store/useHouse';
import { useTheme, themes } from '@/store/useTheme';
import { useMqttSubscriptions } from '@/hooks/useMqttSubscriptions';
import { useInitialLoad } from '@/hooks/useInitialLoad';
import Link from 'next/link';

export default function WeatherPage() {
  // Setup MQTT subscriptions for this page
  useMqttSubscriptions();
  // Initial REST load (if configured)
  useInitialLoad();
  
  const weather = useHouse(s => s.weather);
  const { theme, toggleTheme } = useTheme();
  const colors = themes[theme];
  
  return (
    <main style={{
      minHeight: '100vh',
      background: colors.bg,
      padding: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Top Navigation */}
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
          <Link href="/" style={{ fontSize: 16, color: colors.textSecondary, textDecoration: 'none' }}>
            ← Späť
          </Link>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.currentTemp }}>
            ☁️ Počasie
          </span>
        </div>
        
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
      </div>

      {/* Weather Hero Section */}
      <div style={{
        background: colors.weatherGradient,
        borderRadius: 16,
        padding: 40,
        marginBottom: 24,
        textAlign: 'center',
        boxShadow: theme === 'dark' 
          ? '0 8px 24px rgba(0,0,0,0.5)' 
          : '0 4px 16px rgba(0,0,0,0.15)',
        border: `1px solid ${colors.border}`
      }}>
        {weather?.icon && (
          <img
            src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
            alt="Weather"
            style={{ width: 160, height: 160 }}
          />
        )}
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: 'white',
          marginTop: 16
        }}>
          {weather?.temp ? `${weather.temp.toFixed(1)}°C` : '—'}
        </div>
        <div style={{
          fontSize: 24,
          color: 'rgba(255,255,255,0.9)',
          marginTop: 8,
          textTransform: 'capitalize'
        }}>
          {weather?.description || 'Načítavam počasie z MQTT...'}
        </div>
        <div style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.7)',
          marginTop: 12
        }}>
          📍 Bratislava, SK
        </div>
      </div>

      {/* Weather Details Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {/* Humidity Card */}
        <div style={{
          background: colors.cardBg,
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          border: `1px solid ${colors.border}`,
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0,0,0,0.4)' 
            : '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💧</div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
            Vlhkosť
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.targetTemp }}>
            {weather?.humidity ?? '—'}%
          </div>
        </div>

        {/* Wind Speed Card */}
        <div style={{
          background: colors.cardBg,
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          border: `1px solid ${colors.border}`,
          boxShadow: theme === 'dark' 
            ? '0 4px 12px rgba(0,0,0,0.4)' 
            : '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💨</div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
            Vietor
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>
            {weather?.wind_speed ? `${weather.wind_speed.toFixed(1)}` : '—'}
            {weather?.wind_speed && <span style={{ fontSize: 16 }}> km/h</span>}
          </div>
        </div>
      </div>

      {/* Hourly Forecast */}
      <div style={{
        background: colors.cardBg,
        backdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: 24,
        border: `1px solid ${colors.border}`,
        boxShadow: theme === 'dark' 
          ? '0 4px 12px rgba(0,0,0,0.4)' 
          : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600, color: colors.text }}>
          Predpoveď na najbližšie hodiny
        </h3>
        {weather?.hourly && weather.hourly.length > 0 ? (
          <div style={{ display: 'flex', overflowX: 'auto', gap: 12, paddingBottom: 6 }}>
            {weather.hourly.map((h, i) => (
              <div key={i} style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                padding: 12,
                textAlign: 'center',
                background: 'rgba(255,255,255,0.03)',
                minWidth: 110
              }}>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
                  {String(h.time)}
                </div>
                <img 
                  src={`https://openweathermap.org/img/wn/${h.icon}.png`} 
                  alt="ico" 
                  style={{ width: 42, height: 42 }}
                />
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.text, marginTop: 6 }}>
                  {Number(h.temp).toFixed(1)}°C
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Zatiaľ neprišli dáta. Over topic "virt/weather/hourly".
          </div>
        )}
      </div>
    </main>
  );
}
