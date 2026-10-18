import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The game is a real-time client app (WebGL canvas, Firebase listeners, Web Audio).
  // Cache Components keeps hidden routes mounted inside <Activity>, which would keep
  // WebGL contexts, audio and table presence alive after leaving a page, so we keep
  // the classic unmount-on-navigation behaviour.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
