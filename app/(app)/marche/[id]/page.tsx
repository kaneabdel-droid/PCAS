import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, MapPin, Package } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { ajouterAuPanier } from '@/app/(app)/marche/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import type { OffreMarche } from '@/lib/marche'
import { formatQuantite, urlPhotoOffre } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Offre' }

export default async function OffreMarchePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/marche', ['client', 'administrateur', 'superviseur'])
  const { ecrire } = await droitsEcran('/marche', ['client'])
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('marche_offres').select('*').eq('id', id).maybeSingle()
  const offre = data as unknown as OffreMarche | null
  if (!offre) notFound()

  const { data: autresData } = await supabase
    .rpc('marche_offres')
    .select('id, produit_nom, prix_unitaire, unite')
    .eq('producteur_id', offre.producteur_id)
    .neq('id', offre.id)
    .limit(6)
  const autres = (autresData ?? []) as unknown as Pick<OffreMarche, 'id' | 'produit_nom' | 'prix_unitaire' | 'unite'>[]

  const caracteristiques = [
    ['Variété', offre.variete],
    ['Calibre', offre.calibre],
    ['Qualité', offre.qualite],
    ['Conditionnement', offre.conditionnement],
    ['Catégorie', offre.categorie],
    ['Commande minimale', offre.quantite_min_commande ? formatQuantite(offre.quantite_min_commande, offre.unite) : null],
    ['Offre valable jusqu’au', offre.date_fin_validite ? formatDate(offre.date_fin_validite) : null],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <>
      <Link href="/marche" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Offres des producteurs
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-surface-border bg-surface-muted">
            {offre.photos[0] ? (
              <Image src={urlPhotoOffre(offre.photos[0])} alt={offre.produit_nom} fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" priority />
            ) : (
              <div className="flex h-full items-center justify-center text-foreground-muted/50">
                <Package className="h-16 w-16" aria-hidden />
              </div>
            )}
          </div>
          {offre.photos.length > 1 && (
            <ul className="grid grid-cols-5 gap-2">
              {offre.photos.slice(1).map((p) => (
                <li key={p} className="relative aspect-square overflow-hidden rounded-lg border border-surface-border">
                  <Image src={urlPhotoOffre(p)} alt="" fill sizes="120px" className="object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-3xl font-semibold">{offre.produit_nom}</h1>
              {offre.disponibilite === 'immediate' ? (
                <Badge ton="succes">Disponible maintenant</Badge>
              ) : (
                <Badge ton="info">
                  <CalendarClock className="mr-1 h-3 w-3" aria-hidden /> Disponible le {formatDate(offre.date_disponibilite)}
                </Badge>
              )}
            </div>
            <p className="mt-3 font-heading text-3xl font-semibold text-primary">
              {formatMontant(offre.prix_unitaire)} <span className="text-base font-normal text-foreground-muted">/ {offre.unite}</span>
            </p>
            <p className="mt-1 text-sm text-foreground-muted">{formatQuantite(offre.quantite_commandable, offre.unite)} disponibles à la commande</p>
          </div>

          {ctx.role === 'client' && ecrire && (
            <Card>
              <FormulaireAction action={ajouterAuPanier} libelle="Ajouter au panier" boutonClassName="w-full sm:w-auto">
                <input type="hidden" name="offre_id" value={offre.id} />
                <Champ id="quantite" label={`Quantité (${offre.unite})`} requis>
                  <Input
                    id="quantite"
                    name="quantite"
                    required
                    inputMode="decimal"
                    defaultValue={offre.quantite_min_commande ?? ''}
                    placeholder={offre.quantite_min_commande ? `Minimum ${offre.quantite_min_commande}` : undefined}
                  />
                </Champ>
              </FormulaireAction>
              <p className="mt-3 text-xs text-foreground-muted">
                {offre.disponibilite === 'immediate'
                  ? 'Le stock est réservé à la validation de la commande par le producteur.'
                  : 'Offre à date : votre commande sera ferme, livrable à partir de la date annoncée.'}
              </p>
            </Card>
          )}

          {caracteristiques.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {caracteristiques.map(([cle, valeur]) => (
                <div key={cle}>
                  <dt className="text-foreground-muted">{cle}</dt>
                  <dd className="font-medium">{valeur}</dd>
                </div>
              ))}
            </dl>
          )}
          {offre.description && <p className="whitespace-pre-line text-sm leading-relaxed">{offre.description}</p>}

          <Card className="flex items-center gap-4">
            <LogoEntreprise chemin={offre.producteur_logo} denomination={offre.producteur_nom} taille={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading font-semibold">{offre.producteur_nom}</p>
              <p className="flex items-center gap-1 text-sm text-foreground-muted">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> {[offre.commune, offre.region].filter(Boolean).join(', ') || 'Sénégal'}
              </p>
            </div>
            <Link href={`/marche?producteur=${offre.producteur_id}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
              Toutes ses offres
            </Link>
          </Card>

          {autres.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground-muted">Du même producteur</p>
              <ul className="flex flex-wrap gap-2">
                {autres.map((a) => (
                  <li key={a.id}>
                    <Link href={`/marche/${a.id}`} className="inline-flex rounded-full border border-surface-border px-3 py-1 text-sm hover:border-primary">
                      {a.produit_nom} · {formatMontant(a.prix_unitaire)}/{a.unite}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
