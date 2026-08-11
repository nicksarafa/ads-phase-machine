import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The phase machine is a long-lived singleton held on globalThis.
  // Disable strict-mode double-invocation so dev HMR doesn't spawn two loops.
  reactStrictMode: false,
  serverExternalPackages: ["@anthropic-ai/sdk"],
  // The dev overlay's issue badge sits over the bottom-left panel and is the
  // first thing an audience notices. Build output and the terminal still
  // report everything it would have.
  devIndicators: false,
};

export default nextConfig;
