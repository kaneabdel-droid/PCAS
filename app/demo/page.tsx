import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Building2, Info } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { COMPTES_DEMO, demoActive, type CompteDemo } from '@/lib/demo'
import type { RoleBase } from '@/lib/roles'
import { connexionDemo } from './actions'

export const metadata: Metadata = { title: 'Démonstration' }

const GROUPES: { role: RoleBase; titre: string; texte: string }[] = [
  { role: 'producteur', titre: 'Producteurs', texte: 'Stocks, transformations, offres, validation des commandes, livraisons, factures, paiements.' },
  { role: 'client', titre: 'Clients', texte: 'Marché, panier, commandes, besoins d’achat, réceptions, litiges, échéances.' },
  { role: 'financier', titre: 'Banques', texte: 'Bons de paiement à approuver ou refuser, suivi des échéances.' },
  { role: 'superviseur', titre: 'Supervision', texte: 'Approbations avec analyse de capacité, répartition, réorientation, arbitrage des litiges.' },
  { role: 'administrateur', titre: 'Administration', texte: 'Entreprises, comptes, profils, catalogue, contrats, journal d’audit.' },
]

const PARCOURS = [
  'Commandes à tous les stades : soumise, en attente, refusée, annulée, approuvée, bon bancaire en attente ou refusé, refusée par le producteur, validée, livrée partiellement, livrée, en litige, arbitrée, réceptionnée avec écart, partiellement payée, soldée, réception tacite, répartie, réorientée.',
  'Facturation regroupée (deux livraisons, une facture définitive), échéance en retard, commande ferme sur une offre à date avec déclaration de production.',
  'Besoins d’achat : ouvert avec proposition, adressé à un producteur précis, converti en commande, clos. Une demande d’accès attend l’administrateur.',
  'Chaque document porte un QR code vérifiable : imprimez une facture ou un bon de livraison, puis scannez-le.',
]

function CarteCompte({ compte }: { compte: CompteDemo }) {
  return (
    <form action={connexionDemo}>
      <input type="hidden" name="email" value={compte.email} />
      <button
        type="submit"
        className="group flex h-full w-full flex-col rounded-xl border border-surface-border bg-surface p-4 text-left transition hover:border-primary hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-semibold text-foreground">{compte.nom}</span>
            <span className="block text-sm text-foreground-muted">{compte.fonction}</span>
          </span>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-foreground-muted transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
        </span>
        {compte.entrepriseNom && (
          <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {compte.entrepriseNom}
          </span>
        )}
        <span className="mt-2 text-sm leading-relaxed text-foreground-muted">{compte.description}</span>
      </button>
    </form>
  )
}

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (!demoActive()) notFound()
  const { erreur } = await searchParams

  return (
    <main className="min-h-screen flex-1 bg-background px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Connexion avec un compte réel
          </Link>
        </div>

        <h1 className="mt-10 font-heading text-3xl font-semibold text-foreground">Démonstration de PCAS</h1>
        <p className="mt-2 max-w-3xl text-foreground-muted">
          Choisissez un acteur pour entrer dans la plateforme avec son compte. Vous pouvez changer de rôle à tout moment depuis
          le bandeau en haut de l’application, et ouvrir plusieurs rôles à la fois dans des navigateurs différents (ou une
          fenêtre privée) pour suivre une commande de bout en bout.
        </p>

        <div className="mt-6 flex gap-3 rounded-xl border border-info/40 bg-info/10 p-4 text-sm text-foreground">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
          <p>
            Produits, prix, régions et volumes réalistes ; <strong>entreprises, personnes et identifiants fictifs</strong>. La
            démonstration est partagée entre tous les visiteurs et remise à zéro régulièrement : vos essais peuvent être vus
            par d’autres. Aucun email n’est envoyé.
          </p>
        </div>

        {erreur && (
          <p className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            Connexion impossible pour le moment : la démonstration est peut-être en cours de réinitialisation. Réessayez dans
            une minute.
          </p>
        )}

        {GROUPES.map((g) => {
          const comptes = COMPTES_DEMO.filter((c) => c.role === g.role)
          if (!comptes.length) return null
          return (
            <section key={g.role} className="mt-10">
              <h2 className="font-heading text-xl font-semibold text-foreground">{g.titre}</h2>
              <p className="mt-1 text-sm text-foreground-muted">{g.texte}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {comptes.map((c) => (
                  <CarteCompte key={c.cle} compte={c} />
                ))}
              </div>
            </section>
          )
        })}

        <section className="mt-12 rounded-xl border border-surface-border bg-surface p-6">
          <h2 className="font-heading text-xl font-semibold text-foreground">Ce que contient la démonstration</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground-muted">
            {PARCOURS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/guide" className="font-medium text-primary hover:underline">
              Guide d’utilisation
            </Link>
          </p>
        </section>
      </div>
    </main>
  )
}
