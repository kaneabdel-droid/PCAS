import Link from 'next/link'
import { Badge, Vide } from '@/components/ui/champ'
import { LIBELLES_ROLES } from '@/lib/roles'
import type { UtilisateurEntreprise } from '@/lib/entreprise'

/** Utilisateurs rattachés à une entreprise ; liens de gestion pour l'administrateur. */
export function ListeUtilisateurs({ utilisateurs, lienGestion = false }: { utilisateurs: UtilisateurEntreprise[]; lienGestion?: boolean }) {
  if (utilisateurs.length === 0) return <Vide titre="Aucun utilisateur rattaché" />
  return (
    <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
      {utilisateurs.map((u) => (
        <li key={u.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {lienGestion ? (
                <Link href={`/admin/utilisateurs/${u.id}`} className="hover:text-primary hover:underline">
                  {u.nom_complet}
                </Link>
              ) : (
                u.nom_complet
              )}
            </p>
            <p className="truncate text-sm text-foreground-muted">
              {u.email}
              {u.fonction ? ` · ${u.fonction}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{LIBELLES_ROLES[u.role_base]}</Badge>
            {u.signataire && <Badge ton="info">Signataire</Badge>}
            {!u.actif && <Badge ton="danger">Désactivé</Badge>}
          </div>
        </li>
      ))}
    </ul>
  )
}
