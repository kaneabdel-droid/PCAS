import { cn } from '@/lib/utils'

/** Emblème PCAS : pousse verte sous un soleil ocre, sur fond vert savane. */
export function Embleme({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9 shrink-0', className)} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#2E6E3E" />
      <circle cx="44" cy="19" r="7" fill="#E39A45" />
      <path d="M32 52V31" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 36c-9 0-14-6-14-14 9 0 14 6 14 14Z" fill="#FFFFFF" />
      <path d="M32 31c0-7 5-12 13-12 0 8-5 12-13 12Z" fill="#CDE8D3" />
      <path d="M16 52h32" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, sousTitre = true }: { className?: string; sousTitre?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Embleme />
      <div className="min-w-0 leading-tight">
        <p className="font-heading text-lg font-bold tracking-tight">PCAS</p>
        {sousTitre && <p className="truncate text-[11px] opacity-75">Commercialisation agricole du Sénégal</p>}
      </div>
    </div>
  )
}
