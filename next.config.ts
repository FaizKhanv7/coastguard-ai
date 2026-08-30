import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Everything is client-side + static JSON; no server features needed.
  reactStrictMode: true,
};

export default nextConfig;
