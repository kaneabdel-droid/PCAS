import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/Logo'

const ATOUTS = [
  'Offres des producteurs, disponibles aujourd’hui ou à date',
  'Commandes approuvées, livrées et réceptionnées en ligne',
  'Factures et échéances suivies jusqu’au paiement',
  'Chaque document signé et vérifiable par QR code',
]

/** Mise en page des écrans publics (connexion, mot de passe) : panneau de marque à gauche sur grand écran, formulaire à droite. */
export function EcranAuth({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sidebar-actif/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/40 blur-3xl"
          aria-hidden
        />
        <Logo className="relative" />
        <div className="relative max-w-lg">
          <h2 className="font-heading text-4xl font-semibold leading-tight">
            Du champ à l’acheteur, une seule plateforme pour vendre les produits agricoles du Sénégal.
          </h2>
          <ul className="mt-8 space-y-3">
            {ATOUTS.map((a) => (
              <li key={a} className="flex items-start gap-3 text-sidebar-foreground/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sidebar-actif" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-muted">
          Riz local · Oignon · Pomme de terre · Carotte · Tomate · Banane · Mangue · Anacarde · Madd · Orange
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="text-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{titre}</h1>
          {sousTitre && <p className="mt-1 text-sm text-foreground-muted">{sousTitre}</p>}
          <div className="mt-8">{children}</div>
          <p className="mt-10 text-center text-xs text-foreground-muted">PCAS · un produit DembaSolution</p>
        </div>
      </section>
    </main>
  )
}
