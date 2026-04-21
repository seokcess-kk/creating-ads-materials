import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/campaigns/[campaignId]/compose": [
      "./public/fonts/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
    ],
  },
};

export default nextConfig;
