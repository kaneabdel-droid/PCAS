import type { MetadataRoute } from 'next'

// Moteurs de recherche : seules les pages publiques de présentation sont à indexer ; l'application, les documents et
// les routes techniques restent hors index (elles exigent de toute façon une connexion ou un jeton).
export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pcas.dembasolution.com').replace(/\/$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: ['/decouvrir-pcas', '/guide', '/login', '/demande-acces', '/verifier'],
      disallow: ['/api/', '/monitoring', '/auth/', '/impression/', '/v/', '/demo'],
    },
    sitemap: `${site}/sitemap.xml`,
  }
}
