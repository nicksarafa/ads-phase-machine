import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The phase machine is a long-lived singleton held on globalThis.
  // Disable strict-mode double-invocation so dev HMR doesn't spawn two loops.
  reactStrictMode: false,
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
