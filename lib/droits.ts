import { notFound } from 'next/navigation'
import { getContexte, type Contexte } from '@/lib/session'
import { permissionMenu, peutMenu, type ActionPermission } from '@/lib/permissions'
import type { RoleBase } from '@/lib/roles'

/** Page : 404 si le rôle n'y a pas accès, ou si son profil personnalisé en retire la lecture. */
export async function exigerLecture(href: string, roles: RoleBase[]): Promise<Contexte> {
  const ctx = await getContexte()
  if (!roles.includes(ctx.role) || !permissionMenu(ctx.permissions, href, 'lire')) notFound()
  return ctx
}

/**
 * Action serveur : message d'erreur si le rôle ou le profil n'autorise pas l'opération, sinon null.
 * La RLS protège déjà les données ; ce contrôle applique en plus les restrictions des profils personnalisés.
 */
export async function refusDroit(href: string, roles: RoleBase[], action: ActionPermission = 'ecrire'): Promise<string | null> {
  const ctx = await getContexte()
  return peutMenu(ctx, href, roles, action) ? null : 'Votre profil ne vous autorise pas à faire cette opération.'
}

/** Droits d'un écran pour l'affichage des boutons. */
export async function droitsEcran(href: string, roles: RoleBase[]) {
  const ctx = await getContexte()
  return {
    ctx,
    ecrire: peutMenu(ctx, href, roles, 'ecrire'),
    modifier: peutMenu(ctx, href, roles, 'modifier'),
  }
}
