/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Coolify Docker image — produces a self-contained
  // .next/standalone/ output so the runtime stage stays small.
  output: 'standalone',
  // Pin the workspace root to this directory — there are lockfiles both here
  // and at the monorepo root, and Next would otherwise infer the wrong one.
  turbopack: {
    root: import.meta.dirname,
  },
  outputFileTracingRoot: import.meta.dirname,
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
      {
        // Uploaded files (competition logos, etc.) are served by the backend
        // outside /api — proxy them so the web app can render them in dev.
        source: '/uploads/:path*',
        destination: `${backend}/uploads/:path*`,
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
