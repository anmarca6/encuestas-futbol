import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { AppPreferencesProvider } from '@/components/app-preferences';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Granota App · Levante UD',
  description: 'La app de la afición del Levante UD.',
  // Manifiesto e iconos: permiten instalar la app en la pantalla de inicio (necesario para los avisos en iPhone).
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Granota App', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#071527' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppPreferencesProvider>{children}</AppPreferencesProvider>
        <Analytics />
      </body>
    </html>
  );
}
