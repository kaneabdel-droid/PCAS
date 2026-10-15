'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Apple, ArrowRight, Carrot, CheckCircle2, ChevronRight, Layers, Sparkles, Store, Wheat } from 'lucide-react'
import { FILIERES, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'
import { changerFiliereActive } from '@/app/actions/filieres'
import { cn } from '@/lib/utils'

const ICONES = {
  cereale: Wheat,
  maraichage: Carrot,
  fruitier: Apple,
  toutes: Layers,
}

export function HubFilieres({
  filiereActive,
  filieresActivesPlateforme,
  userFiliere,
  role,
}: {
  filiereActive: FiliereFiltre
  filieresActivesPlateforme: FiliereCode[]
  userFiliere?: FiliereCode | null
  role: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleBasculer = (code: FiliereFiltre) => {
    if (code === filiereActive || isPending) return
    startTransition(async () => {
      await changerFiliereActive(code)
    })
  }

  // Si l'utilisateur est dédié à une filière (administrateur filière ou superviseur), il est directement sur sa copie dédiée
  if (userFiliere) {
    return null
  }

  // Si une seule filière est activée sur la plateforme, pas besoin de présenter le hub multi-filières
  if (filieresActivesPlateforme.length <= 1) {
    return null
  }

  return (
    <section className="no-print mb-8 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" aria-hidden />
          <h2 className="font-heading text-base font-bold text-foreground">
            Filières Agricoles PCAS
          </h2>
        </div>
        {filiereActive !== 'toutes' && (
          <button
            type="button"
            onClick={() => handleBasculer('toutes')}
            disabled={isPending}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Afficher toutes les filières
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filieresActivesPlateforme.map((code) => {
          const f = FILIERES[code]
          const Icone = ICONES[code]
          const estActif = filiereActive === code

          return (
            <div
              key={code}
              className={cn(
                'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-300',
                estActif
                  ? cn('border-2 shadow-md ring-2', f.theme.borderAccent, f.theme.halo, f.theme.bgSoft)
                  : 'border-surface-border bg-surface hover:shadow-lg hover:border-surface-border/80'
              )}
            >
              {/* Ligne d'accent supérieure */}
              <div
                className={cn(
                  'absolute inset-x-0 top-0 h-1 transition-all',
                  f.theme.cardTopStripe
                )}
                aria-hidden
              />

              <div>
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-105',
                      f.theme.emblemBg,
                      f.theme.emblemHalo
                    )}
                  >
                    <Icone className="h-6 w-6" aria-hidden />
                  </div>

                  {estActif ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-bold text-foreground dark:bg-white/10">
                      <CheckCircle2 className="h-3 w-3 text-current" />
                      Active
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold border',
                        f.theme.tagClass
                      )}
                    >
                      {f.nomCourt}
                    </span>
                  )}
                </div>

                <div className="mt-3.5">
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {f.nom}
                  </h3>
                  <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                    {f.description}
                  </p>
                </div>

                {/* Badges des cultures phares */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {f.exemplesCultures.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-medium border shadow-2xs',
                        f.theme.tagClass
                      )}
                    >
                      {c}
                    </span>
                  ))}
                  {f.exemplesCultures.length > 3 && (
                    <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-foreground-muted">
                      +{f.exemplesCultures.length - 3}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-surface-border/60">
                {estActif ? (
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>Espace de travail actif</span>
                    <Link
                      href="/marche"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Store className="h-3.5 w-3.5" />
                      Voir les offres
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBasculer(code)}
                    disabled={isPending}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all shadow-xs',
                      'bg-surface-muted text-foreground hover:bg-surface-border active:scale-98'
                    )}
                  >
                    <span>Entrer dans la filière</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
