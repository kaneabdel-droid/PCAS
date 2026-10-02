import type { Metadata } from 'next'
import Link from 'next/link'
import { Search, ShoppingCart } from 'lucide-react'
import { CarteMarche } from '@/components/marche/CarteMarche'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { exigerLecture } from '@/lib/droits'
import type { OffreMarche } from '@/lib/marche'
import { chargerReferentielsProduit } from '@/lib/catalogue'
import { REGIONS } from '@/lib/referentiels'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Offres des producteurs' }

type Filtres = { q?: string; categorie?: string; produit?: string; region?: string; dispo?: string; tri?: string; producteur?: string }

export default async function MarchePage({ searchParams }: { searchParams: Promise<Filtres> }) {
  const ctx = await exigerLecture('/marche', ['client', 'administrateur', 'superviseur'])
  const f = await searchParams
  const supabase = await createClient()

  let requete = supabase.rpc('marche_offres').select('*')
  if (f.categorie) requete = requete.eq('categorie', f.categorie)
  if (f.produit) requete = requete.eq('produit_id', f.produit)
  if (f.region) requete = requete.eq('region', f.region)
  if (f.producteur) requete = requete.eq('producteur_id', f.producteur)
  if (f.dispo === 'maintenant') requete = requete.eq('disponibilite', 'immediate')
  if (f.dispo === 'a_date') requete = requete.neq('disponibilite', 'immediate')
  if (f.q?.trim()) {
    const motif = `%${f.q.trim().replace(/[%_,()]/g, ' ')}%`
    requete = requete.or(`produit_nom.ilike.${motif},producteur_nom.ilike.${motif},variete.ilike.${motif}`)
  }
  requete =
    f.tri === 'prix'
      ? requete.order('prix_unitaire', { ascending: true })
      : f.tri === 'date'
        ? requete.order('date_disponibilite', { ascending: true, nullsFirst: true })
        : requete.order('publiee_le', { ascending: false })

  const [{ data }, { data: produits }, { count: nbPanier }, { categories }] = await Promise.all([
    requete.limit(200),
    supabase.from('produits').select('id, nom').eq('nature', 'produit_fini').eq('actif', true).order('nom'),
    ctx.role === 'client'
      ? supabase.from('paniers').select('offre_id', { count: 'exact', head: true })
      : Promise.resolve({ count: 0 }),
    chargerReferentielsProduit(supabase),
  ])
  const offres = (data ?? []) as unknown as OffreMarche[]

  return (
    <>
      <PageHeader
        titre="Offres des producteurs"
        description="Produits agricoles du Sénégal disponibles maintenant ou à une date annoncée. Les prix sont en FCFA par unité de vente."
      >
        {ctx.role === 'client' && (
          <Button asChild variant="outline">
            <Link href="/panier">
              <ShoppingCart className="h-4 w-4" aria-hidden /> Panier{nbPanier ? ` (${nbPanier})` : ''}
            </Link>
          </Button>
        )}
      </PageHeader>

      <form method="get" className="mb-6 grid gap-3 rounded-xl border border-surface-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input name="q" defaultValue={f.q} placeholder="Produit, variété, producteur" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select name="produit" defaultValue={f.produit ?? ''} aria-label="Produit">
          <option value="">Tous les produits</option>
          {(produits ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </Select>
        <Select name="categorie" defaultValue={f.categorie ?? ''} aria-label="Catégorie">
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.nom}>{c.nom}</option>
          ))}
        </Select>
        <Select name="region" defaultValue={f.region ?? ''} aria-label="Région">
          <option value="">Toutes régions</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Select name="dispo" defaultValue={f.dispo ?? ''} aria-label="Disponibilité">
          <option value="">Toute disponibilité</option>
          <option value="maintenant">Disponible maintenant</option>
          <option value="a_date">À une date</option>
        </Select>
        <div className="flex gap-2">
          <Select name="tri" defaultValue={f.tri ?? ''} aria-label="Trier" className="lg:w-36">
            <option value="">Plus récentes</option>
            <option value="prix">Prix croissant</option>
            <option value="date">Disponibles au plus tôt</option>
          </Select>
          <Button type="submit">Filtrer</Button>
        </div>
      </form>

      {offres.length === 0 ? (
        <Vide titre="Aucune offre ne correspond">
          Essayez d’autres filtres, ou{' '}
          {ctx.role === 'client' ? (
            <Link href="/besoins/nouveau" className="font-medium text-primary hover:underline">
              exprimez votre besoin d’achat
            </Link>
          ) : (
            'revenez plus tard'
          )}
          .
        </Vide>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {offres.map((o) => (
            <li key={o.id}>
              <CarteMarche offre={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
