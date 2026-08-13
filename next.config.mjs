/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the heavy browser packages out of the bundler so the serverless
    // function can load the Chromium binary at runtime.
    serverComponentsExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  },
};

export default nextConfig;
