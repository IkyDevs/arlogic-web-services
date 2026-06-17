/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['*.supabase.co', 'pub-*.r2.dev'],
  },
  // Konfigurasi untuk Vercel
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // Body size limit
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Optimasi untuk Vercel
  swcMinify: true,
  compress: true,
  // Skip Sharp cache di production
  serverRuntimeConfig: {
    PROJECT_ROOT: __dirname,
  },
}

module.exports = nextConfig
