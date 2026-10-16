'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { refusDemo } from '@/lib/demo'
import { coche, messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'
import { envoyerEmailInvitation, envoyerEmailReinitialisation } from '@/lib/emails'
import { LIBELLES_ROLES, ROLES_PLATEFORME, estRoleBase, type RoleBase } from '@/lib/roles'
import { getContexte } from '@/lib/session'

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

function rafraichir(entrepriseId?: string | null) {
  revalidatePath('/admin/utilisateurs')
  if (entrepriseId) revalidatePath(`/admin/entreprises/${entrepriseId}`)
}

/**
 * Invitation d'un nouvel utilisateur : compte d'authentification créé par Supabase (sans dépendre d'un SMTP externe),
 * génération sécurisée du lien d'activation avec jeton vérifié par /auth/confirm, envoi de l'invitation par email (Resend),
 * puis fiche utilisateur enregistrée avec la session de l'administrateur (tracée dans le journal).
 */
export async function inviterUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const refusD = refusDemo((await getContexte()).email)
  if (refusD) return { error: refusD }
  const email = requis(fd, 'email').toLowerCase()
  const nomComplet = requis(fd, 'nom_complet')
  const role = requis(fd, 'role_base')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse email invalide.' }
  if (nomComplet.length < 2) return { error: 'Le nom complet est obligatoire.' }
  if (!estRoleBase(role)) return { error: 'Choisissez un rôle.' }
  const plateforme = ROLES_PLATEFORME.includes(role)
  const entrepriseId = plateforme ? null : texte(fd, 'entreprise_id')
  if (!plateforme && !entrepriseId) return { error: 'Ce rôle doit être rattaché à une entreprise.' }

  const filiereBrute = texte(fd, 'filiere')
  const filiere = (role === 'superviseur' || role === 'administrateur') && filiereBrute ? filiereBrute : null

  const admin = createAdminClient()
  const siteUrl = site()
  const redirectTo = `${siteUrl}/auth/confirm?next=/auth/nouveau-mot-de-passe`

  let userId: string | null = null
  let lienActivation: string | null = null

  // 1. Tenter la génération d'un lien d'invitation (crée le compte dans auth.users sans dépendre du SMTP Supabase)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: { nom_complet: nomComplet },
      redirectTo,
    },
  })

  if (!linkError && linkData?.user) {
    userId = linkData.user.id
    if (linkData.properties?.hashed_token) {
      lienActivation = `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/nouveau-mot-de-passe`
    } else {
      lienActivation = linkData.properties?.action_link ?? null
    }
  } else {
    // Si l'utilisateur existe déjà
    if (linkError && /already been registered|already registered|exists/i.test(linkError.message)) {
      return { error: 'Un compte existe déjà avec cette adresse email.' }
    }

    // Repli : créer le compte directement, puis générer le lien de récupération / activation
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { nom_complet: nomComplet },
    })

    if (createError) {
      if (/already been registered|already registered|exists/i.test(createError.message)) {
        return { error: 'Un compte existe déjà avec cette adresse email.' }
      }
      return { error: `Création du compte impossible : ${createError.message}` }
    }

    userId = createData.user.id
    const { data: recData } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    })
    if (recData?.properties?.hashed_token) {
      lienActivation = `${siteUrl}/auth/confirm?token_hash=${recData.properties.hashed_token}&type=recovery&next=/auth/nouveau-mot-de-passe`
    } else {
      lienActivation = recData?.properties?.action_link ?? null
    }
  }

  if (!userId) {
    return { error: 'Impossible d’initialiser le compte d’accès.' }
  }

  const supabase = await createClient()
  const { error: erreurFiche } = await supabase.from('utilisateurs').insert({
    id: userId,
    email,
    nom_complet: nomComplet,
    telephone: texte(fd, 'telephone'),
    fonction: texte(fd, 'fonction'),
    role_base: role,
    profil_id: texte(fd, 'profil_id'),
    entreprise_id: entrepriseId,
    filiere,
    signataire: !plateforme && coche(fd, 'signataire'),
  })
  if (erreurFiche) {
    await admin.auth.admin.deleteUser(userId)
    return { error: messageErreur(erreurFiche, 'Enregistrement de l’utilisateur impossible.') }
  }

  // Envoi de l'invitation par email (via Resend)
  if (lienActivation) {
    const roleLibelle = LIBELLES_ROLES[role] ?? role
    await envoyerEmailInvitation({
      email,
      nomComplet,
      roleLibelle,
      lienActivation,
    })
  }

  rafraichir(entrepriseId)
  redirect(entrepriseId ? `/admin/entreprises/${entrepriseId}?onglet=utilisateurs` : '/admin/utilisateurs')
}


export async function modifierUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const refusD = refusDemo((await getContexte()).email)
  if (refusD) return { error: refusD }
  const id = requis(fd, 'utilisateur_id')
  const nomComplet = requis(fd, 'nom_complet')
  const role = requis(fd, 'role_base')
  if (nomComplet.length < 2) return { error: 'Le nom complet est obligatoire.' }
  if (!estRoleBase(role)) return { error: 'Choisissez un rôle.' }
  const plateforme = ROLES_PLATEFORME.includes(role)
  const entrepriseId = plateforme ? null : texte(fd, 'entreprise_id')
  if (!plateforme && !entrepriseId) return { error: 'Ce rôle doit être rattaché à une entreprise.' }

  const filiereBrute = texte(fd, 'filiere')
  const filiere = (role === 'superviseur' || role === 'administrateur') && filiereBrute ? filiereBrute : null

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
      filiere,
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
  const refusD = refusDemo((await getContexte()).email)
  if (refusD) return { error: refusD }
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
  const refusD = refusDemo((await getContexte()).email)
  if (refusD) return { error: refusD }
  const id = requis(fd, 'utilisateur_id')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error || !data.user?.email) return { error: 'Compte introuvable.' }

  const email = data.user.email
  const siteUrl = site()
  const redirectTo = `${siteUrl}/auth/confirm?next=/auth/nouveau-mot-de-passe`

  // 1. Si l'utilisateur ne s'est jamais connecté : invitation / activation
  if (!data.user.last_sign_in_at) {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    })

    let lien = linkData?.properties?.hashed_token
      ? `${siteUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=invite&next=/auth/nouveau-mot-de-passe`
      : linkData?.properties?.action_link ?? null

    if (!lien) {
      const { data: recData } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      lien = recData?.properties?.hashed_token
        ? `${siteUrl}/auth/confirm?token_hash=${recData.properties.hashed_token}&type=recovery&next=/auth/nouveau-mot-de-passe`
        : recData?.properties?.action_link ?? null
    }

    if (!lien) {
      return { error: 'Génération du lien d’invitation impossible.' }
    }

    const { data: fiche } = await admin.from('utilisateurs').select('nom_complet, role_base').eq('id', id).maybeSingle()
    const roleLibelle = fiche?.role_base ? LIBELLES_ROLES[fiche.role_base as RoleBase] : undefined
    const emailRes = await envoyerEmailInvitation({
      email,
      nomComplet: fiche?.nom_complet ?? '',
      roleLibelle,
      lienActivation: lien,
    })

    if (!emailRes.ok) {
      return { success: `Lien généré. Note : l’envoi par email a échoué (${emailRes.error}). Lien direct : ${lien}` }
    }
    return { success: `Invitation envoyée avec succès à ${email}.` }
  }

  // 2. Si le compte a déjà été activé : réinitialisation du mot de passe
  const { data: recData, error: recErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  const lien = recData?.properties?.hashed_token
    ? `${siteUrl}/auth/confirm?token_hash=${recData.properties.hashed_token}&type=recovery&next=/auth/nouveau-mot-de-passe`
    : recData?.properties?.action_link ?? null

  if (recErr || !lien) {
    return { error: `Génération du lien impossible : ${recErr?.message ?? 'Erreur inconnue'}` }
  }

  const { data: fiche } = await admin.from('utilisateurs').select('nom_complet').eq('id', id).maybeSingle()
  const emailRes = await envoyerEmailReinitialisation({
    email,
    nomComplet: fiche?.nom_complet ?? '',
    lienReinitialisation: lien,
  })

  if (!emailRes.ok) {
    return { success: `Lien généré. Note : l’envoi par email a échoué (${emailRes.error}). Lien direct : ${lien}` }
  }
  return { success: `Lien de réinitialisation envoyé à ${email}.` }
}

export async function supprimerUtilisateur(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const refusD = refusDemo((await getContexte()).email)
  if (refusD) return { error: refusD }
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
