import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-surface-border bg-surface p-4 sm:p-6', className)}
      {...props}
    />
  )
}

export function PageHeader({
  titre,
  description,
  children,
}: {
  titre: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">{titre}</h1>
        {description && <p className="mt-1 text-sm text-foreground-muted">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

/** Tableau qui défile horizontalement sur mobile au lieu de casser la page. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  )
}

export const th = 'border-b border-surface-border bg-surface-muted px-4 py-3 font-medium text-foreground-muted'
export const td = 'border-b border-surface-border px-4 py-3 text-foreground'
