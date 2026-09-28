import { Check } from 'lucide-react'
import { ETAPES_CIRCUIT } from '@/lib/commandes'
import { cn } from '@/lib/utils'

const ARRETS = ['refusee', 'reorientee', 'repartie', 'annulee', 'refusee_banque', 'refusee_producteur']

/** Frise d'avancement d'une commande dans le circuit (commande → paiement). */
export function Avancement({ statut }: { statut: string }) {
  const index = ETAPES_CIRCUIT.findIndex((e) => (e.statuts as readonly string[]).includes(statut))
  const arretee = ARRETS.includes(statut)
  return (
    <ol className="flex overflow-x-auto rounded-xl border border-surface-border bg-surface p-3 sm:p-4" aria-label="Avancement de la commande">
      {ETAPES_CIRCUIT.map((etape, i) => {
        const faite = !arretee && (i < index || statut === 'soldee')
        const courante = !arretee && i === index && statut !== 'soldee'
        return (
          <li key={etape.cle} className="flex min-w-24 flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5 px-1 text-center">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold',
                  faite && 'border-primary bg-primary text-primary-foreground',
                  courante && 'border-primary bg-primary-soft text-primary',
                  !faite && !courante && 'border-surface-border text-foreground-muted'
                )}
                aria-current={courante ? 'step' : undefined}
              >
                {faite ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn('text-xs', courante ? 'font-semibold text-foreground' : 'text-foreground-muted')}>{etape.libelle}</span>
            </div>
            {i < ETAPES_CIRCUIT.length - 1 && (
              <span className={cn('mb-5 h-0.5 flex-1', faite ? 'bg-primary' : 'bg-surface-border')} aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}
