import './globals.css';
import Providers from './providers';

export const metadata = { title: 'SmartHome UI' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
