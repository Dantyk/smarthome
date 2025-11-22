"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { useHouse } from '@/store/useHouse';

const RoomControls = dynamic(() => import('@/components/RoomControls'), { ssr: false });

interface RoomCapabilities {
  temp_sensor?: boolean;
  humidity_sensor?: boolean;
  hvac_control?: boolean;
  temp_control?: boolean;
}

interface Props {
  room: string;
  colors: any;
  theme: string;
  capabilities?: RoomCapabilities;
  activateBurst: (room: string, targetTemp: number, duration: number) => void;
  cancelOverride: (room: string) => void;
  toggleHvac: (room: string, enabled: boolean) => void;
  setSlidersHandler: (updater: (prev: Record<string,number>) => Record<string,number>) => void;
}

// Icon rendering: map room name/label to predefined icons
const ICON_MAP: Record<string, string> = {
  'bedroom': '🛏️', 'spalna': '🛏️', 'spálňa': '🛏️',
  'kidroom': '🧸', 'kidroom1': '🧸', 'detska': '🧸', 'detská': '🧸',
  'living': '🛋️', 'obyvacka': '🛋️', 'obývačka': '🛋️',
  'kitchen': '🍳', 'kuchyna': '🍳', 'kuchyňa': '🍳',
  'bathroom': '🚿', 'kupelna': '🚿', 'kúpeľňa': '🚿'
};

const RoomCard: React.FC<Props> = ({ room, colors, theme, capabilities, activateBurst, cancelOverride, toggleHvac, setSlidersHandler }) => {
  // subscribe only to the specific room slice
  const rm = useHouse((s: any) => s.rooms?.[room] || {});

  // Determine if room is readonly based on capabilities (no temp_control)
  const isReadonly = capabilities ? (capabilities.temp_control === false) : (rm?.readonly === true);
  const currentValue = rm?.current ?? 0;
  const targetValue = Number.isFinite(Number(rm?.target)) ? Number(rm?.target) : 21;
  const boostActive = rm?.boostActive ?? false;
  const boostTemp = rm?.boostTargetTemp ?? targetValue;
  const boostMinutes = rm?.boostMinutes ?? 0;
  const effectiveTarget = boostActive ? boostTemp : targetValue;

  const sliderValue = effectiveTarget;
  const specialIcon = (boostActive ? '🔥' : (rm?.override && currentValue !== undefined && effectiveTarget !== undefined ? (currentValue > effectiveTarget + 0.5 ? '🔥' : (currentValue < effectiveTarget ? '❄️' : undefined)) : undefined));
  
  // Match icon by room key or label/displayName/title (case-insensitive, normalized)
  const roomLabel = (rm?.label || rm?.displayName || rm?.title || room).toLowerCase().replace(/[_-]/g, '');
  const matchedIcon = ICON_MAP[room.toLowerCase()] || ICON_MAP[roomLabel];
  const icon = matchedIcon || specialIcon;
  const remaining = rm?.overrideUntil ? new Date(rm.overrideUntil) : undefined;

  const renderCount = React.useRef(0);
  renderCount.current += 1;
  React.useEffect(() => {
    console.log(`[RoomCard] mount ${room}`);
    return () => console.log(`[RoomCard] unmount ${room}`);
  }, [room]);
  console.log(`[RoomCard] render ${room} #${renderCount.current}`);

  return (
    <div style={{
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
          <h3 className="room-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: colors.text ?? '#f1f5f9' }}>
            {(rm && (rm.label || rm.displayName || rm.title)) || room.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </h3>
          {boostActive && boostMinutes > 0 && (
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>
              BOOST {boostMinutes}min
            </span>
          )}
          {!boostActive && rm?.override && rm?.overrideUntil && (
            <span style={{ fontSize: 11, color: colors.currentTemp, fontWeight: 500 }}>
              OVERRIDE {new Date(rm.overrideUntil).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(capabilities?.hvac_control !== false) && (
            <button
              onClick={() => toggleHvac(room, !(rm?.hvacEnabled ?? true))}
              style={{
                display: 'inline-flex', alignItems: 'center', padding: '6px', borderRadius: 999,
                border: `1px solid ${colors.border}`, background: (rm?.hvacEnabled ?? true) ? '#064e3b' : '#3f3f46', cursor: 'pointer', minWidth: 48
              }}
            >
              <span style={{ display: 'inline-block', width: 36, height: 20, background: (rm?.hvacEnabled ?? true) ? '#10b981' : '#71717a', borderRadius: 999, position: 'relative' }}>
                <span style={{ position: 'absolute', top: 2, left: (rm?.hvacEnabled ?? true) ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: '50%' }} />
              </span>
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>
          AKTUÁLNA TEPLOTA
        </div>
        <div className="temp-current" style={{ fontSize: 40, fontWeight: 700, color: colors.currentTemp, lineHeight: 1 }}>
          {(!isReadonly) ? `${currentValue.toFixed(1)}°C` : '— °C'}
        </div>
        <div style={{ fontSize: 16, color: colors.textSecondary, marginTop: 8, minHeight: 24 }}>
          {(capabilities?.humidity_sensor !== false && rm?.humidity !== undefined) ? `💧 ${rm.humidity.toFixed(0)}%` : '\u00A0'}
        </div>
      </div>

      {(!isReadonly) && (
          <RoomControls
            room={room}
            sliderValue={sliderValue}
            isReadonly={isReadonly}
            setSliders={(updater:any) => { /* slider state kept at page level */ setSlidersHandler(updater); }}
            activateBurst={activateBurst}
            cancelOverride={cancelOverride}
            colors={colors}
          />
      )}

      {isReadonly && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: colors.textSecondary, fontSize: 14 }}>
          ⚙️ Teplota sa nedá nastaviť
        </div>
      )}
    </div>
  );
};

export default React.memo(RoomCard);
