'use client';
import { useHouse } from '@/store/useHouse';
import Link from 'next/link';

export default function WeatherPage() {
  const weather = useHouse(s=>s.weather);
  
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
        alignItems: 'center',
        gap: 16
      }}>
        <Link href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</Link>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#333' }}>
          ☁️ Počasie
        </div>
      </div>

      {/* Main Weather Card */}
      {weather ? (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Current Weather Hero */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16,
            padding: 40,
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(102,126,234,0.3)',
            color: 'white',
            textAlign: 'center'
          }}>
            {weather.icon && (
              <img 
                src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
                alt={weather.description}
                style={{ width: 160, height: 160, margin: '0 auto' }}
              />
            )}
            <div style={{ fontSize: 72, fontWeight: 700, marginTop: -20 }}>
              {weather.temp?.toFixed(1) ?? '—'}°C
            </div>
            <div style={{ fontSize: 24, opacity: 0.9, textTransform: 'capitalize', marginTop: 8 }}>
              {weather.description ?? 'načítavam...'}
            </div>
          </div>

          {/* Weather Details Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
            marginBottom: 20
          }}>
            {/* Humidity */}
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💧</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6', marginBottom: 4 }}>
                {weather.humidity ?? '—'}%
              </div>
              <div style={{ fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Vlhkosť
              </div>
            </div>

            {/* Wind Speed */}
            <div style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>💨</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                {weather.wind_speed?.toFixed(1) ?? '—'}
              </div>
              <div style={{ fontSize: 13, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                km/h
              </div>
            </div>
          </div>

          {/* Additional Info Card */}
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 16 }}>
              📍 Bratislava, SK
            </div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.8 }}>
              Aktuálne počasie je zobrazené v reálnom čase cez OpenWeatherMap API.
              Dáta sa aktualizujú automaticky každých 5 minút cez Node-RED flow.
            </div>
          </div>

          {/* Placeholder for Forecast */}
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            marginTop: 20,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#333', marginBottom: 12 }}>
              📊 Predpoveď
            </div>
            <div style={{ fontSize: 14, color: '#999' }}>
              Hodinová predpoveď bude dostupná v ďalšej verzii
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          maxWidth: 600,
          margin: '0 auto'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>☁️</div>
          <div style={{ fontSize: 18, color: '#666' }}>
            Načítavam počasie z MQTT...
          </div>
        </div>
      )}
    </main>
  );
}
