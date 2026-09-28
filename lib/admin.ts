import { notFound } from 'next/navigation'
import { getContexte, type Contexte } from '@/lib/session'

/** Pages d'administration : réservées à l'administrateur (404 pour les autres, pas d'indice sur l'existence de la page). */
export async function exigerAdmin(): Promise<Contexte> {
  const ctx = await getContexte()
  if (ctx.role !== 'administrateur') notFound()
  return ctx
}

/**
 * Actions serveur d'administration : vérifie le rôle avant toute opération. La RLS refuse de toute façon les écritures
 * d'un non-administrateur, mais les opérations sur les comptes (invitation, suppression) passent par la clé de service,
 * qui la contourne : ce contrôle est alors la seule barrière.
 */
export async function estAdmin(): Promise<boolean> {
  const ctx = await getContexte()
  return ctx.role === 'administrateur'
}
