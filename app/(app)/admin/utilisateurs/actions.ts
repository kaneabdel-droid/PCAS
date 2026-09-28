'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { coche, messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'
import { ROLES_PLATEFORME, estRoleBase } from '@/lib/roles'
import { getContexte } from '@/lib/session'

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function rafraichir(entrepriseId?: string | null) {
  revalidatePath('/admin/utilisateurs')
  if (entrepriseId) revalidatePath(`/admin/entreprises/${entrepriseId}`)
}

/**
 * Invitation d'un nouvel utilisateur : compte d'authentification créé par Supabase (email d'invitation avec lien pour
 * choisir son mot de passe), puis fiche utilisateur enregistrée avec la session de l'administrateur (tracée dans le
 * journal). Si la fiche est refusée (rôle incompatible avec l'entreprise…), le compte d'authentification est supprimé.
 */
export async function inviterUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const email = requis(fd, 'email').toLowerCase()
  const nomComplet = requis(fd, 'nom_complet')
  const role = requis(fd, 'role_base')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse email invalide.' }
  if (nomComplet.length < 2) return { error: 'Le nom complet est obligatoire.' }
  if (!estRoleBase(role)) return { error: 'Choisissez un rôle.' }
  const plateforme = ROLES_PLATEFORME.includes(role)
  const entrepriseId = plateforme ? null : texte(fd, 'entreprise_id')
  if (!plateforme && !entrepriseId) return { error: 'Ce rôle doit être rattaché à une entreprise.' }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nom_complet: nomComplet },
    redirectTo: `${site()}/auth/confirm?next=/auth/nouveau-mot-de-passe`,
  })
  if (error) {
    if (/already been registered|already registered|exists/i.test(error.message)) {
      return { error: 'Un compte existe déjà avec cette adresse email.' }
    }
    return { error: `Envoi de l’invitation impossible : ${error.message}` }
  }

  const supabase = await createClient()
  const { error: erreurFiche } = await supabase.from('utilisateurs').insert({
    id: data.user.id,
    email,
    nom_complet: nomComplet,
    telephone: texte(fd, 'telephone'),
    fonction: texte(fd, 'fonction'),
    role_base: role,
    profil_id: texte(fd, 'profil_id'),
    entreprise_id: entrepriseId,
    signataire: !plateforme && coche(fd, 'signataire'),
  })
  if (erreurFiche) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: messageErreur(erreurFiche, 'Enregistrement de l’utilisateur impossible.') }
  }

  rafraichir(entrepriseId)
  redirect(entrepriseId ? `/admin/entreprises/${entrepriseId}?onglet=utilisateurs` : '/admin/utilisateurs')
}

export async function modifierUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const id = requis(fd, 'utilisateur_id')
  const nomComplet = requis(fd, 'nom_complet')
  const role = requis(fd, 'role_base')
  if (nomComplet.length < 2) return { error: 'Le nom complet est obligatoire.' }
  if (!estRoleBase(role)) return { error: 'Choisissez un rôle.' }
  const plateforme = ROLES_PLATEFORME.includes(role)
  const entrepriseId = plateforme ? null : texte(fd, 'entreprise_id')
  if (!plateforme && !entrepriseId) return { error: 'Ce rôle doit être rattaché à une entreprise.' }

  const ctx = await getContexte()
  if (id === ctx.userId && role !== 'administrateur') {
    return { error: 'Vous ne pouvez pas retirer votre propre rôle d’administrateur.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('utilisateurs')
    .update({
      nom_complet: nomComplet,
      telephone: texte(fd, 'telephone'),
      fonction: texte(fd, 'fonction'),
      role_base: role,
      profil_id: texte(fd, 'profil_id'),
      entreprise_id: entrepriseId,
      signataire: !plateforme && coche(fd, 'signataire'),
    })
    .eq('id', id)
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  rafraichir(entrepriseId)
  revalidatePath(`/admin/utilisateurs/${id}`)
  return { success: 'Utilisateur enregistré.' }
}

export async function changerEtatUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const id = requis(fd, 'utilisateur_id')
  const actif = requis(fd, 'actif') === 'true'
  const ctx = await getContexte()
  if (id === ctx.userId && !actif) return { error: 'Vous ne pouvez pas désactiver votre propre compte.' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('utilisateurs').update({ actif }).eq('id', id).select('entreprise_id').single()
  if (error) return { error: messageErreur(error, 'Modification impossible.') }
  rafraichir(data.entreprise_id)
  revalidatePath(`/admin/utilisateurs/${id}`)
  return { success: actif ? 'Compte réactivé.' : 'Compte désactivé : l’utilisateur n’a plus accès à la plateforme.' }
}

/** Renvoie l'invitation (compte jamais activé) ou un lien de réinitialisation du mot de passe (compte déjà utilisé). */
export async function renvoyerLien(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const id = requis(fd, 'utilisateur_id')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user?.email) return { error: 'Compte introuvable.' }

  if (!data.user.last_sign_in_at) {
    const { error: e } = await admin.auth.admin.inviteUserByEmail(data.user.email, {
      redirectTo: `${site()}/auth/confirm?next=/auth/nouveau-mot-de-passe`,
    })
    if (e) return { error: `Renvoi de l’invitation impossible : ${e.message}` }
    return { success: `Invitation renvoyée à ${data.user.email}.` }
  }
  const supabase = await createClient()
  const { error: e } = await supabase.auth.resetPasswordForEmail(data.user.email, {
    redirectTo: `${site()}/auth/confirm?next=/auth/nouveau-mot-de-passe`,
  })
  if (e) return { error: `Envoi du lien impossible : ${e.message}` }
  return { success: `Lien de réinitialisation du mot de passe envoyé à ${data.user.email}.` }
}

export async function supprimerUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const id = requis(fd, 'utilisateur_id')
  const ctx = await getContexte()
  if (id === ctx.userId) return { error: 'Vous ne pouvez pas supprimer votre propre compte.' }
  const supabase = await createClient()
  // Suppression de la fiche avec la session de l'administrateur (tracée dans le journal), puis du compte d'authentification.
  const { data, error } = await supabase.from('utilisateurs').delete().eq('id', id).select('entreprise_id').single()
  if (error) return { error: messageErreur(error, 'Suppression impossible : désactivez plutôt le compte.') }
  const { error: e } = await createAdminClient().auth.admin.deleteUser(id)
  if (e) return { error: `Fiche supprimée, mais le compte de connexion n’a pas pu l’être : ${e.message}` }
  rafraichir(data.entreprise_id)
  redirect('/admin/utilisateurs')
}
