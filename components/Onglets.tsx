import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Onglets par paramètre d'URL (?onglet=…) : navigables, partageables et sans JavaScript. */
export function Onglets({
  base,
  actif,
  onglets,
}: {
  base: string
  actif: string
  onglets: { cle: string; libelle: string; compte?: number }[]
}) {
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto border-b border-surface-border px-4 sm:mx-0 sm:px-0" aria-label="Sections">
      <ul className="flex min-w-max gap-1">
        {onglets.map((o) => {
          const courant = o.cle === actif
          return (
            <li key={o.cle}>
              <Link
                href={`${base}?onglet=${o.cle}`}
                aria-current={courant ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  courant
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground-muted hover:border-surface-border hover:text-foreground'
                )}
              >
                {o.libelle}
                {o.compte !== undefined && (
                  <span className="rounded-full bg-surface-muted px-1.5 text-xs text-foreground-muted">{o.compte}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
