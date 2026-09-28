import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { analyser, type Analyse } from '@/lib/supervision'
import { cn, dateDans } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Capacités des producteurs' }

/** Production attendue et engagements de chaque producteur pour un produit, à une date donnée. */
export default async function CapacitesPage({ searchParams }: { searchParams: Promise<{ produit?: string; date?: string }> }) {
  await exigerLecture('/supervision/capacites', ['superviseur', 'administrateur'])
  const f = await searchParams
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const date = f.date && f.date >= aujourdhui ? f.date : dateDans(30)
  const supabase = await createClient()
  const { data: produits } = await supabase.from('produits').select('id, nom, unite').eq('nature', 'produit_fini').eq('actif', true).order('nom')
  const produit = (produits ?? []).find((p) => p.id === f.produit) ?? (produits ?? [])[0]

  let lignes: { id: string; denomination: string; region: string | null; analyse: Analyse }[] = []
  if (produit) {
    // Producteurs concernés : capacité déclarée, stock ou offre de ce produit (ou matière première qui le donne)
    const { data: transformations } = await supabase.from('transformations').select('matiere_id').eq('produit_id', produit.id)
    const produitsLies = [produit.id, ...(transformations ?? []).map((t) => t.matiere_id)]
    const [{ data: capacites }, { data: stocks }, { data: offres }] = await Promise.all([
      supabase.from('capacites_production').select('sites_production!inner(entreprise_id)').eq('produit_id', produit.id),
      supabase.from('stocks').select('entreprise_id').in('produit_id', produitsLies).gt('quantite_physique', 0),
      supabase.from('offres').select('producteur_id').eq('produit_id', produit.id).eq('statut', 'publiee'),
    ])
    const ids = new Set<string>([
      ...((capacites ?? []) as unknown as { sites_production: { entreprise_id: string } }[]).map((c) => c.sites_production.entreprise_id),
      ...(stocks ?? []).map((s) => s.entreprise_id),
      ...(offres ?? []).map((o) => o.producteur_id),
    ])
    const { data: entreprises } = ids.size
      ? await supabase.from('entreprises').select('id, denomination, region').in('id', [...ids]).eq('statut', 'actif').order('denomination')
      : { data: [] }
    const analyses = await Promise.all((entreprises ?? []).map((e) => analyser(e.id, produit.id, date)))
    lignes = (entreprises ?? [])
      .map((e, i) => ({ ...e, analyse: analyses[i]! }))
      .filter((l) => l.analyse)
      .sort((a, b) => b.analyse.marge - a.analyse.marge)
  }
  const unite = produit?.unite ?? ''
  const q = (n: number) => formatQuantite(Math.round(n * 1000) / 1000, unite)

  return (
    <>
      <PageHeader
        titre="Capacités des producteurs"
        description="Stock disponible, production attendue d’ici la date (capacité de production, limitée par la matière première pour les produits transformés) et engagements déjà approuvés."
      />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <Select name="produit" defaultValue={produit?.id} aria-label="Produit" className="w-auto min-w-56">
          {(produits ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          au
          <Input type="date" name="date" min={aujourdhui} defaultValue={date} className="w-auto" />
        </label>
        <Button type="submit" variant="outline">
          Afficher
        </Button>
      </form>

      {lignes.length === 0 ? (
        <Vide titre="Aucun producteur pour ce produit">Aucune capacité, aucun stock ni aucune offre déclarés.</Vide>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-surface-muted text-left text-foreground-muted">
                <th className="px-4 py-2.5 font-medium">Producteur</th>
                <th className="px-4 py-2.5 text-right font-medium">Stock disponible</th>
                <th className="px-4 py-2.5 text-right font-medium">Production attendue</th>
                <th className="px-4 py-2.5 text-right font-medium">Disponible total</th>
                <th className="px-4 py-2.5 text-right font-medium">Engagé</th>
                <th className="px-4 py-2.5 text-right font-medium">Marge</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-surface-border">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{l.denomination}</span>
                    {l.region && <span className="block text-xs text-foreground-muted">{l.region}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{q(l.analyse.stock_disponible)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {q(l.analyse.production_attendue)}
                    {l.analyse.transforme && (
                      <span className="block text-xs text-foreground-muted">
                        matière : {q(l.analyse.potentiel_matiere)} · capacité : {q(l.analyse.capacite_periode)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{q(l.analyse.disponible_total)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{q(l.analyse.engage)}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', l.analyse.marge < 0 ? 'text-danger' : 'text-success')}>
                    {q(l.analyse.marge)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
