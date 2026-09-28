import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { STATUTS_COMMANDE } from '@/lib/commandes'
import { exigerLecture } from '@/lib/droits'
import { STATUTS_A_TRAITER, analyser, dateAnalyse, niveauRisque } from '@/lib/supervision'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Approbations' }

type Commande = {
  id: string
  numero: string
  statut: string
  producteur_id: string
  montant_total: number
  soumise_le: string
  date_souhaitee: string | null
  date_livraison_convenue: string | null
  mode_paiement: string
  commande_parent_id: string | null
  entete_client: { denomination?: string }
  lignes_commande: { produit_id: string; quantite: number }[]
}

const PICTOS = {
  ok: { Icone: CheckCircle2, classe: 'text-success', libelle: 'Capacité suffisante' },
  juste: { Icone: AlertTriangle, classe: 'text-warning', libelle: 'Capacité juste' },
  insuffisant: { Icone: XCircle, classe: 'text-danger', libelle: 'Capacité insuffisante' },
}

/** File des commandes à traiter par le superviseur, les plus anciennes d'abord, avec un indicateur de capacité. */
export default async function ApprobationsPage() {
  await exigerLecture('/supervision/approbations', ['superviseur', 'administrateur'])
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('commandes')
      .select('id, numero, statut, producteur_id, montant_total, soumise_le, date_souhaitee, date_livraison_convenue, mode_paiement, commande_parent_id, entete_client, lignes_commande(produit_id, quantite)')
      .in('statut', STATUTS_A_TRAITER)
      .order('soumise_le')
      .limit(100)
      .returns<Commande[]>(),
    supabase.from('entreprises').select('id, denomination').eq('type', 'producteur'),
  ])
  const commandes = data ?? []
  const noms = new Map((producteurs ?? []).map((p) => [p.id, p.denomination]))

  // Pire niveau de risque parmi les lignes de chaque commande
  const risques = await Promise.all(
    commandes.map(async (c) => {
      const date = dateAnalyse(c.date_livraison_convenue, c.date_souhaitee)
      const niveaux = await Promise.all(
        c.lignes_commande.map(async (l) => {
          const a = await analyser(c.producteur_id, l.produit_id, date, c.id)
          return a ? niveauRisque(a, Number(l.quantite)) : 'insuffisant'
        })
      )
      return niveaux.includes('insuffisant') ? 'insuffisant' : niveaux.includes('juste') ? 'juste' : 'ok'
    })
  )

  return (
    <>
      <PageHeader
        titre="Approbations"
        description="Commandes à approuver (avec la date de livraison convenue), mettre en attente, réorienter, répartir ou refuser. Les plus anciennes en premier."
      />
      {commandes.length === 0 ? (
        <Vide titre="Aucune commande à traiter">Toutes les commandes soumises ont été traitées.</Vide>
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {commandes.map((c, i) => {
            const picto = PICTOS[risques[i] as keyof typeof PICTOS]
            const statut = STATUTS_COMMANDE[c.statut]
            return (
              <li key={c.id}>
                <Link href={`/supervision/approbations/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <picto.Icone className={`h-5 w-5 shrink-0 ${picto.classe}`} aria-label={picto.libelle} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="font-mono text-sm">{c.numero}</span> · {c.entete_client.denomination} → {noms.get(c.producteur_id)}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Émise le {formatDate(c.soumise_le)}
                      {c.date_souhaitee ? ` · souhaitée le ${formatDate(c.date_souhaitee)}` : ''}
                      {c.mode_paiement === 'bon_banque' ? ' · bon de paiement bancaire' : ''}
                      {c.commande_parent_id ? ' · issue d’une réorientation / répartition' : ''}
                    </p>
                  </div>
                  <span className="hidden font-semibold tabular-nums sm:block">{formatMontant(c.montant_total)}</span>
                  <Badge ton={statut.ton}>{statut.libelle}</Badge>
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
