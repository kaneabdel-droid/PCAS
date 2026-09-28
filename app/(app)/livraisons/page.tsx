import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { exigerLecture } from '@/lib/droits'
import { STATUTS_RECEPTION } from '@/lib/execution'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Livraisons et réceptions' }

type Ligne = {
  id: string
  numero: string
  date_livraison: string
  producteur_id: string
  commandes: { numero: string; entete_client: { denomination?: string } } | null
  bons_reception: { numero: string; statut: string; date_limite: string } | null
}

const ONGLETS = [
  { cle: 'a_receptionner', libelle: 'À réceptionner', statuts: ['en_attente'] },
  { cle: 'litiges', libelle: 'En litige', statuts: ['en_litige'] },
  { cle: 'receptionnees', libelle: 'Réceptionnées', statuts: ['approuve', 'approuve_avec_reserves', 'tacite', 'arbitre'] },
]

export default async function LivraisonsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await exigerLecture('/livraisons', ['producteur', 'client', 'administrateur', 'superviseur'])
  const demande = (await searchParams).onglet
  const onglet = ONGLETS.find((o) => o.cle === demande) ?? ONGLETS[0]
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('bons_livraison')
      .select('id, numero, date_livraison, producteur_id, commandes(numero, entete_client), bons_reception(numero, statut, date_limite)')
      .order('created_at', { ascending: false })
      .limit(500)
      .returns<Ligne[]>(),
    supabase.rpc('producteurs_publics').select('id, denomination'),
  ])
  const bls = data ?? []
  const noms = new Map(((producteurs ?? []) as { id: string; denomination: string }[]).map((p) => [p.id, p.denomination]))
  const affiches = bls.filter((b) => b.bons_reception && onglet.statuts.includes(b.bons_reception.statut))

  return (
    <>
      <PageHeader
        titre="Livraisons et réceptions"
        description={
          ctx.role === 'client'
            ? 'Confirmez chaque réception (en corrigeant les quantités si besoin) ou contestez-la. Sans réponse dans le délai, la réception est réputée conforme.'
            : 'Bons de livraison émis et suivi de leur réception par le client.'
        }
      />
      <Onglets
        base="/livraisons"
        actif={onglet.cle}
        onglets={ONGLETS.map((o) => ({ cle: o.cle, libelle: o.libelle, compte: bls.filter((b) => b.bons_reception && o.statuts.includes(b.bons_reception.statut)).length }))}
      />
      {affiches.length === 0 ? (
        <Vide titre="Aucune livraison ici" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {affiches.map((b) => {
            const st = STATUTS_RECEPTION[b.bons_reception!.statut]
            const partie = ctx.role === 'client' ? noms.get(b.producteur_id) : b.commandes?.entete_client.denomination
            return (
              <li key={b.id}>
                <Link href={`/livraisons/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="font-mono text-sm">{b.numero}</span> · {partie}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Commande {b.commandes?.numero} · livré le {formatDate(b.date_livraison)}
                      {b.bons_reception?.statut === 'en_attente' ? ` · réception tacite le ${formatDate(b.bons_reception.date_limite)}` : ''}
                    </p>
                  </div>
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
