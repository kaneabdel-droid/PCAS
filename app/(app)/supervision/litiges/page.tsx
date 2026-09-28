import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Scale } from 'lucide-react'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { exigerLecture } from '@/lib/droits'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Litiges de réception' }

type Litige = {
  id: string
  numero: string
  bl_id: string
  motif_litige: string | null
  receptionne_le: string | null
  commandes: { numero: string; producteur_id: string; entete_client: { denomination?: string } } | null
}

/** Réceptions contestées par les clients, à arbitrer par le superviseur. */
export default async function LitigesPage() {
  await exigerLecture('/supervision/litiges', ['superviseur', 'administrateur'])
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('bons_reception')
      .select('id, numero, bl_id, motif_litige, receptionne_le, commandes(numero, producteur_id, entete_client)')
      .eq('statut', 'en_litige')
      .order('receptionne_le')
      .returns<Litige[]>(),
    supabase.from('entreprises').select('id, denomination').eq('type', 'producteur'),
  ])
  const noms = new Map((producteurs ?? []).map((p) => [p.id, p.denomination]))
  const litiges = data ?? []

  return (
    <>
      <PageHeader titre="Litiges de réception" description="Réceptions contestées par les clients. L’arbitrage fixe les quantités retenues pour la facture définitive." />
      {litiges.length === 0 ? (
        <Vide titre="Aucun litige en cours" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {litiges.map((l) => (
            <li key={l.id}>
              <Link href={`/livraisons/${l.bl_id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                <Scale className="h-5 w-5 shrink-0 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <span className="font-mono text-sm">{l.numero}</span> · {l.commandes?.entete_client.denomination} ←{' '}
                    {noms.get(l.commandes?.producteur_id ?? '')}
                  </p>
                  <p className="truncate text-sm text-foreground-muted">
                    Contesté le {formatDate(l.receptionne_le)} · {l.motif_litige}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
