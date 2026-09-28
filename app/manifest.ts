import type { MetadataRoute } from 'next'

// Manifeste PWA : installation depuis Chrome/Edge (Windows, Mac, Linux, Android) et Safari (« Ajouter au Dock » sur Mac,
// « Sur l'écran d'accueil » sur iPhone). L'application reste en ligne : pas de mode hors connexion.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PCAS — Plateforme de Commercialisation Agricole du Sénégal',
    short_name: 'PCAS',
    description: 'Offres des producteurs, commandes, livraisons, factures et paiements des produits agricoles du Sénégal.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F3F2EC',
    theme_color: '#163A27',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icone/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone/512-maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
