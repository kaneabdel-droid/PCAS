import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses.
// La politique de contenu n'autorise que le site lui-même et Supabase (données, authentification, fichiers : logos, photos).
const supabase = 'https://*.supabase.co'
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",   // Next.js injecte des scripts en ligne (données de rendu, thème initial) ; pas de nonce à ce stade
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} wss://*.supabase.co`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  experimental: {
    // Logos, photos de produits et pièces jointes des litiges
    serverActions: { bodySizeLimit: '5mb' },
  },
  poweredByHeader: false,
  images: {
    // Logos et photos publics du Storage Supabase
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Caméra autorisée pour le site lui-même : scanner des QR codes des documents
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig;
