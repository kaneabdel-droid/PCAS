// Remontée des erreurs du navigateur vers Sentry. Inactif sans NEXT_PUBLIC_SENTRY_DSN : le SDK n'est alors même pas
// téléchargé (import dynamique), pour ne rien ajouter au poids des pages sur les connexions mobiles.
// Pas d'enregistrement de session (replay) : trop coûteux en données mobiles pour les utilisateurs.
// Les envois passent par /monitoring (tunnel sur le site lui-même) : ni la CSP ni les bloqueurs de publicité ne les coupent.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  import('@sentry/nextjs')
    .then((Sentry) =>
      Sentry.init({
        dsn,
        tunnel: '/monitoring',
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'local',
        // Aucune donnée personnelle ou financière : ni identité, cookies, en-têtes, corps de requête ni paramètres d'URL.
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
        tracesSampleRate: 0.1,
      })
    )
    .catch(() => undefined)
}
