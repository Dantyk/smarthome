"use client";
import React from 'react';
import { useHouse } from '@/store/useHouse';

interface Props {
  room: string;
  sliderValue: number;
  isReadonly: boolean;
  setSliders: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  activateBurst: (room: string, targetTemp: number, duration: number) => void;
  cancelOverride: (room: string) => void;
  colors: any;
}

function RoomControls(props: Props) {
  const { room, sliderValue, isReadonly, setSliders, activateBurst, cancelOverride, colors } = props;
  const burstDurations = useHouse(s => s.burstDurations || {});
  const setStore = useHouse.setState;
  const roomBurstDuration = burstDurations[room] ?? (useHouse.getState().burstDuration ?? 1);

  const [localValue, setLocalValue] = React.useState<number>(sliderValue);
  const [dragging, setDragging] = React.useState(false);
  const renderCount = React.useRef(0);
  renderCount.current += 1;
  console.log(`[RoomControls] render ${room} #${renderCount.current} dragging=${dragging} local=${localValue} prop=${sliderValue}`);

  React.useEffect(() => {
    console.log(`[RoomControls] mount: ${room}`, { sliderValue, isReadonly });
    return () => console.log(`[RoomControls] unmount: ${room}`);
  }, [room]);

  React.useEffect(() => {
    if (!dragging && sliderValue !== undefined && !Number.isNaN(sliderValue)) {
      setLocalValue(sliderValue);
    }
  }, [sliderValue, dragging]);

  const onLocalChange = (val: number) => {
    setLocalValue(val);
  };

  const onCommit = () => {
    setDragging(false);
    setSliders(prev => ({ ...prev, [room]: localValue }));
    console.log(`[RoomControls] commit: ${room} -> ${localValue} (${roomBurstDuration}h)`);
    activateBurst(room, localValue, roomBurstDuration);
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>CIEĽ</div>
        <div className="temp-target" style={{ fontSize: 24, fontWeight: 600, color: colors.targetTemp }}>
          {sliderValue.toFixed(1)}°C
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>⏱️ Burst</div>
        <select
          value={roomBurstDuration}
          onChange={(e) => {
            const newDur = parseFloat(e.target.value);
            setStore((s: any) => ({ burstDurations: { ...(s.burstDurations || {}), [room]: newDur } }));
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
            const newVal = Math.max(16, (localValue ?? sliderValue) - 1);
            onLocalChange(newVal);
            activateBurst(room, newVal, roomBurstDuration);
          }}
          disabled={isReadonly}
          style={{
            flex: 1,
            padding: '10px',
            background: colors.cardBg,
            border: `2px solid ${colors.border}`,
            borderRadius: 8,
            cursor: !isReadonly ? 'pointer' : 'not-allowed',
            fontSize: 20,
            color: colors.text,
            opacity: !isReadonly ? 1 : 0.5
          }}
        >
          ❄️
        </button>
        <button
          onClick={() => cancelOverride(room)}
          disabled={isReadonly}
          style={{
            flex: 1,
            padding: '10px',
            background: colors.targetTemp,
            border: 'none',
            borderRadius: 8,
            cursor: !isReadonly ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 700,
            color: 'white',
            opacity: !isReadonly ? 1 : 0.5
          }}
        >
          AUTO
        </button>
        <button
          onClick={() => {
            const newVal = Math.min(28, (localValue ?? sliderValue) + 1);
            onLocalChange(newVal);
            activateBurst(room, newVal, roomBurstDuration);
          }}
          disabled={isReadonly}
          style={{
            flex: 1,
            padding: '10px',
            background: colors.cardBg,
            border: `2px solid ${colors.border}`,
            borderRadius: 8,
            cursor: !isReadonly ? 'pointer' : 'not-allowed',
            fontSize: 20,
            color: colors.text,
            opacity: !isReadonly ? 1 : 0.5
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
        value={localValue}
        onChange={(e) => onLocalChange(parseFloat(e.target.value))}
        onPointerDown={() => setDragging(true)}
        onMouseDown={() => setDragging(true)}
        onTouchStart={() => setDragging(true)}
        onPointerUp={onCommit}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onBlur={onCommit}
        onPointerCancel={onCommit}
        className={'temp-slider active'}
        style={{ width: '100%' }}
        disabled={isReadonly}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
        <span>16°C</span>
        <span>28°C</span>
      </div>
    </>
  );
}
export default React.memo(RoomControls);
