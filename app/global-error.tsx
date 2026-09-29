'use client'

import { useEffect } from 'react'

/**
 * Dernier recours : erreur dans la mise en page racine elle-même (la feuille de style peut manquer, d'où les styles
 * en ligne). Remplace l'écran anglais par défaut de Next.js.
 */
export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
    // Sentry chargé seulement s'il est configuré (voir instrumentation-client.ts)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error)).catch(() => undefined)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F3F2EC', color: '#13201A' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #E1DDD1', borderRadius: 12, padding: 24 }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>PCAS est momentanément indisponible</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: '#5A665F' }}>
              Un incident passager a interrompu le chargement. Vos données sont intactes : réessayez dans un instant.
            </p>
            {error.digest && <p style={{ fontSize: 12, color: '#5A665F' }}>Référence de l’incident : {error.digest}</p>}
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 8, height: 40, padding: '0 16px', border: 0, borderRadius: 8, background: '#2E6E3E', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
