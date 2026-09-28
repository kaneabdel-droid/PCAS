import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Factory, ImagePlus } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsOffre } from '@/components/offres/ChampsOffre'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import {
  ajouterPhoto,
  changerStatutOffre,
  declarerProduction,
  modifierOffre,
  retirerPhoto,
  supprimerOffre,
} from '@/app/(app)/offres/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { SELECT_OFFRE, optionsOffre, type Offre } from '@/lib/offres'
import { DISPONIBILITES, STATUTS_OFFRE, formatQuantite, urlPhotoOffre } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Offre' }

export default async function OffrePage({ params }: { params: Promise<{ id: string }> }) {
  await exigerLecture('/offres', ['producteur'])
  const { modifier } = await droitsEcran('/offres', ['producteur'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data: offre }, { data: declarations }, options] = await Promise.all([
    supabase.from('offres').select(SELECT_OFFRE).eq('id', id).maybeSingle<Offre>(),
    supabase.from('declarations_production').select('id, quantite, date_production, commentaire').eq('offre_id', id).order('date_production', { ascending: false }),
    optionsOffre(),
  ])
  if (!offre) notFound()
  const unite = offre.produits?.unite ?? ''
  const aDate = offre.disponibilite !== 'immediate' || (declarations?.length ?? 0) > 0
  const produit = (declarations ?? []).reduce((s, d) => s + Number(d.quantite), 0)
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const statut = STATUTS_OFFRE[offre.statut]
  const champCache = <input type="hidden" name="offre_id" value={offre.id} />

  return (
    <>
      <Link href="/offres" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Mes offres
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">{offre.produits?.nom}</h1>
            <Badge ton={statut.ton}>{statut.libelle}</Badge>
            <Badge ton={offre.disponibilite === 'immediate' ? 'succes' : 'info'}>
              {DISPONIBILITES[offre.disponibilite]}
              {offre.date_disponibilite ? ` · ${formatDate(offre.date_disponibilite)}` : ''}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {formatMontant(offre.prix_unitaire)} / {unite} · {formatQuantite(offre.quantite_offerte, unite)} offerts ·{' '}
            {formatQuantite(offre.quantite_reservee, unite)} réservés · {offre.sites_production?.nom}
          </p>
        </div>
        {modifier && (
          <div className="flex flex-wrap gap-2">
            {offre.statut !== 'publiee' && (
              <FormulaireAction action={changerStatutOffre} libelle="Publier">
                {champCache}
                <input type="hidden" name="statut" value="publiee" />
              </FormulaireAction>
            )}
            {offre.statut === 'publiee' && (
              <FormulaireAction action={changerStatutOffre} libelle="Suspendre" variante="outline" confirmation="Suspendre cette offre ? Elle ne sera plus visible des clients.">
                {champCache}
                <input type="hidden" name="statut" value="suspendue" />
              </FormulaireAction>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <FormulaireAction action={modifierOffre} libelle="Enregistrer l’offre">
            {champCache}
            <ChampsOffre offre={offre} sites={options.sites} produits={options.produits} aujourdhui={aujourdhui} />
            <p className="text-xs text-foreground-muted">
              Si l’offre est publiée, les contrôles de stock (offre immédiate) ou de capacité (offre à date) s’appliquent aussi aux
              modifications.
            </p>
          </FormulaireAction>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
              <ImagePlus className="h-5 w-5 text-primary" aria-hidden /> Photos ({offre.photos.length}/6)
            </h2>
            {offre.photos.length > 0 && (
              <ul className="mb-4 grid grid-cols-3 gap-2">
                {offre.photos.map((p) => (
                  <li key={p} className="group relative aspect-square overflow-hidden rounded-lg border border-surface-border">
                    <Image src={urlPhotoOffre(p)} alt="" fill sizes="120px" className="object-cover" />
                    {modifier && (
                      <FormulaireAction
                        action={retirerPhoto}
                        libelle="×"
                        variante="danger"
                        className="absolute right-1 top-1 space-y-0"
                        boutonClassName="h-6 w-6 rounded-full p-0 text-sm"
                        confirmation="Retirer cette photo ?"
                      >
                        {champCache}
                        <input type="hidden" name="chemin" value={p} />
                      </FormulaireAction>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {modifier && offre.photos.length < 6 && (
              <FormulaireAction action={ajouterPhoto} libelle="Ajouter la photo" variante="outline" enCoursLibelle="Envoi…" reinitialiser>
                {champCache}
                <input
                  type="file"
                  name="photo"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  className="block w-full text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
                />
                <p className="text-xs text-foreground-muted">Photos réelles du produit, 3 Mo maximum. La première sert de vignette.</p>
              </FormulaireAction>
            )}
          </Card>

          {aDate && (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                <Factory className="h-5 w-5 text-accent" aria-hidden /> Production déclarée
              </h2>
              <p className="mb-3 text-sm text-foreground-muted">
                {formatQuantite(produit, unite)} déclarés sur {formatQuantite(offre.quantite_offerte, unite)} offerts. Chaque
                déclaration entre en stock de produits finis.
              </p>
              {(declarations ?? []).length > 0 && (
                <ul className="mb-4 space-y-1 text-sm">
                  {declarations!.map((d) => (
                    <li key={d.id} className="flex justify-between gap-2">
                      <span className="text-foreground-muted">{formatDate(d.date_production)}</span>
                      <span className="font-medium tabular-nums">{formatQuantite(d.quantite, unite)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {modifier && (
                <FormulaireAction action={declarerProduction} libelle="Déclarer la production" variante="outline" reinitialiser>
                  {champCache}
                  <GrilleChamps>
                    <Champ id="quantite" label={`Quantité produite (${unite})`} requis>
                      <Input id="quantite" name="quantite" required inputMode="decimal" />
                    </Champ>
                    <Champ id="date_production" label="Date">
                      <Input id="date_production" name="date_production" type="date" max={aujourdhui} defaultValue={aujourdhui} />
                    </Champ>
                  </GrilleChamps>
                  <Input name="commentaire" placeholder="Commentaire (facultatif)" maxLength={500} aria-label="Commentaire" />
                </FormulaireAction>
              )}
            </Card>
          )}

          {modifier && offre.statut === 'brouillon' && (
            <Card className="border-danger/40">
              <h2 className="font-heading font-semibold text-danger">Supprimer le brouillon</h2>
              <p className="mb-3 mt-1 text-sm text-foreground-muted">Une offre déjà publiée ne se supprime pas : suspendez-la.</p>
              <FormulaireAction action={supprimerOffre} libelle="Supprimer" variante="danger" confirmation="Supprimer ce brouillon d’offre ?">
                {champCache}
              </FormulaireAction>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
