import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = { title: 'Pas de connexion' }
export const dynamic = 'force-static'

/** Écran affiché par le service worker quand le réseau est indisponible (PCAS fonctionne toujours en ligne). */
export default function HorsLignePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Logo className="mb-10 text-foreground" />
      <WifiOff className="mb-4 h-12 w-12 text-foreground-muted" aria-hidden />
      <h1 className="font-heading text-2xl font-semibold">Pas de connexion</h1>
      <p className="mt-2 max-w-sm text-sm text-foreground-muted">
        PCAS a besoin d’internet pour garantir des stocks et des commandes toujours à jour. Vérifiez votre connexion, puis réessayez.
      </p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet voulu : retenter le réseau */}
      <a href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
        Réessayer
      </a>
    </main>
  )
}
