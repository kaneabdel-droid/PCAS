import Link from 'next/link'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tuile = {
  libelle: string
  valeur: string
  detail?: string
  lien?: string
  /** Signale une situation à traiter (icône + libellé, jamais la couleur seule). */
  alerte?: boolean
}

/** Rangée de chiffres clés : valeur en encre principale, libellé et détail en encre secondaire. */
export function Tuiles({ tuiles }: { tuiles: Tuile[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tuiles.map((t) => {
        const contenu = (
          <>
            <p className="flex items-center gap-1.5 text-sm text-foreground-muted">
              {t.alerte && <AlertTriangle className="h-4 w-4 text-warning" aria-label="À traiter" />}
              {t.libelle}
            </p>
            <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-foreground">{t.valeur}</p>
            {t.detail && <p className="mt-1 text-xs text-foreground-muted">{t.detail}</p>}
            {t.lien && <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-foreground-muted" aria-hidden />}
          </>
        )
        const classes = cn(
          'relative block h-full rounded-xl border bg-surface p-4 sm:p-5',
          t.alerte ? 'border-warning/50' : 'border-surface-border',
          t.lien && 'transition-shadow hover:shadow-lg'
        )
        return (
          <li key={t.libelle}>
            {t.lien ? (
              <Link href={t.lien} className={classes}>
                {contenu}
              </Link>
            ) : (
              <div className={classes}>{contenu}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Liste courte d'éléments à traiter, avec lien « tout voir ». */
export function ListeATraiter({
  titre,
  elements,
  lienTout,
  vide,
}: {
  titre: string
  elements: { id: string; libelle: string; detail: string; lien: string; valeur?: string }[]
  lienTout: string
  vide: string
}) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="font-heading font-semibold">{titre}</h2>
        <Link href={lienTout} className="text-sm font-medium text-primary hover:underline">
          Tout voir
        </Link>
      </div>
      {elements.length === 0 ? (
        <p className="px-4 py-6 text-sm text-foreground-muted">{vide}</p>
      ) : (
        <ul className="divide-y divide-surface-border">
          {elements.map((e) => (
            <li key={e.id}>
              <Link href={e.lien} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.libelle}</span>
                  <span className="block truncate text-xs text-foreground-muted">{e.detail}</span>
                </span>
                {e.valeur && <span className="text-sm font-semibold tabular-nums">{e.valeur}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
