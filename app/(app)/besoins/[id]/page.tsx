import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, HandCoins } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsCommande } from '@/components/commandes/ChampsCommande'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import { changerStatutBesoin, proposer, retenirProposition, retirerProposition } from '@/app/(app)/besoins/actions'
import { STATUTS_BESOIN, STATUTS_PROPOSITION } from '@/lib/commandes'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { contexteCommande } from '@/lib/marche'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Besoin d’achat' }

type Besoin = {
  id: string
  numero: string
  produit_id: string
  quantite: number
  prix_cible: number | null
  date_souhaitee: string
  region_livraison: string | null
  lieu_livraison?: string | null
  commentaire: string | null
  statut?: string
  created_at: string
  produit_nom?: string
  unite?: string
  produits?: { nom: string; unite: string } | null
}

type Proposition = {
  id: string
  producteur_id: string
  quantite: number
  prix_unitaire: number
  date_disponibilite: string | null
  commentaire: string | null
  statut: string
  created_at: string
}

export default async function BesoinPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/besoins', ['client', 'producteur', 'administrateur', 'superviseur'])
  const { id } = await params
  const supabase = await createClient()
  const producteur = ctx.role === 'producteur'

  // Le producteur ne lit le besoin qu'à travers besoins_publics() : jamais l'identité du client.
  const { data: donneesBesoin } = producteur
    ? await supabase.rpc('besoins_publics').select('*').eq('id', id).maybeSingle()
    : await supabase
        .from('besoins_achat')
        .select('id, numero, produit_id, quantite, prix_cible, date_souhaitee, region_livraison, lieu_livraison, commentaire, statut, created_at, produits(nom, unite)')
        .eq('id', id)
        .maybeSingle()
  const besoin = donneesBesoin as unknown as Besoin | null
  if (!besoin) notFound()
  const produitNom = besoin.produit_nom ?? besoin.produits?.nom
  const unite = besoin.unite ?? besoin.produits?.unite ?? ''
  const statut = besoin.statut ? STATUTS_BESOIN[besoin.statut] : STATUTS_BESOIN.ouvert
  const ouvert = !besoin.statut || ['ouvert', 'en_traitement'].includes(besoin.statut)

  const [{ data: propositionsData }, { data: producteursData }] = await Promise.all([
    supabase
      .from('propositions_besoin')
      .select('id, producteur_id, quantite, prix_unitaire, date_disponibilite, commentaire, statut, created_at')
      .eq('besoin_id', id)
      .order('prix_unitaire')
      .returns<Proposition[]>(),
    supabase.rpc('producteurs_publics').select('id, denomination, region, logo_path'),
  ])
  const propositions = propositionsData ?? []
  const producteurs = new Map(((producteursData ?? []) as { id: string; denomination: string; region: string | null; logo_path: string | null }[]).map((p) => [p.id, p]))
  const aujourdhui = new Date().toISOString().slice(0, 10)

  const droitsClient = await droitsEcran('/commandes', ['client'])
  const droitsBesoin = await droitsEcran('/besoins', ['client', 'producteur'])
  const peutRetenir = ctx.role === 'client' && droitsClient.ecrire && ouvert
  const conditions = peutRetenir ? await contexteCommande(ctx.entrepriseId!) : null

  // Formulaire de proposition (producteur) : ses sites actifs et ses offres de ce produit
  const [sites, offres] = producteur
    ? await Promise.all([
        supabase.from('sites_production').select('id, nom').eq('actif', true).order('nom').then((r) => r.data ?? []),
        supabase.from('offres').select('id, prix_unitaire, date_disponibilite, statut').eq('produit_id', besoin.produit_id).in('statut', ['publiee', 'brouillon']).then((r) => r.data ?? []),
      ])
    : [[], []]

  return (
    <>
      <Link href="/besoins" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Besoins d’achat
      </Link>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">
              {produitNom} · {formatQuantite(besoin.quantite, unite)}
            </h1>
            <Badge ton={statut.ton}>{statut.libelle}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            <span className="font-mono">{besoin.numero}</span> · publié le {formatDate(besoin.created_at)} · pour le{' '}
            {formatDate(besoin.date_souhaitee)}
            {besoin.region_livraison ? ` · ${besoin.region_livraison}` : ''}
            {besoin.lieu_livraison ? ` (${besoin.lieu_livraison})` : ''}
            {besoin.prix_cible ? ` · prix cible ${formatMontant(besoin.prix_cible)}/${unite}` : ''}
          </p>
        </div>
        {ctx.role === 'client' && ouvert && droitsBesoin.modifier && (
          <div className="flex gap-2">
            <FormulaireAction action={changerStatutBesoin} libelle="Clore" variante="outline" confirmation="Clore ce besoin ? Il ne recevra plus de propositions.">
              <input type="hidden" name="besoin_id" value={besoin.id} />
              <input type="hidden" name="statut" value="clos" />
            </FormulaireAction>
            <FormulaireAction action={changerStatutBesoin} libelle="Annuler" variante="ghost" boutonClassName="text-danger" confirmation="Annuler ce besoin ?">
              <input type="hidden" name="besoin_id" value={besoin.id} />
              <input type="hidden" name="statut" value="annule" />
            </FormulaireAction>
          </div>
        )}
      </div>
      {besoin.commentaire && <p className="mb-6 whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{besoin.commentaire}</p>}

      <div className={producteur ? 'grid gap-6 xl:grid-cols-[1fr_24rem]' : ''}>
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
            <HandCoins className="h-5 w-5 text-primary" aria-hidden /> {producteur ? 'Mes propositions' : `Propositions reçues (${propositions.length})`}
          </h2>
          {propositions.length === 0 ? (
            <Vide titre="Aucune proposition pour le moment" />
          ) : (
            <ul className="space-y-4">
              {propositions.map((p) => {
                const prod = producteurs.get(p.producteur_id)
                const st = STATUTS_PROPOSITION[p.statut]
                const montant = Math.round(Number(p.quantite) * p.prix_unitaire)
                return (
                  <li key={p.id}>
                    <Card className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {!producteur && <LogoEntreprise chemin={prod?.logo_path ?? null} denomination={prod?.denomination ?? ''} taille={40} />}
                          <div>
                            {!producteur && <p className="font-semibold">{prod?.denomination ?? 'Producteur'}</p>}
                            <p className="text-sm text-foreground-muted">
                              {formatQuantite(p.quantite, unite)} à {formatMontant(p.prix_unitaire)}/{unite} ·{' '}
                              {p.date_disponibilite ? `disponible le ${formatDate(p.date_disponibilite)}` : 'disponible maintenant'}
                              {prod?.region && !producteur ? ` · ${prod.region}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-semibold tabular-nums">{formatMontant(montant)}</span>
                          <Badge ton={st.ton}>{st.libelle}</Badge>
                        </div>
                      </div>
                      {p.commentaire && <p className="whitespace-pre-line text-sm">{p.commentaire}</p>}

                      {producteur && p.statut === 'proposee' && droitsBesoin.modifier && (
                        <FormulaireAction action={retirerProposition} libelle="Retirer ma proposition" variante="ghost" boutonClassName="text-danger" confirmation="Retirer cette proposition ?">
                          <input type="hidden" name="proposition_id" value={p.id} />
                          <input type="hidden" name="besoin_id" value={besoin.id} />
                        </FormulaireAction>
                      )}

                      {peutRetenir && p.statut === 'proposee' && conditions && (
                        <details className="rounded-lg border border-surface-border">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">Retenir cette proposition et commander</summary>
                          <div className="border-t border-surface-border p-3">
                            <FormulaireAction action={retenirProposition} libelle="Commander" enCoursLibelle="Envoi de la commande…">
                              <input type="hidden" name="proposition_id" value={p.id} />
                              <input type="hidden" name="besoin_id" value={besoin.id} />
                              <Champ id={`q-${p.id}`} label={`Quantité retenue (${unite})`} requis className="max-w-xs">
                                <Input id={`q-${p.id}`} name="quantite" required inputMode="decimal" defaultValue={Number(p.quantite)} />
                              </Champ>
                              <ChampsCommande
                                prefixe={p.id}
                                adresseParDefaut={conditions.adresse}
                                regionParDefaut={besoin.region_livraison ?? conditions.region}
                                banques={conditions.banques}
                                montant={montant}
                                aujourdhui={aujourdhui}
                              />
                            </FormulaireAction>
                          </div>
                        </details>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {producteur && (
          <Card className="self-start">
            <h2 className="mb-1 font-heading font-semibold">Faire une proposition</h2>
            <p className="mb-4 text-sm text-foreground-muted">Le client voit votre nom, votre prix et votre disponibilité. Il choisit librement.</p>
            {!droitsBesoin.ecrire ? (
              <p className="text-sm text-foreground-muted">Votre profil ne permet pas de faire de proposition.</p>
            ) : sites.length === 0 ? (
              <p className="text-sm">
                Déclarez d’abord un site de production dans{' '}
                <Link href="/entreprise?onglet=sites" className="font-medium text-primary hover:underline">
                  votre fiche entreprise
                </Link>
                .
              </p>
            ) : (
              <FormulaireAction action={proposer} libelle="Envoyer la proposition" reinitialiser>
                <input type="hidden" name="besoin_id" value={besoin.id} />
                <GrilleChamps>
                  <Champ id="quantite" label={`Quantité (${unite})`} requis>
                    <Input id="quantite" name="quantite" required inputMode="decimal" defaultValue={Number(besoin.quantite)} />
                  </Champ>
                  <Champ id="prix_unitaire" label="Prix (FCFA / unité)" requis>
                    <Input id="prix_unitaire" name="prix_unitaire" required inputMode="numeric" defaultValue={besoin.prix_cible ?? ''} />
                  </Champ>
                  <Champ id="site_id" label="Site" requis>
                    <Select id="site_id" name="site_id" required defaultValue={sites.length === 1 ? sites[0].id : ''}>
                      <option value="" disabled>
                        Choisir…
                      </option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nom}
                        </option>
                      ))}
                    </Select>
                  </Champ>
                  <Champ id="date_disponibilite" label="Disponible le" aide="Vide : disponible maintenant.">
                    <Input id="date_disponibilite" name="date_disponibilite" type="date" min={aujourdhui} />
                  </Champ>
                  {offres.length > 0 && (
                    <Champ id="offre_id" label="Offre liée (facultatif)" className="sm:col-span-2">
                      <Select id="offre_id" name="offre_id" defaultValue="">
                        <option value="">Aucune</option>
                        {offres.map((o) => (
                          <option key={o.id} value={o.id}>
                            {formatMontant(o.prix_unitaire)} · {o.date_disponibilite ? `le ${formatDate(o.date_disponibilite)}` : 'immédiate'}
                            {o.statut === 'brouillon' ? ' (brouillon)' : ''}
                          </option>
                        ))}
                      </Select>
                    </Champ>
                  )}
                  <Champ id="commentaire" label="Message au client" className="sm:col-span-2">
                    <Textarea id="commentaire" name="commentaire" rows={3} maxLength={1000} />
                  </Champ>
                </GrilleChamps>
              </FormulaireAction>
            )}
          </Card>
        )}
      </div>
    </>
  )
}
