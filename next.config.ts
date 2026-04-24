import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical", "tsdav", "ical-generator", "@claw/calendar-core"],
};

export default nextConfig;
