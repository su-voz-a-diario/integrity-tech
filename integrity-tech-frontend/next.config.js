/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*', // Redirigir llamadas de API a NestJS
      },
      {
        source: '/snapshots/:path*',
        destination: 'http://localhost:3000/snapshots/:path*', // Redirigir fotos del webcam proctoring a NestJS
      },
    ];
  },
};

module.exports = nextConfig;
