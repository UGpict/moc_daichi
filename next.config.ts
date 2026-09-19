import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [{ source: "/sessions/:id", destination: "/plan/:id", permanent: false }];
  },
};

export default nextConfig;
