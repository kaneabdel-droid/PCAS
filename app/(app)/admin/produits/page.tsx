import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import {
  creerProduit,
  enregistrerTransformation,
  modifierProduit,
  supprimerTransformation,
} from '@/app/(app)/admin/produits/actions'
import { CATEGORIES_PRODUIT, NATURES_PRODUIT, UNITES } from '@/lib/referentiels'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Catalogue produits' }

type Produit = {
  id: string
  nom: string
  categorie: string
  nature: 'matiere_premiere' | 'produit_fini'
  unite: string
  description: string | null
  actif: boolean
}
type Transformation = {
  id: string
  rendement: number
  matiere: { nom: string; unite: string } | null
  produit: { nom: string; unite: string } | null
}

function ChampsProduit({ produit }: { produit?: Produit }) {
  const suffixe = produit?.id ?? 'nouveau'
  return (
    <GrilleChamps>
      <Champ id={`nom-${suffixe}`} label="Nom" requis>
        <Input id={`nom-${suffixe}`} name="nom" required defaultValue={produit?.nom} />
      </Champ>
      <Champ id={`categorie-${suffixe}`} label="Catégorie" requis>
        <Select id={`categorie-${suffixe}`} name="categorie" required defaultValue={produit?.categorie ?? ''}>
          <option value="" disabled>
            Choisir…
          </option>
          {CATEGORIES_PRODUIT.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Champ>
      <Champ id={`nature-${suffixe}`} label="Nature" requis aide="La matière première est masquée aux clients.">
        <Select id={`nature-${suffixe}`} name="nature" required defaultValue={produit?.nature ?? 'produit_fini'}>
          {Object.entries(NATURES_PRODUIT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </Select>
      </Champ>
      <Champ id={`unite-${suffixe}`} label="Unité de vente" requis>
        <Select id={`unite-${suffixe}`} name="unite" required defaultValue={produit?.unite ?? 'kg'}>
          {UNITES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </Select>
      </Champ>
      <Champ id={`description-${suffixe}`} label="Description" className="sm:col-span-2">
        <Textarea id={`description-${suffixe}`} name="description" rows={2} defaultValue={produit?.description ?? ''} />
      </Champ>
    </GrilleChamps>
  )
}

export default async function ProduitsPage() {
  const supabase = await createClient()
  const [{ data: produitsData }, { data: transformationsData }] = await Promise.all([
    supabase.from('produits').select('id, nom, categorie, nature, unite, description, actif').order('categorie').order('nom').returns<Produit[]>(),
    supabase
      .from('transformations')
      .select('id, rendement, matiere:produits!transformations_matiere_id_fkey(nom, unite), produit:produits!transformations_produit_id_fkey(nom, unite)')
      .returns<Transformation[]>(),
  ])
  const produits = produitsData ?? []
  const transformations = transformationsData ?? []
  const categories = [...new Set(produits.map((p) => p.categorie))]
  const matieres = produits.filter((p) => p.nature === 'matiere_premiere' && p.actif)
  const finis = produits.filter((p) => p.nature === 'produit_fini' && p.actif)

  return (
    <>
      <PageHeader
        titre="Catalogue produits"
        description="Produits proposés sur la plateforme. Les producteurs publient leurs offres à partir de ce catalogue."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {categories.map((categorie) => (
            <section key={categorie}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">{categorie}</h2>
              <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
                {produits
                  .filter((p) => p.categorie === categorie)
                  .map((p) => (
                    <li key={p.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                          <span className="flex-1 font-medium">{p.nom}</span>
                          <span className="text-sm text-foreground-muted">{p.unite}</span>
                          <Badge ton={p.nature === 'matiere_premiere' ? 'alerte' : 'primaire'}>{NATURES_PRODUIT[p.nature]}</Badge>
                          {!p.actif && <Badge ton="danger">Inactif</Badge>}
                        </summary>
                        <div className="border-t border-surface-border bg-surface-muted/50 p-4">
                          <FormulaireAction action={modifierProduit} libelle="Enregistrer">
                            <input type="hidden" name="produit_id" value={p.id} />
                            <ChampsProduit produit={p} />
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" name="actif" defaultChecked={p.actif} className="h-4 w-4 accent-primary" /> Produit
                              actif (proposé aux producteurs)
                            </label>
                          </FormulaireAction>
                        </div>
                      </details>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-heading font-semibold">Ajouter un produit</h2>
            <FormulaireAction action={creerProduit} libelle="Ajouter au catalogue" reinitialiser>
              <ChampsProduit />
            </FormulaireAction>
          </Card>

          <Card>
            <h2 className="font-heading font-semibold">Rendements de transformation</h2>
            <p className="mb-4 mt-1 text-sm text-foreground-muted">
              Quantité de produit fini (dans son unité) obtenue par unité de matière première (dans son unité). Sert à estimer la production attendue d’un
              producteur à partir de son stock de matière première.
            </p>
            <ul className="mb-4 space-y-2">
              {transformations.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                  <span className="flex flex-wrap items-center gap-1">
                    {t.matiere?.nom} <ArrowRight className="h-3.5 w-3.5 text-foreground-muted" aria-hidden /> {t.produit?.nom}
                    <strong className="ml-1 tabular-nums">
                      1 {t.matiere?.unite} → {Number(t.rendement).toLocaleString('fr-FR')} {t.produit?.unite}
                    </strong>
                  </span>
                  <FormulaireAction action={supprimerTransformation} libelle="Retirer" variante="ghost" boutonClassName="h-7 px-2 text-xs text-danger">
                    <input type="hidden" name="transformation_id" value={t.id} />
                  </FormulaireAction>
                </li>
              ))}
            </ul>
            <FormulaireAction action={enregistrerTransformation} libelle="Enregistrer le rendement" variante="outline" reinitialiser>
              <Champ id="matiere_id" label="Matière première" requis>
                <Select id="matiere_id" name="matiere_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {matieres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom} ({m.unite})
                    </option>
                  ))}
                </Select>
              </Champ>
              <Champ id="produit_id" label="Produit fini" requis>
                <Select id="produit_id" name="produit_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {finis.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom} ({m.unite})
                    </option>
                  ))}
                </Select>
              </Champ>
              <Champ id="rendement" label="Rendement" requis aide="Ex. 1 tonne de paddy donne 13 sacs de 50 kg de riz blanchi : saisir 13.">
                <Input id="rendement" name="rendement" required inputMode="decimal" placeholder="13" />
              </Champ>
            </FormulaireAction>
          </Card>
        </div>
      </div>
    </>
  )
}
