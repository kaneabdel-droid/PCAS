// Matrice de permissions d'un profil personnalisé (profils.matrice_permissions) : { href: { lire, ecrire, modifier } }.
// Restriction additive uniquement : elle ne peut jamais accorder plus que le plafond du rôle de base (MenuItem.roles).

import type { RoleBase } from '@/lib/roles'

export type ActionPermission = 'lire' | 'ecrire' | 'modifier'
export type Matrice = Record<string, Partial<Record<ActionPermission, boolean>>>

/** Une valeur absente de la matrice vaut « autorisé » : un utilisateur sans profil personnalisé a tous les droits de son rôle. */
export function permissionMenu(matrice: Matrice | null | undefined, href: string, action: ActionPermission): boolean {
  return matrice?.[href]?.[action] !== false
}

/** Plafond du rôle (codé page par page) combiné à la restriction éventuelle du profil. */
export function peutMenu(
  ctx: { role: RoleBase; permissions: Matrice },
  href: string,
  rolesBase: RoleBase[],
  action: ActionPermission = 'ecrire'
): boolean {
  return rolesBase.includes(ctx.role) && permissionMenu(ctx.permissions, href, action)
}
