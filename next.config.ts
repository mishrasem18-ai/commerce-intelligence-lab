import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Bind Cloudflare resources (the D1 database, etc.) into `next dev` so that
// getCloudflareContext() resolves against the local Wrangler/Miniflare state.
// This is a no-op for production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
