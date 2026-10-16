'use client'

import { useTransition } from 'react'
import { Apple, Carrot, Check, Layers, Wheat } from 'lucide-react'
import { FILIERES, VUE_TOUTES_FILIERES, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'
import { changerFiliereActive } from '@/app/actions/filieres'
import { cn } from '@/lib/utils'

const ICONES = {
  cereale: Wheat,
  maraichage: Carrot,
  fruitier: Apple,
  toutes: Layers,
}

export function SelecteurFiliere({
  filiereActive,
  filieresActivesPlateforme,
  userFiliere,
  entrepriseFilieres,
  role,
  className,
}: {
  filiereActive: FiliereFiltre
  filieresActivesPlateforme: FiliereCode[]
  userFiliere?: FiliereCode | null
  entrepriseFilieres?: FiliereCode[] | null
  role: string
  className?: string
}) {
  const [isPending, startTransition] = useTransition()

  // 1. Si l'utilisateur est dédié à une filière spécifique (Administrateur Filière ou Superviseur Principal)
  if (userFiliere) {
    const f = FILIERES[userFiliere]
    const Icone = ICONES[userFiliere]
    const titreRole = role === 'administrateur' ? 'Administrateur Filière' : 'Superviseur Principal'
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs',
          f.theme.badgeClass,
          className
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/50 dark:bg-black/20">
          <Icone className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">{titreRole}</span>
          <span className="font-heading font-bold">{f.nom}</span>
        </div>
      </div>
    )
  }

  // 2. Si l'utilisateur appartient à une entreprise dont les filières sont définies :
  // L'entreprise est verrouillée exclusivement sur ses filières d'appartenance.
  if (entrepriseFilieres && entrepriseFilieres.length > 0) {
    const autorisees = entrepriseFilieres.filter((code) => filieresActivesPlateforme.includes(code))
    
    // Si l'entreprise n'appartient qu'à une seule filière active
    if (autorisees.length === 1 && autorisees[0]) {
      const code = autorisees[0]
      const f = FILIERES[code]
      const Icone = ICONES[code]
      return (
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs',
            f.theme.badgeClass,
            className
          )}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/50 dark:bg-black/20">
            <Icone className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Filière d’appartenance</span>
            <span className="font-heading font-bold">{f.nom}</span>
          </div>
        </div>
      )
    }

    // Si l'entreprise appartient à plusieurs filières :
    // Le sélecteur ne propose que ses filières autorisées, verrouillé sur le reste.
    if (autorisees.length > 1) {
      const optionsEntreprise = autorisees.map((code) => ({
        code,
        nomCourt: FILIERES[code].nomCourt,
        icone: ICONES[code],
        theme: FILIERES[code].theme,
      }))

      const handleChangerEntreprise = (code: FiliereCode) => {
        if (code === filiereActive || isPending) return
        startTransition(async () => {
          await changerFiliereActive(code)
        })
      }

      return (
        <div
          className={cn(
            'flex items-center gap-1 rounded-xl border border-surface-border bg-surface/80 p-1 backdrop-blur shadow-xs transition-opacity',
            isPending && 'opacity-60 cursor-wait',
            className
          )}
          role="group"
          aria-label="Sélection de votre filière d'activité"
        >
          <span className="hidden px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted lg:inline">
            Mes filières :
          </span>
          {optionsEntreprise.map((opt) => {
            const estActif = opt.code === filiereActive
            const Icone = opt.icone
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => handleChangerEntreprise(opt.code)}
                disabled={isPending}
                className={cn(
                  'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  estActif
                    ? cn(opt.theme.activeBtnClass, 'font-semibold shadow-xs')
                    : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
                )}
                title={`Basculer vers ${FILIERES[opt.code].nom}`}
              >
                <Icone
                  className={cn(
                    'h-3.5 w-3.5 transition-transform group-hover:scale-110',
                    estActif ? 'text-current' : 'text-foreground-muted'
                  )}
                  aria-hidden
                />
                <span>{opt.nomCourt}</span>
                {estActif && <span className="sr-only"> (actif)</span>}
              </button>
            )
          })}
        </div>
      )
    }
  }

  // 3. Si une seule filière est activée sur la plateforme
  if (filieresActivesPlateforme.length <= 1) {
    const seule = filieresActivesPlateforme[0]
    if (!seule) return null
    const f = FILIERES[seule]
    const Icone = ICONES[seule]
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-xs',
          f.theme.badgeClass,
          className
        )}
      >
        <Icone className="h-4 w-4" aria-hidden />
        <span>Filière unique : <strong>{f.nom}</strong></span>
      </div>
    )
  }

  // 4. Sinon : sélecteur multi-filières pour SuperAdmin ou Superviseur global
  const options: { code: FiliereFiltre; nomCourt: string; icone: typeof Layers; theme: (typeof FILIERES)[FiliereCode]['theme'] | typeof VUE_TOUTES_FILIERES['theme'] }[] = [
    {
      code: 'toutes',
      nomCourt: 'Toutes',
      icone: Layers,
      theme: VUE_TOUTES_FILIERES.theme,
    },
    ...filieresActivesPlateforme.map((code) => ({
      code,
      nomCourt: FILIERES[code].nomCourt,
      icone: ICONES[code],
      theme: FILIERES[code].theme,
    })),
  ]

  const handleChanger = (code: FiliereFiltre) => {
    if (code === filiereActive || isPending) return
    startTransition(async () => {
      await changerFiliereActive(code)
    })
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl border border-surface-border bg-surface/80 p-1 backdrop-blur shadow-xs transition-opacity',
        isPending && 'opacity-60 cursor-wait',
        className
      )}
      role="group"
      aria-label="Sélection de la filière active"
    >
      <span className="hidden px-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted lg:inline">
        Filière :
      </span>
      {options.map((opt) => {
        const estActif = opt.code === filiereActive
        const Icone = opt.icone
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => handleChanger(opt.code)}
            disabled={isPending}
            className={cn(
              'group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              estActif
                ? cn(opt.theme.activeBtnClass, 'font-semibold shadow-xs')
                : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
            )}
            title={opt.code === 'toutes' ? 'Vue globale consolidée' : `Filtrer sur ${FILIERES[opt.code as FiliereCode].nom}`}
          >
            <Icone
              className={cn(
                'h-3.5 w-3.5 transition-transform group-hover:scale-110',
                estActif ? 'text-current' : 'text-foreground-muted'
              )}
              aria-hidden
            />
            <span>{opt.nomCourt}</span>
            {estActif && (
              <span className="sr-only"> (actif)</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
