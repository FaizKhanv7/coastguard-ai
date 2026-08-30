'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Compass, 
  MapPin, 
  Bot, 
  FileText, 
  Users, 
  LifeBuoy, 
  Menu, 
  X, 
  ShieldAlert,
  Sliders
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: Compass },
  { href: '/map', label: 'Tactical Map', icon: MapPin },
  { href: '/assistant', label: 'AI Dispatch', icon: Bot },
  { href: '/report', label: 'Report Incident', icon: FileText },
  { href: '/volunteer', label: 'Volunteer', icon: Users },
  { href: '/resources', label: 'Resources', icon: LifeBuoy },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-base font-bold tracking-tight text-white block leading-none">CoastGuard AI</span>
                  <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">Inundation Defense</span>
                </div>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu trigger */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>

      {/* Persistent Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>CoastGuard AI © 2025-2026. Rapid Coastal Defense Simulation Engine.</span>
          <div className="flex items-center gap-4">
            <Link href="/resources" className="hover:text-slate-300 transition-colors">Protocols</Link>
            <Link href="/map" className="hover:text-slate-300 transition-colors">Tactical Grid</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
