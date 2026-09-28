'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { estAdmin } from '@/lib/admin'
import { coche, messageErreur, requis, type Resultat } from '@/lib/formulaire'
import { MENUS } from '@/lib/menus'
import type { ActionPermission, Matrice } from '@/lib/permissions'
import { estRoleBase, type RoleBase } from '@/lib/roles'

const ACTIONS: ActionPermission[] = ['lire', 'ecrire', 'modifier']

/** Écrans accessibles à un rôle de base : seuls ceux-là peuvent être restreints par un profil. */
function ecransDuRole(role: RoleBase) {
  return MENUS.flatMap((g) => g.items).filter((i) => i.roles.includes(role))
}

export async function creerProfil(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const libelle = requis(fd, 'libelle')
  const role = requis(fd, 'role_base')
  if (libelle.length < 2) return { error: 'Le libellé est obligatoire.' }
  if (!estRoleBase(role)) return { error: 'Choisissez le rôle de base.' }
  const code = libelle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `profil_${Date.now()}`
  const supabase = await createClient()
  const { data, error } = await supabase.from('profils').insert({ code, libelle, role_base: role }).select('id').single()
  if (error) return { error: messageErreur(error, 'Création impossible.') }
  revalidatePath('/admin/profils')
  redirect(`/admin/profils/${data.id}`)
}

/**
 * Enregistre le libellé, l'état et la matrice du profil. Seules les restrictions (cases décochées) sont stockées :
 * une valeur absente vaut « autorisé », et la matrice ne peut jamais dépasser le plafond du rôle de base.
 */
export async function enregistrerProfil(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const id = requis(fd, 'profil_id')
  const libelle = requis(fd, 'libelle')
  if (libelle.length < 2) return { error: 'Le libellé est obligatoire.' }
  const supabase = await createClient()
  const { data: profil } = await supabase.from('profils').select('role_base').eq('id', id).maybeSingle()
  if (!profil || !estRoleBase(profil.role_base)) return { error: 'Profil introuvable.' }

  const matrice: Matrice = {}
  for (const ecran of ecransDuRole(profil.role_base)) {
    for (const action of ACTIONS) {
      if (!coche(fd, `${ecran.href}|${action}`)) {
        matrice[ecran.href] = { ...matrice[ecran.href], [action]: false }
      }
    }
  }
  const { error } = await supabase
    .from('profils')
    .update({ libelle, actif: coche(fd, 'actif'), matrice_permissions: matrice })
    .eq('id', id)
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/profils')
  revalidatePath(`/admin/profils/${id}`)
  return { success: 'Profil enregistré. Les utilisateurs concernés verront le changement à leur prochain chargement de page.' }
}

export async function supprimerProfil(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const { error } = await supabase.from('profils').delete().eq('id', requis(fd, 'profil_id'))
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  revalidatePath('/admin/profils')
  redirect('/admin/profils')
}
