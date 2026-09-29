'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * Erreur inattendue dans une page (panne réseau, base indisponible, bogue) : message en français et nouvel essai sans
 * recharger toute l'application. Aucune donnée n'est perdue : les écritures passent par des transactions de la base,
 * complètes ou annulées.
 */
export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" aria-hidden />
        <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">Cette page n’a pas pu s’afficher</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          Un incident passager (connexion, serveur) a interrompu le chargement. Vos données sont intactes : réessayez dans
          un instant.
        </p>
        {error.digest && <p className="mt-2 text-xs text-foreground-muted">Référence de l’incident : {error.digest}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Réessayer
          </button>
          <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-surface-border px-4 text-sm font-medium text-foreground hover:border-primary">
            Tableau de bord
          </Link>
        </div>
      </div>
    </main>
  )
}
