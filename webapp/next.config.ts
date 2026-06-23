import type { NextConfig } from "next";

// canvas(napi) 바이너리 + 폰트는 Vercel 번들에 자동 포함되지 않아 합성 라우트마다 명시한다.
const CANVAS_TRACE = [
  "./public/fonts/**",
  "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
  "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/generate/image": CANVAS_TRACE,
    "/api/carousels/[carouselId]/slides": CANVAS_TRACE,
    "/api/carousels/[carouselId]/slides/[idx]": CANVAS_TRACE,
  },
};

export default nextConfig;
