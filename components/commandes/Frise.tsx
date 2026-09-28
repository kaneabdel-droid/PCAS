import { ACTIONS_COMMANDE } from '@/lib/commandes'
import { LIBELLES_ROLES, estRoleBase } from '@/lib/roles'

export type Evenement = {
  id: number
  horodatage: string
  acteur_nom: string | null
  acteur_role: string | null
  action: string
  commentaire: string | null
}

/** Journal de bord d'une commande : qui a fait quoi, et quand. */
export function Frise({ evenements }: { evenements: Evenement[] }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-surface-border pl-5">
      {evenements.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
          <p className="text-sm font-medium">{ACTIONS_COMMANDE[e.action] ?? e.action}</p>
          <p className="text-xs text-foreground-muted">
            {new Date(e.horodatage).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dakar' })}
            {e.acteur_nom ? ` · ${e.acteur_nom}` : ''}
            {e.acteur_role && estRoleBase(e.acteur_role) ? ` (${LIBELLES_ROLES[e.acteur_role]})` : ''}
          </p>
          {e.commentaire && <p className="mt-1 rounded-lg bg-surface-muted px-3 py-2 text-sm">{e.commentaire}</p>}
        </li>
      ))}
    </ol>
  )
}
