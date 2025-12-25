import './globals.css';
import Providers from './providers';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const metadata = { title: 'SmartHome UI' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
