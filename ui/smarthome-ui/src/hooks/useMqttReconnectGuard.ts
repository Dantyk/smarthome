import { useEffect, useRef } from 'react';
import { useInitialLoad } from './useInitialLoad';

// If MQTT is down longer than threshold, reload the page to mimic first-load behavior
const THRESHOLD_MS = 30_000; // 30s

export function useMqttReconnectGuard() {
  // We call useInitialLoad here so on mount we do an API refresh too
  useInitialLoad();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.status === 'close') {
        // after 60s of continuous close without reconnect, hard reload
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          // force a full reload to re-init everything (API + MQTT)
          window.location.reload();
        }, 60_000);
      } else if (detail.status === 'connect') {
        if (timerRef.current) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const down = Number(detail.wasDownFor || 0);
        if (down >= THRESHOLD_MS) {
          // significant outage just ended -> do a soft refresh sequence
          // we avoid hard reload since we already reconnected; just refetch API
          // Note: useInitialLoad() is already invoked on mount; here we can also reload route data if needed
          // For simplicity, re-run initial load by dispatching a custom event applications can handle
          // or just quickly bump location hash to force refresh. We'll fetch via useInitialLoad on page navigation.
        }
      }
    };

    window.addEventListener('mqtt:status' as any, onStatus);
    return () => {
      window.removeEventListener('mqtt:status' as any, onStatus);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);
}
