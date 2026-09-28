import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Megaphone, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { STATUTS_BESOIN } from '@/lib/commandes'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Besoins d’achat' }

type BesoinPublic = {
  id: string
  numero: string
  produit_id: string
  produit_nom: string
  unite: string
  quantite: number
  prix_cible: number | null
  date_souhaitee: string
  region_livraison: string | null
  adresse_a_moi: boolean
  mes_propositions: number
  created_at: string
}

type Besoin = {
  id: string
  numero: string
  quantite: number
  prix_cible: number | null
  date_souhaitee: string
  region_livraison: string | null
  statut: string
  created_at: string
  produits: { nom: string; unite: string } | null
  propositions_besoin: { count: number }[]
}

export default async function BesoinsPage({ searchParams }: { searchParams: Promise<{ produit?: string; tous?: string }> }) {
  const ctx = await exigerLecture('/besoins', ['client', 'producteur', 'administrateur', 'superviseur'])
  const { ecrire } = await droitsEcran('/besoins', ['client'])
  const f = await searchParams
  const supabase = await createClient()

  if (ctx.role === 'producteur') {
    // Par défaut, les besoins portant sur les produits que le producteur offre ou sait produire.
    const [{ data }, { data: offres }, { data: capacites }] = await Promise.all([
      supabase.rpc('besoins_publics').select('*').order('date_souhaitee'),
      supabase.from('offres').select('produit_id'),
      supabase.from('capacites_production').select('produit_id'),
    ])
    const mesProduits = new Set([...(offres ?? []), ...(capacites ?? [])].map((o) => o.produit_id))
    const besoins = ((data ?? []) as unknown as BesoinPublic[]).filter((b) => f.tous === '1' || mesProduits.size === 0 || mesProduits.has(b.produit_id) || b.adresse_a_moi)
    return (
      <>
        <PageHeader
          titre="Besoins d’achat des clients"
          description="Besoins publiés par les acheteurs. Faites une proposition : le client choisit, puis la commande suit le circuit habituel. L’identité du client est communiquée à la commande."
        >
          <Button asChild variant="outline">
            <Link href={f.tous === '1' ? '/besoins' : '/besoins?tous=1'}>{f.tous === '1' ? 'Mes produits seulement' : 'Tous les produits'}</Link>
          </Button>
        </PageHeader>
        {besoins.length === 0 ? (
          <Vide titre="Aucun besoin ouvert pour le moment" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {besoins.map((b) => (
              <li key={b.id}>
                <Link href={`/besoins/${b.id}`} className="flex h-full flex-col gap-3 rounded-xl border border-surface-border bg-surface p-4 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading font-semibold">{b.produit_nom}</p>
                      <p className="font-mono text-xs text-foreground-muted">{b.numero}</p>
                    </div>
                    {b.adresse_a_moi && (
                      <Badge ton="primaire">
                        <Target className="mr-1 h-3 w-3" aria-hidden /> Vous est adressé
                      </Badge>
                    )}
                  </div>
                  <p className="font-heading text-xl font-semibold">{formatQuantite(b.quantite, b.unite)}</p>
                  <p className="text-sm text-foreground-muted">
                    Pour le {formatDate(b.date_souhaitee)}
                    {b.region_livraison ? ` · ${b.region_livraison}` : ''}
                    {b.prix_cible ? ` · prix cible ${formatMontant(b.prix_cible)}/${b.unite}` : ''}
                  </p>
                  {Number(b.mes_propositions) > 0 && (
                    <p className="mt-auto text-sm font-medium text-success">Vous avez fait {b.mes_propositions} proposition(s)</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  }

  let requete = supabase
    .from('besoins_achat')
    .select('id, numero, quantite, prix_cible, date_souhaitee, region_livraison, statut, created_at, produits(nom, unite), propositions_besoin(count)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (f.produit) requete = requete.eq('produit_id', f.produit)
  const { data } = await requete.returns<Besoin[]>()
  const besoins = data ?? []

  return (
    <>
      <PageHeader
        titre="Besoins d’achat"
        description={
          ctx.role === 'client'
            ? 'Exprimez ce que vous cherchez : les producteurs vous font des propositions (sans connaître votre identité), vous retenez celle qui vous convient.'
            : 'Besoins publiés par les clients et propositions reçues.'
        }
      >
        {ctx.role === 'client' && ecrire && (
          <Button asChild>
            <Link href="/besoins/nouveau">
              <Megaphone className="h-4 w-4" aria-hidden /> Exprimer un besoin
            </Link>
          </Button>
        )}
      </PageHeader>
      {besoins.length === 0 ? (
        <Vide titre="Aucun besoin d’achat" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {besoins.map((b) => {
            const statut = STATUTS_BESOIN[b.statut]
            const nb = b.propositions_besoin[0]?.count ?? 0
            return (
              <li key={b.id}>
                <Link href={`/besoins/${b.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {b.produits?.nom} · {formatQuantite(b.quantite, b.produits?.unite)}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      <span className="font-mono">{b.numero}</span> · pour le {formatDate(b.date_souhaitee)}
                      {b.region_livraison ? ` · ${b.region_livraison}` : ''}
                    </p>
                  </div>
                  <span className="hidden text-sm text-foreground-muted sm:block">{nb} proposition(s)</span>
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
