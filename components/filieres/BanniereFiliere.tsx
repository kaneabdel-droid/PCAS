'use client'

import { Apple, Carrot, Layers, Wheat, X } from 'lucide-react'
import { FILIERES, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'
import { changerFiliereActive } from '@/app/actions/filieres'
import { cn } from '@/lib/utils'

const ICONES = {
  cereale: Wheat,
  maraichage: Carrot,
  fruitier: Apple,
  toutes: Layers,
}

export function BanniereFiliere({
  filiereActive,
  userFiliere,
  role,
}: {
  filiereActive: FiliereFiltre
  userFiliere?: FiliereCode | null
  role: string
}) {
  // Pas de bandeau si vue globale
  if (filiereActive === 'toutes') return null

  const f = FILIERES[filiereActive]
  const Icone = ICONES[filiereActive]

  const estDedie = Boolean(userFiliere)
  const estAdminFiliere = estDedie && role === 'administrateur'

  return (
    <aside
      aria-label="Contexte de filière active"
      className={cn(
        'no-print mb-6 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all sm:p-5',
        f.theme.bannerBg,
        f.theme.bannerBorder
      )}
    >
      {/* Halo lumineux d'ambiance en arrière-plan */}
      <div
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl opacity-40',
          f.theme.gradientBar
        )}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 sm:items-center">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform hover:scale-105',
              f.theme.emblemBg,
              f.theme.emblemHalo
            )}
          >
            <Icone className="h-6 w-6" aria-hidden />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-bold tracking-tight text-foreground sm:text-lg">
                Filière {f.nom}
              </h2>
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  estDedie
                    ? 'bg-black/10 dark:bg-white/10 text-foreground border border-black/10 dark:border-white/10'
                    : 'bg-white/70 dark:bg-black/40 text-foreground shadow-xs'
                )}
              >
                {estAdminFiliere
                  ? '🔒 Copie Dédiée — Administrateur Filière'
                  : estDedie
                  ? '🔒 Supervision Dédiée — Superviseur Principal'
                  : '⚡ Espace Filière Actif'}
              </span>
            </div>

            <p className="mt-0.5 text-xs text-foreground-muted sm:text-sm">
              {estAdminFiliere
                ? `Plateforme autonome PCAS dédiée à la filière ${f.nom}. Vos données de catalogue, marché, commandes et stocks sont gérées dans cette copie dédiée.`
                : estDedie
                ? `Votre compte supervise exclusivement la filière ${f.nom}. Tous les écrans sont verrouillés sur ce périmètre.`
                : 'Affichage, stocks, place de marché et supervision filtrés en temps réel sur cette filière.'}
            </p>

            {/* Chips des cultures emblématiques de la filière */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-foreground-muted">Cultures clés :</span>
              {f.exemplesCultures.map((culture) => (
                <span
                  key={culture}
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border shadow-xs',
                    f.theme.tagClass
                  )}
                >
                  {culture}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!estDedie && (
          <div className="shrink-0 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={() => changerFiliereActive('toutes')}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-surface hover:shadow-sm active:scale-95 sm:w-auto"
              title="Revenir à la vue consolidée toutes filières"
            >
              <X className="h-3.5 w-3.5 text-foreground-muted" aria-hidden />
              <span>Vue globale (Toutes)</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
