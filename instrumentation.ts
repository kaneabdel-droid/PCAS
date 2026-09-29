import * as Sentry from '@sentry/nextjs'

// Remontée des erreurs serveur vers Sentry (rendu, actions serveur, routes, proxy). Inactif sans NEXT_PUBLIC_SENTRY_DSN.
// Aucune donnée personnelle envoyée (voir dataCollection).
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'local',
    // Aucune donnée personnelle ou financière : ni identité, cookies, en-têtes, corps de requête ni paramètres d'URL.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0.1,
  })
}

export const onRequestError = Sentry.captureRequestError
