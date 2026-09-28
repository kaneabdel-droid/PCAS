// Service worker PCAS : l'application reste toujours en ligne (pas de données hors connexion). Il ne sert qu'à
// afficher un écran « Pas de connexion » propre quand une page ne peut pas être chargée faute de réseau.
const CACHE = 'pcas-hors-ligne-v1'
const PAGE_HORS_LIGNE = '/hors-ligne'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([PAGE_HORS_LIGNE, '/icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(PAGE_HORS_LIGNE)))
})
