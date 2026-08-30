import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { CoastguardProvider } from "@/lib/store";
import AppShell from "@/components/AppShell";

// Same two families the mockup loaded from Google Fonts.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CoastGuard AI — Flood forecast & safe routing",
  description:
    "Predictive flood modelling and dynamic safe-route pathfinding for Kalinaw Island.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2a33",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        {/* One provider for the whole app: the flood model is precomputed
            once, and simulation state survives navigation between pages. */}
        <CoastguardProvider>
          <AppShell>{children}</AppShell>
        </CoastguardProvider>
      </body>
    </html>
  );
}
