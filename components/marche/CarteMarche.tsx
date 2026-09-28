import Image from 'next/image'
import Link from 'next/link'
import { CalendarClock, MapPin, Sprout } from 'lucide-react'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { formatQuantite, urlPhotoOffre } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import type { OffreMarche } from '@/lib/marche'

/** Carte d'une offre sur la place de marché. */
export function CarteMarche({ offre }: { offre: OffreMarche }) {
  return (
    <Link
      href={`/marche/${offre.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-surface-muted">
        {offre.photos[0] ? (
          <Image
            src={urlPhotoOffre(offre.photos[0])}
            alt={offre.produit_nom}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-foreground-muted/50">
            <Sprout className="h-12 w-12" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3">
          {offre.disponibilite === 'immediate' ? (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-white shadow">Disponible</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white shadow">
              <CalendarClock className="h-3 w-3" aria-hidden /> Le {formatDate(offre.date_disponibilite)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <p className="truncate font-heading font-semibold">{offre.produit_nom}</p>
          <p className="truncate text-xs text-foreground-muted">
            {[offre.variete, offre.calibre, offre.qualite].filter(Boolean).join(' · ') || offre.categorie}
          </p>
        </div>
        <p className="mt-auto font-heading text-xl font-semibold text-primary">
          {formatMontant(offre.prix_unitaire)}
          <span className="text-sm font-normal text-foreground-muted"> / {offre.unite}</span>
        </p>
        <p className="text-sm text-foreground-muted">{formatQuantite(offre.quantite_commandable, offre.unite)} disponibles</p>
        <div className="flex items-center gap-2 border-t border-surface-border pt-3 text-xs text-foreground-muted">
          <LogoEntreprise chemin={offre.producteur_logo} denomination={offre.producteur_nom} taille={24} className="rounded-md" />
          <span className="truncate font-medium text-foreground">{offre.producteur_nom}</span>
          {offre.region && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5">
              <MapPin className="h-3 w-3" aria-hidden /> {offre.region}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
