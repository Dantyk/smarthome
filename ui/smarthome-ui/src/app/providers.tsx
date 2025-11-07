'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const qc = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  // MQTT subscriptions moved to useMqttSubscriptions hook
  // Each page now manages its own subscriptions
  
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
