import Image from 'next/image'
import Link from 'next/link'
import { CalendarClock, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/champ'
import { DISPONIBILITES, STATUTS_OFFRE, formatQuantite, urlPhotoOffre } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import type { Offre } from '@/lib/offres'

/** Carte d'offre : photo, produit, prix à l'unité, quantité restante, disponibilité (et statut côté producteur). */
export function CarteOffre({ offre, href, afficherStatut = true }: { offre: Offre; href: string; afficherStatut?: boolean }) {
  const unite = offre.produits?.unite ?? ''
  const restant = Number(offre.quantite_offerte) - Number(offre.quantite_reservee)
  const statut = STATUTS_OFFRE[offre.statut]
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-surface transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-surface-muted">
        {offre.photos[0] ? (
          <Image
            src={urlPhotoOffre(offre.photos[0])}
            alt={offre.produits?.nom ?? 'Produit'}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-foreground-muted/50">
            <Sprout className="h-12 w-12" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {offre.disponibilite === 'immediate' ? (
            <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-white shadow">Disponible</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white shadow">
              <CalendarClock className="h-3 w-3" aria-hidden /> {formatDate(offre.date_disponibilite)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-heading font-semibold">{offre.produits?.nom}</p>
            <p className="truncate text-xs text-foreground-muted">
              {[offre.variete, offre.calibre, offre.qualite].filter(Boolean).join(' · ') || DISPONIBILITES[offre.disponibilite]}
            </p>
          </div>
          {afficherStatut && <Badge ton={statut.ton}>{statut.libelle}</Badge>}
        </div>
        <p className="mt-auto font-heading text-xl font-semibold text-primary">
          {formatMontant(offre.prix_unitaire)}
          <span className="text-sm font-normal text-foreground-muted"> / {unite}</span>
        </p>
        <p className="text-sm text-foreground-muted">
          {formatQuantite(restant, unite)} à vendre
          {offre.sites_production?.region ? ` · ${offre.sites_production.region}` : ''}
        </p>
      </div>
    </Link>
  )
}
