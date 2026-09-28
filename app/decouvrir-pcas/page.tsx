import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, ClipboardCheck, FileText, Info, Landmark, QrCode, ShoppingBasket, Warehouse } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { COMPTES_DEMO, demoActive, type CompteDemo } from '@/lib/demo'
import type { RoleBase } from '@/lib/roles'
import { connexionDemo } from '@/app/demo/actions'

export const metadata: Metadata = {
  title: 'Découvrir PCAS',
  description: 'Plateforme de Commercialisation Agricole du Sénégal : offres des producteurs, commandes supervisées, livraisons, factures et paiements.',
}

const MODULES = [
  { icon: Warehouse, titre: 'Stocks et offres', texte: 'Le producteur tient ses stocks (matière première invisible des clients) et publie ses offres : disponibles aujourd’hui, à court ou à moyen terme selon sa capacité de production.' },
  { icon: ShoppingBasket, titre: 'Marché et besoins d’achat', texte: 'Le client commande chez le producteur de son choix ou publie un besoin d’achat auquel les producteurs répondent par des propositions.' },
  { icon: ClipboardCheck, titre: 'Supervision', texte: 'Chaque commande est analysée au regard des capacités : approbation avec date convenue, mise en attente, répartition entre producteurs ou réorientation.' },
  { icon: Landmark, titre: 'Banques', texte: 'Paiement par bon bancaire : la banque approuve ou refuse l’engagement avant que le producteur ne valide la commande.' },
  { icon: FileText, titre: 'Livraison et facturation', texte: 'Bon de livraison, bon de réception avec écarts et litiges, facture provisoire puis définitive, échéancier et suivi des paiements, en FCFA.' },
  { icon: QrCode, titre: 'Documents vérifiables', texte: 'Chaque document porte un QR code : n’importe qui en vérifie l’authenticité, seules les parties voient les montants.' },
]

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

export default async function DecouvrirPcasPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  const demo = demoActive()

  return (
    <main className="min-h-screen flex-1 bg-background px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-4 text-sm font-medium">
            <a href="https://www.dembasolution.com" className="text-foreground-muted hover:text-primary">
              DembaSolution
            </a>
            <Link href="/login" className="text-primary hover:underline">
              Se connecter
            </Link>
          </div>
        </div>

        <section className="py-12 text-center sm:py-16">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Du champ à l’acheteur, une seule plateforme
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg leading-relaxed text-foreground-muted">
            PCAS, la Plateforme de Commercialisation Agricole du Sénégal, relie producteurs, acheteurs et banques : offres,
            commandes supervisées, livraisons, factures et paiements, avec des documents vérifiables par QR code.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {demo && (
              <a href="#demo" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground hover:bg-primary-hover">
                Essayer la démo <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
            <Link href="/demande-acces" className="inline-flex h-11 items-center rounded-lg border border-surface-border bg-surface px-5 font-medium text-foreground hover:border-primary">
              Demander un accès
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icone, titre, texte }) => (
            <div key={titre} className="rounded-xl border border-surface-border bg-surface p-5">
              <Icone className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold text-foreground">{titre}</h2>
              <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{texte}</p>
            </div>
          ))}
        </section>

        {demo && (
          <section id="demo" className="mt-16 scroll-mt-6">
            <h2 className="font-heading text-3xl font-semibold text-foreground">Essayez PCAS en un clic</h2>
            <p className="mt-2 max-w-3xl text-foreground-muted">
              Choisissez un acteur : vous entrez directement dans la plateforme avec son compte. Changez de rôle à tout moment
              depuis le bandeau en haut de l’application, ou ouvrez plusieurs rôles dans des navigateurs différents pour suivre
              une commande de bout en bout.
            </p>

            <div className="mt-6 flex gap-3 rounded-xl border border-info/40 bg-info/10 p-4 text-sm text-foreground">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" aria-hidden />
              <p>
                Produits, prix, régions et volumes réalistes ; <strong>entreprises, personnes et identifiants fictifs</strong>.
                Cet espace est partagé entre tous les visiteurs et remis à zéro régulièrement : n’y saisissez pas
                d’informations réelles.
              </p>
            </div>

            {erreur && (
              <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-foreground">
                Connexion à la démonstration impossible pour le moment. Réessayez dans un instant.
              </p>
            )}

            {GROUPES.map((g) => {
              const comptes = COMPTES_DEMO.filter((c) => c.role === g.role)
              if (!comptes.length) return null
              return (
                <div key={g.role} className="mt-10">
                  <h3 className="font-heading text-xl font-semibold text-foreground">{g.titre}</h3>
                  <p className="mt-1 text-sm text-foreground-muted">{g.texte}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {comptes.map((c) => (
                      <CarteCompte key={c.cle} compte={c} />
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="mt-12 rounded-xl border border-surface-border bg-surface p-6">
              <h3 className="font-heading text-xl font-semibold text-foreground">Ce que contient la démonstration</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground-muted">
                {PARCOURS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <p className="mt-12 text-center text-sm text-foreground-muted">
          <Link href="/guide" className="font-medium text-primary hover:underline">
            Guide d’utilisation
          </Link>
          {' · '}Un produit DembaSolution
        </p>
      </div>
    </main>
  )
}
