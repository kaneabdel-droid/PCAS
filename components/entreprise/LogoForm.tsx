import { FormulaireAction } from '@/components/FormulaireAction'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { supprimerLogo, televerserLogo } from '@/app/(app)/entreprise/actions'
import type { Entreprise } from '@/lib/entreprise'

/** Logo affiché sur les documents (commandes, bons, factures) et sur la fiche publique du producteur. */
export function LogoForm({ entreprise }: { entreprise: Entreprise }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <LogoEntreprise chemin={entreprise.logo_path} denomination={entreprise.denomination} taille={96} />
      <div className="flex-1 space-y-3">
        <FormulaireAction action={televerserLogo} libelle="Envoyer le logo" enCoursLibelle="Envoi…" variante="outline" reinitialiser>
          <input type="hidden" name="entreprise_id" value={entreprise.id} />
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block w-full text-sm text-foreground-muted file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
          />
          <p className="text-xs text-foreground-muted">PNG, JPEG ou WebP, 1 Mo maximum. Un fond transparent ou blanc rend mieux sur les documents.</p>
        </FormulaireAction>
        {entreprise.logo_path && (
          <FormulaireAction action={supprimerLogo} libelle="Retirer le logo" variante="ghost" confirmation="Retirer le logo de l’entreprise ?">
            <input type="hidden" name="entreprise_id" value={entreprise.id} />
          </FormulaireAction>
        )}
      </div>
    </div>
  )
}
