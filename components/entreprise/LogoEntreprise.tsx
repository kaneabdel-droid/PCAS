import Image from 'next/image'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { urlLogo } from '@/lib/referentiels'

/** Logo d'une entreprise, ou ses initiales sur fond neutre s'il n'y en a pas. */
export function LogoEntreprise({
  chemin,
  denomination,
  taille = 56,
  className,
}: {
  chemin: string | null
  denomination: string
  taille?: number
  className?: string
}) {
  const url = urlLogo(chemin)
  const style = { width: taille, height: taille }
  if (url) {
    return (
      <span className={cn('relative block shrink-0 overflow-hidden rounded-xl border border-surface-border bg-white', className)} style={style}>
        <Image src={url} alt={`Logo ${denomination}`} fill sizes={`${taille}px`} className="object-contain p-1" />
      </span>
    )
  }
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-xl border border-surface-border bg-surface-muted text-foreground-muted', className)}
      style={style}
      aria-hidden
    >
      <Building2 className="h-1/2 w-1/2" />
    </span>
  )
}
