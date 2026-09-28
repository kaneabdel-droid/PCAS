import type { Metadata } from 'next'
import {
  BadgeCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Landmark,
  PackageCheck,
  Truck,
  Wallet,
} from 'lucide-react'
import { Card, PageHeader } from '@/components/ui/card'
import { ListeATraiter, Tuiles } from '@/components/tableau-de-bord/Tuiles'
import { getContexte } from '@/lib/session'
import { donneesTableauDeBord } from '@/lib/tableau-de-bord'
import { LIBELLES_ROLES, type RoleBase } from '@/lib/roles'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tableau de bord' }

// Étapes du circuit d'une commande, avec le rôle qui agit à chacune (mises en avant pour l'utilisateur connecté).
const CIRCUIT: { titre: string; detail: string; acteur: RoleBase; icone: typeof ClipboardList }[] = [
  { titre: 'Commande', detail: 'Émise par le client avec son en-tête', acteur: 'client', icone: ClipboardList },
  { titre: 'Approbation', detail: 'Date de livraison convenue fixée', acteur: 'superviseur', icone: BadgeCheck },
  { titre: 'Bon de paiement', detail: 'Approuvé par la banque, si paiement par bon', acteur: 'financier', icone: Landmark },
  { titre: 'Validation', detail: 'Le producteur réserve le stock', acteur: 'producteur', icone: PackageCheck },
  { titre: 'Livraison', detail: 'Bon de livraison et facture provisoire', acteur: 'producteur', icone: Truck },
  { titre: 'Réception', detail: 'Quantités vérifiées, commentaire d’approbation', acteur: 'client', icone: FileCheck2 },
  { titre: 'Facture définitive', detail: 'Sur les quantités reçues, avec les échéances', acteur: 'producteur', icone: FileText },
  { titre: 'Paiement', detail: 'Chaque échéance confirmée par le producteur', acteur: 'producteur', icone: Wallet },
]

function salutation() {
  const heure = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', timeZone: 'Africa/Dakar' }).format(new Date()))
  return heure < 18 ? 'Bonjour' : 'Bonsoir'
}

export default async function TableauDeBordPage() {
  const ctx = await getContexte()
  const prenom = ctx.nomComplet.split(/\s+/)[0]
  const { tuiles, listes } = await donneesTableauDeBord(ctx)
  // L'administrateur et le superviseur suivent tout le circuit : aucune étape n'est « la leur » plus qu'une autre,
  // sauf l'approbation pour le superviseur.
  const estMonEtape = (acteur: RoleBase) => acteur === ctx.role || (ctx.role === 'administrateur' && acteur === 'superviseur')

  return (
    <>
      <PageHeader
        titre={`${salutation()}, ${prenom}`}
        description={`${ctx.profilLibelle ?? LIBELLES_ROLES[ctx.role]}${ctx.entrepriseNom ? ` · ${ctx.entrepriseNom}` : ' · Plateforme PCAS'}`}
      />

      <div className="mb-8 space-y-6">
        <Tuiles tuiles={tuiles} />
        <div className="grid gap-6 lg:grid-cols-2">
          {listes.map((l) => (
            <ListeATraiter key={l.titre} titre={l.titre} elements={l.elements} lienTout={l.lienTout} vide={l.vide} />
          ))}
        </div>
      </div>

      <Card>
        <h2 className="font-heading text-lg font-semibold">Rappel : le circuit d’une commande</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Chaque étape est tracée et chaque document porte un QR code qui permet d’en vérifier l’authenticité. Les étapes
          où vous intervenez sont mises en évidence.
        </p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CIRCUIT.map((etape, i) => {
            const Icone = etape.icone
            const mienne = estMonEtape(etape.acteur)
            return (
              <li
                key={etape.titre}
                className={cn(
                  'flex gap-3 rounded-lg border p-4',
                  mienne ? 'border-primary/40 bg-primary-soft' : 'border-surface-border bg-surface-muted'
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    mienne ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground-muted'
                  )}
                  aria-hidden
                >
                  <Icone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className="text-foreground-muted">{i + 1}. </span>
                    {etape.titre}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-muted">{etape.detail}</p>
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                    {LIBELLES_ROLES[etape.acteur]}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>
    </>
  )
}
