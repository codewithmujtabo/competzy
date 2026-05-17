/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this directory — there are lockfiles both here
  // and at the monorepo root, and Next would otherwise infer the wrong one.
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'ngrok-skip-browser-warning', value: '1' }],
      },
    ];
  },
};

export default nextConfig;
