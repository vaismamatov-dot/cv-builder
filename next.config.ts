import type { NextConfig } from 'next';
const pagesBuild = process.env.PAGES_BUILD === 'true';
const pagesBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/cv-builder').replace(/\/$/, '');
const config: NextConfig = {
  poweredByHeader: false,
  ...(pagesBuild ? {
    output: 'export' as const,
    basePath: pagesBasePath,
    trailingSlash: true,
    images: { unoptimized: true },
  } : { async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV==='development'?" 'unsafe-eval'":''}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'` }
    ] }];
  } })
};
export default config;
