import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { exigerLecture } from '@/lib/droits'
import { STATUTS_FACTURE } from '@/lib/execution'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Factures' }

type Ligne = {
  id: string
  numero: string
  nature: 'provisoire' | 'definitive'
  statut: string
  montant_total: number
  date_facture: string
  producteur_id: string
  commandes: { numero: string; entete_client: { denomination?: string } } | null
}

const ONGLETS = [
  { cle: 'a_payer', libelle: 'À payer', statuts: ['definitive', 'partiellement_payee'], nature: 'definitive' },
  { cle: 'payees', libelle: 'Payées', statuts: ['payee'], nature: 'definitive' },
  { cle: 'provisoires', libelle: 'Provisoires', statuts: ['provisoire', 'receptionnee', 'remplacee'], nature: 'provisoire' },
]

export default async function FacturesPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await exigerLecture('/factures', ['producteur', 'client', 'financier', 'administrateur', 'superviseur'])
  const demande = (await searchParams).onglet
  const onglet = ONGLETS.find((o) => o.cle === demande) ?? ONGLETS[0]
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('factures')
      .select('id, numero, nature, statut, montant_total, date_facture, producteur_id, commandes(numero, entete_client)')
      .order('created_at', { ascending: false })
      .limit(1000)
      .returns<Ligne[]>(),
    supabase.rpc('producteurs_publics').select('id, denomination'),
  ])
  const factures = data ?? []
  const noms = new Map(((producteurs ?? []) as { id: string; denomination: string }[]).map((p) => [p.id, p.denomination]))
  const filtre = (o: (typeof ONGLETS)[number]) => factures.filter((f) => f.nature === o.nature && o.statuts.includes(f.statut))
  const affichees = filtre(onglet)
  const total = affichees.reduce((s, f) => s + Number(f.montant_total), 0)

  return (
    <>
      <PageHeader
        titre="Factures"
        description="La facture provisoire accompagne chaque livraison ; la facture définitive, établie sur les quantités reçues, porte les échéances."
      />
      <Onglets base="/factures" actif={onglet.cle} onglets={ONGLETS.map((o) => ({ cle: o.cle, libelle: o.libelle, compte: filtre(o).length }))} />
      {affichees.length === 0 ? (
        <Vide titre="Aucune facture ici" />
      ) : (
        <>
          <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
            {affichees.map((f) => {
              const st = STATUTS_FACTURE[f.statut]
              const partie = ctx.role === 'producteur' ? f.commandes?.entete_client.denomination : ctx.role === 'client' ? noms.get(f.producteur_id) : `${noms.get(f.producteur_id) ?? ''} → ${f.commandes?.entete_client.denomination ?? ''}`
              return (
                <li key={f.id}>
                  <Link href={`/factures/${f.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="font-mono text-sm">{f.numero}</span> · {partie}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        Du {formatDate(f.date_facture)} · commande {f.commandes?.numero}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums">{formatMontant(f.montant_total)}</span>
                    <Badge ton={st.ton}>{st.libelle}</Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-right text-sm text-foreground-muted">
            Total : <strong className="tabular-nums text-foreground">{formatMontant(total)}</strong>
          </p>
        </>
      )}
    </>
  )
}
