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
      <style>{`
        @media (max-width: 768px) {
          .weather-hero { 
            flex-direction: column !important; 
            text-align: center !important;
          }
          .weather-hero-left { 
            flex-direction: column !important; 
            align-items: center !important;
          }
          .weather-hero-right { 
            text-align: center !important; 
          }
          .weather-temp { 
            font-size: 42px !important; 
          }
          .hourly-forecast {
            padding-bottom: 12px !important;
          }
        }
      `}</style>
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
        border: `1px solid ${colors.border}`,
        flexWrap: 'wrap',
        gap: 12
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

      {/* Weather Hero Section - Compact Design */}
      <div className="weather-hero" style={{
        background: colors.weatherGradient,
        borderRadius: 16,
        padding: '24px 32px',
        marginBottom: 20,
        boxShadow: theme === 'dark' 
          ? '0 8px 24px rgba(0,0,0,0.5)' 
          : '0 4px 16px rgba(0,0,0,0.15)',
        border: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24
      }}>
        <div className="weather-hero-left" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {weather?.icon && (
            <img
              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
              alt="Weather"
              style={{ width: 100, height: 100 }}
            />
          )}
          <div>
            <div className="weather-temp" style={{
              fontSize: 56,
              fontWeight: 700,
              color: 'white',
              lineHeight: 1
            }}>
              {weather?.temp ? `${weather.temp.toFixed(1)}°C` : '—'}
            </div>
            <div style={{
              fontSize: 18,
              color: 'rgba(255,255,255,0.9)',
              marginTop: 8,
              textTransform: 'capitalize'
            }}>
              {weather?.description || 'Načítavam...'}
            </div>
          </div>
        </div>
        
        <div className="weather-hero-right" style={{ 
          textAlign: 'right',
          color: 'rgba(255,255,255,0.8)',
          fontSize: 14
        }}>
          <div style={{ marginBottom: 8 }}>📍 Bratislava, SK</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Vlhkosť</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{weather?.humidity ?? '—'}%</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>Vietor</div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>
                {weather?.wind_speed ? `${weather.wind_speed.toFixed(1)}` : '—'} km/h
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Forecast */}
      <div style={{
        background: colors.cardBg,
        backdropFilter: 'blur(10px)',
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${colors.border}`,
        boxShadow: theme === 'dark' 
          ? '0 4px 12px rgba(0,0,0,0.4)' 
          : '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: colors.text }}>
          📅 Predpoveď na najbližšie hodiny
        </h3>
        {weather?.hourly && weather.hourly.length > 0 ? (
          <div className="hourly-forecast" style={{ display: 'flex', overflowX: 'auto', gap: 10, paddingBottom: 6 }}>
            {weather.hourly.map((h, i) => (
              <div key={i} style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                textAlign: 'center',
                background: i === 0 ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255,255,255,0.03)',
                minWidth: 90,
                transition: 'transform 0.2s, background 0.2s',
                cursor: 'default'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(96, 165, 250, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = i === 0 ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255,255,255,0.03)';
              }}
              >
                <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                  {h.time || '—'}
                </div>
                <img 
                  src={`https://openweathermap.org/img/wn/${h.icon}.png`} 
                  alt="ico" 
                  style={{ width: 36, height: 36, margin: '4px 0' }}
                />
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>
                  {Number(h.temp).toFixed(0)}°
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            fontSize: 13, 
            color: colors.textSecondary,
            textAlign: 'center',
            padding: '20px 0'
          }}>
            Načítavam predpoveď z MQTT...
          </div>
        )}
      </div>
    </main>
  );
}
