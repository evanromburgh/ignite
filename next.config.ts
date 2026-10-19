import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/unit/:unitNumber', destination: '/', permanent: false }]
  },
}

export default nextConfig
