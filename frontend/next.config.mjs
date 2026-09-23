/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' } : {}),
  reactStrictMode: false,
  async rewrites() {
    const backendUrl = process.env.INTERNAL_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/backend-api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
