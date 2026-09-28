import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { STATUTS_BON, type Bon } from '@/lib/bons'
import { exigerLecture } from '@/lib/droits'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Bons de paiement' }

type Ligne = Bon & { commandes: { numero: string; entete_client: { denomination?: string }; date_livraison_convenue: string | null } | null }

export default async function BonsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await exigerLecture('/bons-paiement', ['financier', 'client', 'administrateur', 'superviseur'])
  const demande = (await searchParams).onglet
  const onglet = demande === 'approuve' || demande === 'refuse' ? demande : 'soumis'
  const supabase = await createClient()
  const [{ data }, { data: banques }] = await Promise.all([
    supabase
      .from('bons_paiement')
      .select('*, commandes(numero, entete_client, date_livraison_convenue)')
      .order('created_at', { ascending: onglet === 'soumis' })
      .limit(500)
      .returns<Ligne[]>(),
    supabase.rpc('banques_publiques').select('id, denomination'),
  ])
  const bons = data ?? []
  const nomsBanques = new Map(((banques ?? []) as { id: string; denomination: string }[]).map((b) => [b.id, b.denomination]))
  const affiches = bons.filter((b) => b.statut === onglet)

  return (
    <>
      <PageHeader
        titre="Bons de paiement"
        description={
          ctx.role === 'financier'
            ? 'Bons émis à votre établissement pour des commandes approuvées. Votre approbation transmet la commande au producteur.'
            : 'Bons de paiement bancaires des commandes payées par la banque du client.'
        }
      />
      <Onglets
        base="/bons-paiement"
        actif={onglet}
        onglets={(['soumis', 'approuve', 'refuse'] as const).map((s) => ({ cle: s, libelle: STATUTS_BON[s].libelle, compte: bons.filter((b) => b.statut === s).length }))}
      />
      {affiches.length === 0 ? (
        <Vide titre="Aucun bon de paiement ici" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {affiches.map((b) => (
            <li key={b.id}>
              <Link href={`/bons-paiement/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="font-mono text-sm">{b.numero}</span> · {b.commandes?.entete_client.denomination}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Commande {b.commandes?.numero} · émis le {formatDate(b.created_at)}
                    {ctx.role !== 'financier' ? ` · ${nomsBanques.get(b.banque_id) ?? ''}` : ''}
                    {b.reference_bancaire ? ` · réf. ${b.reference_bancaire}` : ''}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatMontant(b.montant)}</span>
                <Badge ton={STATUTS_BON[b.statut].ton}>{STATUTS_BON[b.statut].libelle}</Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
