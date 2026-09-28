import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Badge } from '@/components/ui/champ'
import { LIBELLES_TYPES_ENTREPRISE } from '@/lib/roles'
import type { Entreprise } from '@/lib/entreprise'

/** En-tête d'une fiche entreprise : logo, dénomination, type, statut, identifiant. */
export function EnteteEntreprise({ entreprise, children }: { entreprise: Entreprise; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <LogoEntreprise chemin={entreprise.logo_path} denomination={entreprise.denomination} taille={64} />
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-semibold">{entreprise.denomination}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
            <Badge ton="primaire">{LIBELLES_TYPES_ENTREPRISE[entreprise.type]}</Badge>
            {entreprise.statut === 'suspendu' && <Badge ton="danger">Suspendue</Badge>}
            {entreprise.identifiant_fiscal && (
              <span>
                {entreprise.type_identifiant} {entreprise.identifiant_fiscal}
              </span>
            )}
            {entreprise.region && <span>· {entreprise.region}</span>}
          </div>
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}
