import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CoastGuard AI - Flood Modeling & Emergency Routing',
  description: 'Real-time coastal flood inundation simulation and AI-powered safe routing assistance.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#030712',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-slate-950 text-slate-100">
      <body className={`${inter.className} min-h-screen flex flex-col antialiased bg-slate-950 selection:bg-blue-500/30 selection:text-blue-200`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
