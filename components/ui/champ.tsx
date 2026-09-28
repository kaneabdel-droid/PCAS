import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Libellé + champ + aide éventuelle, en colonne. */
export function Champ({
  id,
  label,
  aide,
  requis,
  className,
  children,
}: {
  id: string
  label: string
  aide?: string
  requis?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {requis && <span className="text-danger"> *</span>}
      </Label>
      {children}
      {aide && <p className="text-xs text-foreground-muted">{aide}</p>}
    </div>
  )
}

/** Grille de champs : une colonne sur mobile, deux ou trois sur grand écran. */
export function GrilleChamps({ colonnes = 2, children }: { colonnes?: 2 | 3; children: React.ReactNode }) {
  return <div className={cn('grid gap-4', colonnes === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2')}>{children}</div>
}

/** Pastille de statut. */
export function Badge({
  ton = 'neutre',
  children,
}: {
  ton?: 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'primaire'
  children: React.ReactNode
}) {
  const tons = {
    neutre: 'bg-surface-muted text-foreground-muted border-surface-border',
    succes: 'bg-success/10 text-success border-success/30',
    alerte: 'bg-warning/15 text-foreground border-warning/40',
    danger: 'bg-danger/10 text-danger border-danger/30',
    info: 'bg-info/10 text-info border-info/30',
    primaire: 'bg-primary-soft text-primary border-primary/30',
  }
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', tons[ton])}>
      {children}
    </span>
  )
}

/** Message affiché quand une liste est vide. */
export function Vide({ titre, children }: { titre: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-border bg-surface px-6 py-12 text-center">
      <p className="font-medium text-foreground">{titre}</p>
      {children && <div className="mt-2 text-sm text-foreground-muted">{children}</div>}
    </div>
  )
}
