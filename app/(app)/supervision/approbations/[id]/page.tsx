import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, GitFork, PauseCircle, XCircle } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Frise, type Evenement } from '@/components/commandes/Frise'
import { PanneauCapacite } from '@/components/supervision/PanneauCapacite'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input, Textarea } from '@/components/ui/input'
import { approuver, mettreEnAttente, refuser, repartir } from '@/app/(app)/supervision/actions'
import { MODES_PAIEMENT, STATUTS_COMMANDE } from '@/lib/commandes'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { STATUTS_A_TRAITER, analyser, dateAnalyse, type Alternative } from '@/lib/supervision'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Approbation' }

type Commande = {
  id: string
  numero: string
  statut: string
  producteur_id: string
  mode_paiement: string
  montant_total: number
  soumise_le: string
  date_souhaitee: string | null
  date_livraison_convenue: string | null
  adresse_livraison: string
  region_livraison: string | null
  commentaire: string | null
  motif: string | null
  entete_client: { denomination?: string; region?: string }
}

type Ligne = {
  id: string
  produit_id: string
  quantite: number
  prix_unitaire: number
  montant: number
  date_disponibilite: string | null
  produits: { nom: string; unite: string } | null
}

export default async function ApprobationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await exigerLecture('/supervision/approbations', ['superviseur', 'administrateur'])
  const { modifier } = await droitsEcran('/supervision/approbations', ['superviseur', 'administrateur'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data: c }, { data: lignesData }, { data: evenements }] = await Promise.all([
    supabase.from('commandes').select('*').eq('id', id).maybeSingle<Commande>(),
    supabase.from('lignes_commande').select('id, produit_id, quantite, prix_unitaire, montant, date_disponibilite, produits(nom, unite)').eq('commande_id', id).returns<Ligne[]>(),
    supabase.from('commande_evenements').select('id, horodatage, acteur_nom, acteur_role, action, commentaire').eq('commande_id', id).order('horodatage').returns<Evenement[]>(),
  ])
  if (!c) notFound()
  const lignes = lignesData ?? []
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const demandee = (await searchParams).date
  const date = demandee && demandee >= aujourdhui ? demandee : dateAnalyse(c.date_livraison_convenue, c.date_souhaitee)
  const aTraiter = STATUTS_A_TRAITER.includes(c.statut) && modifier
  const dateMin = lignes.reduce((m, l) => (l.date_disponibilite && l.date_disponibilite > m ? l.date_disponibilite : m), aujourdhui)

  const { data: producteur } = await supabase.from('entreprises').select('denomination, region').eq('id', c.producteur_id).maybeSingle()
  const analyses = await Promise.all(lignes.map((l) => analyser(c.producteur_id, l.produit_id, date, c.id)))
  const alternatives = await Promise.all(
    lignes.map(async (l) => {
      const { data } = await supabase.rpc('producteurs_alternatifs', { p_produit: l.produit_id, p_date: date, p_exclure_commande: c.id })
      return ((data ?? []) as unknown as Alternative[]).sort((a, b) => Number(b.marge ?? 0) - Number(a.marge ?? 0))
    })
  )
  const statut = STATUTS_COMMANDE[c.statut]

  return (
    <>
      <Link href="/supervision/approbations" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Approbations
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">Commande {c.numero}</h1>
            <Badge ton={statut.ton}>{statut.libelle}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {c.entete_client.denomination} → <strong>{producteur?.denomination}</strong>
            {producteur?.region ? ` (${producteur.region})` : ''} · {formatMontant(c.montant_total)} · {MODES_PAIEMENT[c.mode_paiement]}
          </p>
          <p className="text-sm text-foreground-muted">
            Émise le {formatDate(c.soumise_le)} · livraison souhaitée {c.date_souhaitee ? `le ${formatDate(c.date_souhaitee)}` : 'non précisée'} ·{' '}
            {c.adresse_livraison}
            {c.region_livraison ? `, ${c.region_livraison}` : ''}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/commandes/${c.id}`}>Fiche complète</Link>
        </Button>
      </div>
      {c.motif && <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><strong>Motif :</strong> {c.motif}</p>}
      {c.commentaire && <p className="mb-6 rounded-lg bg-surface-muted p-3 text-sm"><strong>Commentaire du client :</strong> {c.commentaire}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold">Analyse de capacité du producteur</h2>
              <form method="get" className="flex items-end gap-2">
                <Champ id="date" label="À la date du">
                  <Input id="date" name="date" type="date" min={aujourdhui} defaultValue={date} className="h-9" />
                </Champ>
                <Button type="submit" variant="outline" size="sm" className="h-9">
                  Recalculer
                </Button>
              </form>
            </div>
            <div className="space-y-4">
              {lignes.map((l, i) => {
                const a = analyses[i]
                const unite = l.produits?.unite ?? ''
                return a ? (
                  <PanneauCapacite
                    key={l.id}
                    titre={`${l.produits?.nom} · ${formatQuantite(l.quantite, unite)} à ${formatMontant(l.prix_unitaire)}/${unite}${l.date_disponibilite ? ` · offre à date du ${formatDate(l.date_disponibilite)}` : ''}`}
                    analyse={a}
                    quantite={Number(l.quantite)}
                    unite={unite}
                    date={date}
                  />
                ) : null
              })}
            </div>
          </Card>

          {aTraiter && (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
                <GitFork className="h-5 w-5 text-accent" aria-hidden /> Réorienter ou répartir
              </h2>
              <p className="mb-4 text-sm text-foreground-muted">
                Affectez chaque ligne à un ou plusieurs producteurs (offres publiées, au prix de chaque offre). Une nouvelle commande
                « soumise » est créée par producteur, avec les mêmes conditions de livraison et de paiement ; elle sera à approuver
                ici. La commande d’origine est close. Le total affecté de chaque ligne doit égaler la quantité commandée.
              </p>
              <FormulaireAction action={repartir} libelle="Créer les commandes" confirmation="Réorienter / répartir cette commande ? La commande d’origine sera close.">
                <input type="hidden" name="commande_id" value={c.id} />
                {lignes.map((l, i) => {
                  const unite = l.produits?.unite ?? ''
                  return (
                    <fieldset key={l.id} className="space-y-2 rounded-lg border border-surface-border p-3">
                      <legend className="px-1 text-sm font-semibold">
                        {l.produits?.nom} · {formatQuantite(l.quantite, unite)} à affecter
                      </legend>
                      <label className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                        <span>
                          Garder chez {producteur?.denomination} <span className="text-foreground-muted">({formatMontant(l.prix_unitaire)}/{unite})</span>
                        </span>
                        <Input name={`q:${l.id}:origine`} inputMode="decimal" placeholder="0" className="h-9" aria-label={`Quantité gardée chez ${producteur?.denomination}`} />
                      </label>
                      {alternatives[i]
                        .filter((alt) => alt.producteur_id !== c.producteur_id)
                        .map((alt) => (
                          <label key={alt.offre_id} className="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm">
                            <span>
                              {alt.denomination}
                              <span className="text-foreground-muted">
                                {' '}
                                · {formatMontant(alt.prix_unitaire)}/{unite} · {formatQuantite(alt.quantite_commandable, unite)} commandables
                                {alt.region ? ` · ${alt.region}` : ''}
                                {alt.marge !== null ? ` · marge ${formatQuantite(Math.round(Number(alt.marge)), unite)}` : ''}
                              </span>
                            </span>
                            <Input name={`q:${l.id}:${alt.offre_id}`} inputMode="decimal" placeholder="0" className="h-9" aria-label={`Quantité affectée à ${alt.denomination}`} />
                          </label>
                        ))}
                      {alternatives[i].filter((alt) => alt.producteur_id !== c.producteur_id).length === 0 && (
                        <p className="text-sm text-foreground-muted">Aucun autre producteur n’a d’offre publiée de ce produit disponible à cette date.</p>
                      )}
                    </fieldset>
                  )
                })}
                <Textarea name="commentaire" rows={2} placeholder="Motif (visible du client)" aria-label="Motif" />
              </FormulaireAction>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {aTraiter ? (
            <>
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                  <BadgeCheck className="h-5 w-5 text-success" aria-hidden /> Approuver
                </h2>
                <FormulaireAction action={approuver} libelle="Approuver la commande" boutonClassName="w-full">
                  <input type="hidden" name="commande_id" value={c.id} />
                  <Champ id="date_convenue" label="Date de livraison convenue" requis>
                    <Input id="date_convenue" name="date_convenue" type="date" required min={dateMin} defaultValue={date >= dateMin ? date : dateMin} />
                  </Champ>
                  <Champ id="commentaire" label="Commentaire">
                    <Input id="commentaire" name="commentaire" maxLength={500} />
                  </Champ>
                  {c.mode_paiement === 'bon_banque' && (
                    <p className="text-xs text-foreground-muted">Paiement par bon : la commande attendra l’approbation de la banque avant d’être transmise au producteur.</p>
                  )}
                </FormulaireAction>
              </Card>
              {c.statut !== 'en_attente' && c.statut !== 'refusee_banque' && (
                <Card>
                  <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                    <PauseCircle className="h-5 w-5 text-warning" aria-hidden /> Mettre en attente
                  </h2>
                  <FormulaireAction action={mettreEnAttente} libelle="Mettre en attente" variante="outline" boutonClassName="w-full">
                    <input type="hidden" name="commande_id" value={c.id} />
                    <Input name="motif" required minLength={3} placeholder="Motif (visible du client)" aria-label="Motif" />
                  </FormulaireAction>
                </Card>
              )}
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                  <XCircle className="h-5 w-5 text-danger" aria-hidden /> Refuser
                </h2>
                <FormulaireAction action={refuser} libelle="Refuser la commande" variante="danger" boutonClassName="w-full" confirmation="Refuser définitivement cette commande ?">
                  <input type="hidden" name="commande_id" value={c.id} />
                  <Input name="motif" required minLength={3} placeholder="Motif (visible du client)" aria-label="Motif" />
                </FormulaireAction>
              </Card>
            </>
          ) : (
            <Card className="text-sm text-foreground-muted">Cette commande n’est plus à traiter par le superviseur.</Card>
          )}
          <Card>
            <h2 className="mb-4 font-heading font-semibold">Suivi</h2>
            <Frise evenements={evenements ?? []} />
          </Card>
        </aside>
      </div>
    </>
  )
}
