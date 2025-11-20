"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { useHouse } from '@/store/useHouse';

const RoomControls = dynamic(() => import('@/components/RoomControls'), { ssr: false });

interface Props {
  room: string;
  colors: any;
  theme: string;
  activateBurst: (room: string, targetTemp: number, duration: number) => void;
  cancelOverride: (room: string) => void;
  toggleHvac: (room: string, enabled: boolean) => void;
  setSlidersHandler: (updater: (prev: Record<string,number>) => Record<string,number>) => void;
}

// Icon rendering is per-room: if `rm.icon` is provided it is shown; otherwise
// we only show special icons for override/boost (🔥/❄️). This keeps the UI
// from showing default emojis when no icon exists in config.

const RoomCard: React.FC<Props> = ({ room, colors, theme, activateBurst, cancelOverride, toggleHvac, setSlidersHandler }) => {
  // subscribe only to the specific room slice
  const rm = useHouse((s: any) => s.rooms?.[room] || {});

  // burst duration is now persisted in the store and read inside RoomControls

  const isReadonly = (rm?.readonly === true);
  const currentValue = rm?.current ?? 0;
  const targetValue = Number.isFinite(Number(rm?.target)) ? Number(rm?.target) : 21;
  const boostActive = rm?.boostActive ?? false;
  const boostTemp = rm?.boostTargetTemp ?? targetValue;
  const boostMinutes = rm?.boostMinutes ?? 0;
  const effectiveTarget = boostActive ? boostTemp : targetValue;

  const sliderValue = effectiveTarget;
  const specialIcon = (boostActive ? '🔥' : (rm?.override && currentValue !== undefined && effectiveTarget !== undefined ? (currentValue > effectiveTarget + 0.5 ? '🔥' : (currentValue < effectiveTarget ? '❄️' : undefined)) : undefined));
  // Only show rm.icon if it is explicitly set and either matches the room key
  // or is an emoji character. This avoids showing unrelated icons.
  const isEmoji = typeof rm?.icon === 'string' && Array.from(rm.icon).length <= 2 && /\p{Emoji}/u.test(rm.icon);
  const icon = (rm?.icon && (rm.icon === room || isEmoji)) ? rm.icon : specialIcon;
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
          {(!isReadonly) && (
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
          {rm?.humidity !== undefined ? `💧 ${rm.humidity.toFixed(0)}%` : '\u00A0'}
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
