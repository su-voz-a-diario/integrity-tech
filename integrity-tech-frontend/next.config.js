/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${backendUrl}/health/:path*`,
      },
      {
        source: '/metrics',
        destination: `${backendUrl}/metrics`,
      },
      {
        source: '/snapshots/:path*',
        destination: `${backendUrl}/snapshots/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
