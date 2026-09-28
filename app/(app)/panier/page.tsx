import type { Metadata } from 'next'
import Link from 'next/link'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsCommande } from '@/components/commandes/ChampsCommande'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Button } from '@/components/ui/button'
import { Card, PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { commanderProducteur, retirerDuPanier } from '@/app/(app)/marche/actions'
import { exigerLecture } from '@/lib/droits'
import { contexteCommande, type OffreMarche } from '@/lib/marche'
import { formatQuantite } from '@/lib/stocks'
import { formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Panier' }

/** Panier du client : une commande par producteur, chacune avec ses conditions de livraison et de paiement. */
export default async function PanierPage() {
  const ctx = await exigerLecture('/panier', ['client'])
  const supabase = await createClient()
  const { data: lignes } = await supabase.from('paniers').select('offre_id, quantite').order('ajoute_le')
  const ids = (lignes ?? []).map((l) => l.offre_id)
  const [{ data: offresData }, conditions] = await Promise.all([
    ids.length
      ? supabase.rpc('marche_offres').select('*').in('id', ids)
      : Promise.resolve({ data: [] }),
    contexteCommande(ctx.entrepriseId!),
  ])
  const offres = new Map(((offresData ?? []) as unknown as OffreMarche[]).map((o) => [o.id, o]))
  const indisponibles = (lignes ?? []).filter((l) => !offres.has(l.offre_id))

  const groupes = new Map<string, { nom: string; logo: string | null; lignes: { offre: OffreMarche; quantite: number; montant: number; erreur?: string }[] }>()
  for (const l of lignes ?? []) {
    const offre = offres.get(l.offre_id)
    if (!offre) continue
    const quantite = Number(l.quantite)
    const erreur =
      quantite > Number(offre.quantite_commandable)
        ? `Seulement ${formatQuantite(offre.quantite_commandable, offre.unite)} disponibles`
        : offre.quantite_min_commande && quantite < Number(offre.quantite_min_commande)
          ? `Minimum ${formatQuantite(offre.quantite_min_commande, offre.unite)}`
          : undefined
    const groupe = groupes.get(offre.producteur_id) ?? { nom: offre.producteur_nom, logo: offre.producteur_logo, lignes: [] }
    groupe.lignes.push({ offre, quantite, montant: Math.round(quantite * offre.prix_unitaire), erreur })
    groupes.set(offre.producteur_id, groupe)
  }
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader titre="Panier" description="Une commande est émise par producteur. Elle sera soumise au superviseur, qui fixe la date de livraison convenue.">
        <Button asChild variant="outline">
          <Link href="/marche">Continuer mes achats</Link>
        </Button>
      </PageHeader>

      {indisponibles.length > 0 && (
        <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{indisponibles.length} article(s) ne sont plus disponibles et ont été écartés.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {indisponibles.map((l) => (
              <FormulaireAction key={l.offre_id} action={retirerDuPanier} libelle="Retirer l’article indisponible" variante="outline" boutonClassName="h-8 px-3 text-xs">
                <input type="hidden" name="offre_id" value={l.offre_id} />
              </FormulaireAction>
            ))}
          </div>
        </div>
      )}

      {groupes.size === 0 ? (
        <Vide titre="Votre panier est vide">
          <Link href="/marche" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <ShoppingCart className="h-4 w-4" aria-hidden /> Parcourir les offres des producteurs
          </Link>
        </Vide>
      ) : (
        <div className="space-y-8">
          {[...groupes.entries()].map(([producteurId, g]) => {
            const total = g.lignes.reduce((s, l) => s + l.montant, 0)
            const bloque = g.lignes.some((l) => l.erreur)
            return (
              <section key={producteurId} className="grid gap-6 xl:grid-cols-[1fr_28rem]">
                <Card className="self-start">
                  <div className="mb-4 flex items-center gap-3">
                    <LogoEntreprise chemin={g.logo} denomination={g.nom} taille={40} />
                    <h2 className="font-heading text-lg font-semibold">{g.nom}</h2>
                  </div>
                  <ul className="divide-y divide-surface-border">
                    {g.lignes.map((l) => (
                      <li key={l.offre.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/marche/${l.offre.id}`} className="font-medium hover:text-primary hover:underline">
                            {l.offre.produit_nom}
                          </Link>
                          <p className="text-sm text-foreground-muted">
                            {formatQuantite(l.quantite, l.offre.unite)} × {formatMontant(l.offre.prix_unitaire)}
                            {l.offre.disponibilite !== 'immediate' && ' · offre à date'}
                          </p>
                          {l.erreur && <p className="text-sm text-danger">{l.erreur} : modifiez la quantité depuis l’offre.</p>}
                        </div>
                        <span className="font-semibold tabular-nums">{formatMontant(l.montant)}</span>
                        <FormulaireAction action={retirerDuPanier} libelle="Retirer" variante="ghost" boutonClassName="h-8 px-2 text-xs text-danger">
                          <input type="hidden" name="offre_id" value={l.offre.id} />
                        </FormulaireAction>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex justify-between border-t border-surface-border pt-4 font-heading text-lg font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMontant(total)}</span>
                  </p>
                </Card>

                <Card>
                  <h3 className="mb-4 font-heading font-semibold">Conditions de la commande</h3>
                  {bloque ? (
                    <p className="flex items-center gap-2 text-sm text-danger">
                      <Trash2 className="h-4 w-4" aria-hidden /> Corrigez les quantités signalées avant de commander.
                    </p>
                  ) : (
                    <FormulaireAction action={commanderProducteur} libelle={`Commander chez ${g.nom}`} enCoursLibelle="Envoi de la commande…" boutonClassName="w-full">
                      <input type="hidden" name="producteur_id" value={producteurId} />
                      <ChampsCommande
                        prefixe={producteurId}
                        adresseParDefaut={conditions.adresse}
                        regionParDefaut={conditions.region}
                        banques={conditions.banques}
                        montant={total}
                        aujourdhui={aujourdhui}
                      />
                    </FormulaireAction>
                  )}
                </Card>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
