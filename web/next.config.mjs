/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Coolify Docker image — produces a self-contained
  // .next/standalone/ output so the runtime stage stays small.
  output: 'standalone',
  poweredByHeader: false,
  // Pin the workspace root to this directory — there are lockfiles both here
  // and at the monorepo root, and Next would otherwise infer the wrong one.
  turbopack: {
    root: import.meta.dirname,
  },
  outputFileTracingRoot: import.meta.dirname,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // nginx terminates TLS; HSTS passes through to the browser.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SAMEORIGIN (not DENY): nothing on the platform frames arena today,
          // but same-origin embedding stays available for future dialogs.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // camera=self: the exam runner's webcam proctoring needs it.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
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
      {
        // Signed file URLs (documents) — the backend serves these JWT-token
        // links outside /api in dev; proxy them so downloads work on the web.
        source: '/uploads-signed/:path*',
        destination: `${backend}/uploads-signed/:path*`,
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
