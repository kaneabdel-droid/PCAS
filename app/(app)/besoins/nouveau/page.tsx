import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import { creerBesoin } from '@/app/(app)/besoins/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { REGIONS } from '@/lib/referentiels'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Exprimer un besoin d’achat' }

export default async function NouveauBesoinPage({ searchParams }: { searchParams: Promise<{ producteur?: string }> }) {
  const ctx = await exigerLecture('/besoins', ['client'])
  const { ecrire } = await droitsEcran('/besoins', ['client'])
  if (!ecrire) notFound()
  const { producteur } = await searchParams
  const supabase = await createClient()
  const [{ data: produits }, { data: producteurs }, { data: entreprise }] = await Promise.all([
    supabase.from('produits').select('id, nom, unite').eq('nature', 'produit_fini').eq('actif', true).order('nom'),
    supabase.rpc('producteurs_publics').select('id, denomination, region').order('denomination'),
    supabase.from('entreprises').select('region, commune').eq('id', ctx.entrepriseId!).maybeSingle(),
  ])
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader
        titre="Exprimer un besoin d’achat"
        description="Votre besoin est publié aux producteurs sans votre nom ni vos coordonnées. Si vous choisissez un producteur, lui seul le verra."
      />
      <Card>
        <FormulaireAction action={creerBesoin} libelle="Publier le besoin">
          <GrilleChamps colonnes={3}>
            <Champ id="produit_id" label="Produit" requis>
              <Select id="produit_id" name="produit_id" required defaultValue="">
                <option value="" disabled>
                  Choisir…
                </option>
                {(produits ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} ({p.unite})
                  </option>
                ))}
              </Select>
            </Champ>
            <Champ id="quantite" label="Quantité (dans l’unité du produit)" requis>
              <Input id="quantite" name="quantite" required inputMode="decimal" />
            </Champ>
            <Champ id="prix_cible" label="Prix cible (FCFA par unité)" aide="Facultatif.">
              <Input id="prix_cible" name="prix_cible" inputMode="numeric" />
            </Champ>
            <Champ id="date_souhaitee" label="Date souhaitée" requis>
              <Input id="date_souhaitee" name="date_souhaitee" type="date" required min={aujourdhui} />
            </Champ>
            <Champ id="region_livraison" label="Région de livraison">
              <Select id="region_livraison" name="region_livraison" defaultValue={entreprise?.region ?? ''}>
                <option value="">—</option>
                {REGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Champ>
            <Champ id="lieu_livraison" label="Lieu de livraison" aide="Visible des producteurs : évitez d’y mettre votre nom.">
              <Input id="lieu_livraison" name="lieu_livraison" defaultValue={entreprise?.commune ?? ''} />
            </Champ>
            <Champ id="producteur_souhaite_id" label="Producteur souhaité" aide="Facultatif : sinon, tous les producteurs peuvent proposer." className="sm:col-span-2 lg:col-span-1">
              <Select id="producteur_souhaite_id" name="producteur_souhaite_id" defaultValue={producteur ?? ''}>
                <option value="">Tous les producteurs</option>
                {((producteurs ?? []) as { id: string; denomination: string; region: string | null }[]).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.denomination}
                    {p.region ? ` (${p.region})` : ''}
                  </option>
                ))}
              </Select>
            </Champ>
            <Champ id="commentaire" label="Précisions" className="sm:col-span-2" aide="Qualité, calibre, conditionnement… Visible des producteurs.">
              <Textarea id="commentaire" name="commentaire" rows={3} maxLength={1000} />
            </Champ>
          </GrilleChamps>
        </FormulaireAction>
      </Card>
    </>
  )
}
