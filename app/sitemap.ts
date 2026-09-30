import type { MetadataRoute } from 'next'

// Pages publiques proposées aux moteurs de recherche (la page de découverte en premier).
export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pcas.dembasolution.com').replace(/\/$/, '')
  return [
    { url: `${site}/decouvrir-pcas`, changeFrequency: 'monthly', priority: 1 },
    { url: `${site}/guide`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${site}/demande-acces`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${site}/login`, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${site}/verifier`, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
