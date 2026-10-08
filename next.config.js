/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { instrumentationHook: true },
  webpack: (config) => {
    // face-api.js pulls in node-only optional deps (fs, encoding) that are
    // never used in the browser bundle; stub them out to silence warnings.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      encoding: false,
    };
    return config;
  },
};

module.exports = nextConfig;
