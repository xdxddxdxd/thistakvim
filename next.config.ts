import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  async redirects() {
    return [{ source: "/analiz", destination: "/", permanent: false }];
  },
};
export default config;
