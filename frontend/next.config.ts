import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: ['react-map-gl', 'mapbox-gl'],
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ],
};

export default nextConfig;
