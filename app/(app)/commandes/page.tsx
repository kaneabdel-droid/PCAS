import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, ShoppingCart } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { STATUTS_COMMANDE } from '@/lib/commandes'
import { exigerLecture } from '@/lib/droits'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Commandes' }

type Ligne = {
  id: string
  numero: string
  statut: string
  producteur_id: string
  montant_total: number
  soumise_le: string
  date_souhaitee: string | null
  date_livraison_convenue: string | null
  entete_client: { denomination?: string }
}

// Regroupement des statuts en onglets
const GROUPES: { cle: string; libelle: string; statuts: string[] }[] = [
  { cle: 'en_cours', libelle: 'En cours', statuts: ['soumise', 'en_attente', 'approuvee', 'attente_banque', 'approuvee_banque', 'validee', 'en_livraison', 'livree_partiellement', 'livree', 'en_litige'] },
  { cle: 'a_payer', libelle: 'Réceptionnées', statuts: ['receptionnee', 'partiellement_payee'] },
  { cle: 'terminees', libelle: 'Soldées', statuts: ['soldee'] },
  { cle: 'closes', libelle: 'Annulées ou refusées', statuts: ['annulee', 'refusee', 'refusee_banque', 'refusee_producteur', 'reorientee', 'repartie'] },
]

export default async function CommandesPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await exigerLecture('/commandes', ['client', 'producteur', 'administrateur', 'superviseur'])
  const demande = (await searchParams).onglet
  const groupe = GROUPES.find((g) => g.cle === demande) ?? GROUPES[0]
  const supabase = await createClient()
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('commandes')
      .select('id, numero, statut, producteur_id, montant_total, soumise_le, date_souhaitee, date_livraison_convenue, entete_client')
      .order('soumise_le', { ascending: false })
      .limit(500)
      .returns<Ligne[]>(),
    supabase.rpc('producteurs_publics').select('id, denomination'),
  ])
  const commandes = data ?? []
  const noms = new Map(((producteurs ?? []) as { id: string; denomination: string }[]).map((p) => [p.id, p.denomination]))
  const affichees = commandes.filter((c) => groupe.statuts.includes(c.statut))

  const description =
    ctx.role === 'client'
      ? 'Vos commandes et leur avancement, de l’émission au paiement.'
      : ctx.role === 'producteur'
        ? 'Commandes qui vous sont adressées, une fois approuvées par le superviseur.'
        : 'Toutes les commandes de la plateforme.'

  return (
    <>
      <PageHeader titre="Commandes" description={description}>
        {ctx.role === 'client' && (
          <Button asChild variant="outline">
            <Link href="/marche">
              <ShoppingCart className="h-4 w-4" aria-hidden /> Nouvelle commande
            </Link>
          </Button>
        )}
      </PageHeader>
      <Onglets
        base="/commandes"
        actif={groupe.cle}
        onglets={GROUPES.map((g) => ({ cle: g.cle, libelle: g.libelle, compte: commandes.filter((c) => g.statuts.includes(c.statut)).length }))}
      />
      {affichees.length === 0 ? (
        <Vide titre="Aucune commande ici" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {affichees.map((c) => {
            const statut = STATUTS_COMMANDE[c.statut]
            const partie = ctx.role === 'client' ? noms.get(c.producteur_id) : ctx.role === 'producteur' ? c.entete_client.denomination : `${c.entete_client.denomination} → ${noms.get(c.producteur_id) ?? '…'}`
            return (
              <li key={c.id}>
                <Link href={`/commandes/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="font-mono text-sm">{c.numero}</span> · {partie}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      Émise le {formatDate(c.soumise_le)}
                      {c.date_livraison_convenue
                        ? ` · livraison convenue le ${formatDate(c.date_livraison_convenue)}`
                        : c.date_souhaitee
                          ? ` · souhaitée le ${formatDate(c.date_souhaitee)}`
                          : ''}
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
