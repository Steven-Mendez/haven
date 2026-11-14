import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev indicator covers the operator avatar in demo recordings.
  devIndicators: false,
  partialPrefetching: true,
  // packages/core ships as uncompiled TypeScript.
  transpilePackages: ['@haven/core'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
