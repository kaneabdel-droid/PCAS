import Link from 'next/link'
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, Factory, RefreshCw } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { FormTransformation } from '@/components/stocks/FormTransformation'
import { Button } from '@/components/ui/button'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { enregistrerInventaire, enregistrerMouvement } from '@/app/(app)/stocks/actions'
import { droitsEcran } from '@/lib/droits'
import { MOTIFS, MOTIFS_SAISIE, TYPES_MOUVEMENT, formatQuantite, type Nature } from '@/lib/stocks'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

type LigneStock = {
  site_id: string
  produit_id: string
  quantite_physique: number
  quantite_reservee: number
  quantite_disponible: number
  updated_at: string
  sites_production: { nom: string } | null
  produits: { nom: string; unite: string }
  entreprises: { denomination: string } | null
}

type Mouvement = {
  id: string
  type: string
  motif: string
  quantite: number
  date_mouvement: string
  commentaire: string | null
  produits: { nom: string; unite: string }
  sites_production: { nom: string } | null
  entreprises: { denomination: string } | null
}

export type FiltresStocks = { entreprise?: string; produit?: string; site?: string; du?: string; au?: string }

const TONS: Record<string, 'succes' | 'danger' | 'info' | 'alerte' | 'neutre'> = {
  entree: 'succes',
  sortie: 'danger',
  ajustement: 'info',
  reservation: 'alerte',
  liberation: 'neutre',
}

/**
 * Écran de stock (matière première ou produits finis). Le producteur voit et saisit son stock ; la plateforme
 * (administrateur, superviseur) consulte le stock de tous les producteurs. Les clients n'y ont jamais accès.
 */
export async function PageStocks({
  nature,
  href,
  titre,
  description,
  filtres,
}: {
  nature: Nature
  href: string
  titre: string
  description: string
  filtres: FiltresStocks
}) {
  const { ctx, ecrire, modifier } = await droitsEcran(href, ['producteur', 'administrateur', 'superviseur'])
  const producteur = ctx.role === 'producteur'
  const supabase = await createClient()
  const aujourdhui = new Date().toISOString().slice(0, 10)

  let requeteStocks = supabase
    .from('stocks')
    .select('site_id, produit_id, quantite_physique, quantite_reservee, quantite_disponible, updated_at, sites_production(nom), produits!inner(nom, unite), entreprises(denomination)')
    .eq('produits.nature', nature)
    .order('updated_at', { ascending: false })
  let requeteMouvements = supabase
    .from('mouvements_stock')
    .select('id, type, motif, quantite, date_mouvement, commentaire, produits!inner(nom, unite), sites_production(nom), entreprises(denomination)')
    .eq('produits.nature', nature)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!producteur && filtres.entreprise) {
    requeteStocks = requeteStocks.eq('entreprise_id', filtres.entreprise)
    requeteMouvements = requeteMouvements.eq('entreprise_id', filtres.entreprise)
  }
  if (filtres.produit) requeteMouvements = requeteMouvements.eq('produit_id', filtres.produit)
  if (filtres.site) requeteMouvements = requeteMouvements.eq('site_id', filtres.site)
  if (filtres.du) requeteMouvements = requeteMouvements.gte('date_mouvement', filtres.du)
  if (filtres.au) requeteMouvements = requeteMouvements.lte('date_mouvement', filtres.au)

  const [{ data: stocksData }, { data: mouvementsData }, { data: sitesData }, { data: produitsData }, { data: producteursData }, { data: rendementsData }, { data: finisData }] =
    await Promise.all([
      requeteStocks.returns<LigneStock[]>(),
      requeteMouvements.returns<Mouvement[]>(),
      supabase.from('sites_production').select('id, nom, actif').order('nom'),
      supabase.from('produits').select('id, nom, unite').eq('nature', nature).eq('actif', true).order('nom'),
      producteur
        ? Promise.resolve({ data: [] as { id: string; denomination: string }[] })
        : supabase.from('entreprises').select('id, denomination').eq('type', 'producteur').order('denomination'),
      nature === 'matiere_premiere'
        ? supabase.from('transformations').select('matiere_id, produit_id, rendement')
        : Promise.resolve({ data: [] as { matiere_id: string; produit_id: string; rendement: number }[] }),
      nature === 'matiere_premiere'
        ? supabase.from('produits').select('id, nom, unite').eq('nature', 'produit_fini').eq('actif', true).order('nom')
        : Promise.resolve({ data: [] as { id: string; nom: string; unite: string }[] }),
    ])
  const stocks = stocksData ?? []
  const mouvements = mouvementsData ?? []
  const produits = produitsData ?? []
  const sitesActifs = producteur ? (sitesData ?? []).filter((s) => s.actif) : []
  const peutSaisir = producteur && ecrire && sitesActifs.length > 0

  // Totaux par produit, tous sites confondus
  const totaux = new Map<string, { nom: string; unite: string; physique: number; reserve: number; disponible: number }>()
  for (const s of stocks) {
    const t = totaux.get(s.produit_id) ?? { nom: s.produits.nom, unite: s.produits.unite, physique: 0, reserve: 0, disponible: 0 }
    t.physique += Number(s.quantite_physique)
    t.reserve += Number(s.quantite_reservee)
    t.disponible += Number(s.quantite_disponible)
    totaux.set(s.produit_id, t)
  }

  const champsCommuns = (prefixe: string) => (
    <>
      <Champ id={`${prefixe}-site`} label="Site" requis>
        <Select id={`${prefixe}-site`} name="site_id" required defaultValue={sitesActifs.length === 1 ? sitesActifs[0].id : ''}>
          <option value="" disabled>
            Choisir…
          </option>
          {sitesActifs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </Select>
      </Champ>
      <Champ id={`${prefixe}-produit`} label="Produit" requis>
        <Select id={`${prefixe}-produit`} name="produit_id" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {produits.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom} ({p.unite})
            </option>
          ))}
        </Select>
      </Champ>
    </>
  )

  return (
    <>
      <PageHeader titre={titre} description={description} />

      {!producteur && (
        <form method="get" className="mb-6 flex flex-wrap gap-3">
          <Select name="entreprise" defaultValue={filtres.entreprise ?? ''} aria-label="Producteur" className="w-auto min-w-64">
            <option value="">Tous les producteurs</option>
            {(producteursData ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.denomination}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline">
            Afficher
          </Button>
        </form>
      )}

      {producteur && sitesActifs.length === 0 && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          Déclarez d’abord un site de production actif dans{' '}
          <Link href="/entreprise?onglet=sites" className="font-medium text-primary hover:underline">
            Fiche entreprise › Sites de production
          </Link>
          .
        </p>
      )}

      {totaux.size > 0 && (
        <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[...totaux.entries()].map(([id, t]) => (
            <li key={id}>
              <Card className="sm:p-5">
                <p className="text-sm text-foreground-muted">{t.nom}</p>
                <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{formatQuantite(t.disponible, t.unite)}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  disponible · physique {formatQuantite(t.physique)}
                  {t.reserve > 0 ? ` · réservé ${formatQuantite(t.reserve)}` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">Stock par site</h2>
        {stocks.length === 0 ? (
          <Vide titre="Aucun stock enregistré">{peutSaisir ? 'Enregistrez une première entrée ci-dessous.' : undefined}</Vide>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-surface-muted text-left text-foreground-muted">
                  {!producteur && <th className="px-4 py-2.5 font-medium">Producteur</th>}
                  <th className="px-4 py-2.5 font-medium">Site</th>
                  <th className="px-4 py-2.5 font-medium">Produit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Physique</th>
                  <th className="px-4 py-2.5 text-right font-medium">Réservé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Disponible</th>
                  <th className="px-4 py-2.5 font-medium">Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={`${s.site_id}-${s.produit_id}`} className="border-t border-surface-border">
                    {!producteur && <td className="px-4 py-2.5">{s.entreprises?.denomination}</td>}
                    <td className="px-4 py-2.5">{s.sites_production?.nom}</td>
                    <td className="px-4 py-2.5 font-medium">{s.produits.nom}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatQuantite(s.quantite_physique, s.produits.unite)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground-muted">{formatQuantite(s.quantite_reservee)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatQuantite(s.quantite_disponible)}</td>
                    <td className="px-4 py-2.5 text-foreground-muted">{formatDate(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {peutSaisir && (
        <section className="no-print mb-8 grid gap-6 lg:grid-cols-2">
          {(['entree', 'sortie'] as const).map((type) => (
            <Card key={type}>
              <h2 className="mb-4 flex items-center gap-2 font-heading font-semibold">
                {type === 'entree' ? (
                  <ArrowDownToLine className="h-5 w-5 text-success" aria-hidden />
                ) : (
                  <ArrowUpFromLine className="h-5 w-5 text-danger" aria-hidden />
                )}
                {type === 'entree' ? 'Entrée en stock' : 'Sortie de stock'}
              </h2>
              <FormulaireAction action={enregistrerMouvement} libelle={type === 'entree' ? 'Enregistrer l’entrée' : 'Enregistrer la sortie'} reinitialiser>
                <input type="hidden" name="type" value={type} />
                <GrilleChamps>
                  {champsCommuns(type)}
                  <Champ id={`${type}-quantite`} label="Quantité" requis>
                    <Input id={`${type}-quantite`} name="quantite" required inputMode="decimal" />
                  </Champ>
                  <Champ id={`${type}-motif`} label="Motif" requis>
                    <Select id={`${type}-motif`} name="motif" required defaultValue={MOTIFS_SAISIE[type][nature][0]}>
                      {MOTIFS_SAISIE[type][nature].map((m) => (
                        <option key={m} value={m}>
                          {MOTIFS[m]}
                        </option>
                      ))}
                    </Select>
                  </Champ>
                  <Champ id={`${type}-date`} label="Date">
                    <Input id={`${type}-date`} name="date_mouvement" type="date" max={aujourdhui} defaultValue={aujourdhui} />
                  </Champ>
                  <Champ id={`${type}-commentaire`} label="Commentaire">
                    <Input id={`${type}-commentaire`} name="commentaire" maxLength={500} />
                  </Champ>
                </GrilleChamps>
              </FormulaireAction>
            </Card>
          ))}

          {modifier && (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                <ClipboardCheck className="h-5 w-5 text-info" aria-hidden /> Inventaire
              </h2>
              <p className="mb-4 text-sm text-foreground-muted">La quantité comptée remplace le stock physique ; l’écart est enregistré.</p>
              <FormulaireAction action={enregistrerInventaire} libelle="Enregistrer l’inventaire" reinitialiser>
                <GrilleChamps>
                  {champsCommuns('inventaire')}
                  <Champ id="inventaire-quantite" label="Quantité comptée" requis>
                    <Input id="inventaire-quantite" name="quantite_comptee" required inputMode="decimal" />
                  </Champ>
                  <Champ id="inventaire-commentaire" label="Commentaire">
                    <Input id="inventaire-commentaire" name="commentaire" maxLength={500} />
                  </Champ>
                </GrilleChamps>
              </FormulaireAction>
            </Card>
          )}

          {nature === 'matiere_premiere' && (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                <Factory className="h-5 w-5 text-accent" aria-hidden /> Transformation
              </h2>
              <p className="mb-4 text-sm text-foreground-muted">
                Sortie de matière première et entrée du produit fini obtenu, en une seule opération.
              </p>
              <FormTransformation
                sites={sitesActifs}
                matieres={produits}
                produits={finisData ?? []}
                rendements={(rendementsData ?? []).map((r) => ({ ...r, rendement: Number(r.rendement) }))}
                aujourdhui={aujourdhui}
              />
            </Card>
          )}
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            <RefreshCw className="h-4 w-4" aria-hidden /> Mouvements
          </h2>
          <form method="get" className="flex flex-wrap items-center gap-2">
            {filtres.entreprise && <input type="hidden" name="entreprise" value={filtres.entreprise} />}
            <Select name="produit" defaultValue={filtres.produit ?? ''} aria-label="Produit" className="h-9 w-auto">
              <option value="">Tous produits</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </Select>
            <Input type="date" name="du" defaultValue={filtres.du} aria-label="Du" className="h-9 w-auto" />
            <Input type="date" name="au" defaultValue={filtres.au} aria-label="Au" className="h-9 w-auto" />
            <Button type="submit" variant="outline" size="sm" className="h-9">
              Filtrer
            </Button>
          </form>
        </div>
        {mouvements.length === 0 ? (
          <Vide titre="Aucun mouvement" />
        ) : (
          <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
            {mouvements.map((m) => {
              const signe = m.type === 'sortie' || (m.type === 'ajustement' && Number(m.quantite) < 0) ? '−' : '+'
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="w-24 tabular-nums text-foreground-muted">{formatDate(m.date_mouvement)}</span>
                  <Badge ton={TONS[m.type]}>{TYPES_MOUVEMENT[m.type]}</Badge>
                  <span className="font-medium">{m.produits.nom}</span>
                  <span className="text-foreground-muted">
                    {m.sites_production?.nom}
                    {!producteur && m.entreprises ? ` · ${m.entreprises.denomination}` : ''} · {MOTIFS[m.motif]}
                    {m.commentaire ? ` · ${m.commentaire}` : ''}
                  </span>
                  <span className={`ml-auto font-semibold tabular-nums ${signe === '+' ? 'text-success' : 'text-danger'}`}>
                    {signe}
                    {formatQuantite(Math.abs(Number(m.quantite)), m.produits.unite)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
