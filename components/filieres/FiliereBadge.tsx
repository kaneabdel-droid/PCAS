'use client'

import { Apple, Carrot, Layers, Wheat } from 'lucide-react'
import { FILIERES, VUE_TOUTES_FILIERES, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'
import { cn } from '@/lib/utils'

const ICONES = {
  cereale: Wheat,
  maraichage: Carrot,
  fruitier: Apple,
  toutes: Layers,
}

export function FiliereBadge({
  filiere,
  taille = 'normale',
  court = false,
  className,
}: {
  filiere: FiliereFiltre
  taille?: 'petite' | 'normale' | 'grande'
  court?: boolean
  className?: string
}) {
  const config = filiere === 'toutes' ? VUE_TOUTES_FILIERES : FILIERES[filiere]
  const Icone = ICONES[filiere] ?? Layers

  const libelle = court ? config.nomCourt : config.nom

  const tailles = {
    petite: 'text-[11px] px-2 py-0.5 gap-1',
    normale: 'text-xs px-2.5 py-1 gap-1.5',
    grande: 'text-sm px-3.5 py-1.5 gap-2 font-medium',
  }

  const iconesTaille = {
    petite: 'h-3 w-3',
    normale: 'h-3.5 w-3.5',
    grande: 'h-4 w-4',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium shadow-xs transition-colors',
        config.theme.badgeClass,
        tailles[taille],
        className
      )}
      title={config.description}
    >
      <Icone className={cn('shrink-0', iconesTaille[taille])} aria-hidden />
      <span>{libelle}</span>
    </span>
  )
}
