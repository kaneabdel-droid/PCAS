import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { exigerLecture } from '@/lib/droits'
import { STATUTS_ECHEANCE } from '@/lib/execution'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Échéancier' }

type Ligne = {
  id: string
  rang: number
  date_echeance: string
  montant: number
  statut: string
  payee_le: string | null
  factures: {
    id: string
    numero: string
    producteur_id: string
    commandes: { numero: string; entete_client: { denomination?: string } } | null
  } | null
}

const ONGLETS = [
  { cle: 'en_retard', libelle: 'En retard' },
  { cle: 'a_payer', libelle: 'À venir' },
  { cle: 'payee', libelle: 'Payées' },
]

/** Échéances des factures définitives : à payer (client), à encaisser (producteur), suivi (banque, plateforme). */
export default async function EcheancesPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await exigerLecture('/echeances', ['producteur', 'client', 'financier', 'administrateur', 'superviseur'])
  const demande = (await searchParams).onglet
  const onglet = ONGLETS.some((o) => o.cle === demande) ? demande! : 'en_retard'
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('echeances')
      .select('id, rang, date_echeance, montant, statut, payee_le, factures(id, numero, producteur_id, commandes(numero, entete_client))')
      .order('date_echeance')
      .limit(2000)
      .returns<Ligne[]>(),
    supabase.rpc('producteurs_publics').select('id, denomination'),
  ])
  const echeances = data ?? []
  const noms = new Map(((producteurs ?? []) as { id: string; denomination: string }[]).map((p) => [p.id, p.denomination]))
  const affichees = echeances.filter((e) => e.statut === onglet)
  const total = (s: string) => echeances.filter((e) => e.statut === s).reduce((t, e) => t + Number(e.montant), 0)

  return (
    <>
      <PageHeader
        titre="Échéancier"
        description={
          ctx.role === 'producteur'
            ? 'Paiements attendus de vos clients. Confirmez chaque paiement reçu depuis la facture.'
            : ctx.role === 'client'
              ? 'Vos échéances de paiement aux producteurs.'
              : 'Échéances des factures définitives.'
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {ONGLETS.map((o) => (
          <div key={o.cle} className="rounded-xl border border-surface-border bg-surface p-4">
            <p className="text-sm text-foreground-muted">{o.libelle}</p>
            <p className={`mt-1 font-heading text-2xl font-semibold tabular-nums ${o.cle === 'en_retard' && total(o.cle) > 0 ? 'text-danger' : ''}`}>
              {formatMontant(total(o.cle))}
            </p>
          </div>
        ))}
      </div>
      <Onglets base="/echeances" actif={onglet} onglets={ONGLETS.map((o) => ({ ...o, compte: echeances.filter((e) => e.statut === o.cle).length }))} />
      {affichees.length === 0 ? (
        <Vide titre="Aucune échéance ici" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {affichees.map((e) => {
            const f = e.factures
            const st = STATUTS_ECHEANCE[e.statut]
            const partie = ctx.role === 'producteur' ? f?.commandes?.entete_client.denomination : ctx.role === 'client' ? noms.get(f?.producteur_id ?? '') : `${f?.commandes?.entete_client.denomination ?? ''} → ${noms.get(f?.producteur_id ?? '') ?? ''}`
            return (
              <li key={e.id}>
                <Link href={`/factures/${f?.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <div className="w-24 shrink-0 text-sm tabular-nums">{formatDate(e.statut === 'payee' ? e.payee_le : e.date_echeance)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{partie}</p>
                    <p className="text-sm text-foreground-muted">
                      Facture <span className="font-mono">{f?.numero}</span> · échéance {e.rang} · commande {f?.commandes?.numero}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatMontant(e.montant)}</span>
                  <Badge ton={st.ton}>{st.libelle}</Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
