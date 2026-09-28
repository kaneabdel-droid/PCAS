'use server'

// Actions sur la fiche d'une entreprise, communes à l'administrateur (toute entreprise) et à l'entreprise elle-même
// (sa propre fiche). C'est la RLS qui décide : une entreprise ne peut écrire que ses propres lignes, et les triggers
// l'empêchent de changer son type ou son statut. Chaque modification est tracée dans le journal d'audit.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { REGIONS } from '@/lib/referentiels'
import { lireFiche } from '@/lib/fiche'

const TYPES_LOGO: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function rafraichir(entrepriseId: string) {
  revalidatePath('/entreprise')
  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  revalidatePath('/admin/entreprises')
}

export async function enregistrerFiche(fd: FormData): Promise<Resultat> {
  const id = requis(fd, 'entreprise_id')
  const lecture = await lireFiche(fd)
  if ('error' in lecture) return lecture
  const supabase = await createClient()
  const { data, error } = await supabase.from('entreprises').update(lecture.valeurs).eq('id', id).select('id')
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  if (!data?.length) return { error: 'Vous n’avez pas les droits pour modifier cette entreprise.' }
  rafraichir(id)
  return { success: 'Fiche enregistrée.' }
}

export async function televerserLogo(fd: FormData): Promise<Resultat> {
  const id = requis(fd, 'entreprise_id')
  const fichier = fd.get('logo')
  if (!(fichier instanceof File) || fichier.size === 0) return { error: 'Choisissez une image.' }
  const extension = TYPES_LOGO[fichier.type]
  if (!extension) return { error: 'Format accepté : PNG, JPEG ou WebP.' }
  if (fichier.size > 1024 * 1024) return { error: 'Le logo ne doit pas dépasser 1 Mo.' }

  const supabase = await createClient()
  const { data: actuelle } = await supabase.from('entreprises').select('logo_path').eq('id', id).maybeSingle()
  if (!actuelle) return { error: 'Entreprise introuvable.' }

  // Nom unique à chaque envoi : le nouveau logo s'affiche immédiatement, sans ancienne version en cache.
  const chemin = `${id}/logo-${Date.now()}.${extension}`
  const { error: erreurEnvoi } = await supabase.storage.from('logos').upload(chemin, fichier, { contentType: fichier.type })
  if (erreurEnvoi) return { error: 'Envoi du logo impossible.' }

  const { error } = await supabase.from('entreprises').update({ logo_path: chemin }).eq('id', id)
  if (error) {
    await supabase.storage.from('logos').remove([chemin])
    return { error: messageErreur(error, 'Enregistrement du logo impossible.') }
  }
  if (actuelle.logo_path) await supabase.storage.from('logos').remove([actuelle.logo_path])
  rafraichir(id)
  return { success: 'Logo mis à jour.' }
}

export async function supprimerLogo(fd: FormData): Promise<Resultat> {
  const id = requis(fd, 'entreprise_id')
  const supabase = await createClient()
  const { data: actuelle } = await supabase.from('entreprises').select('logo_path').eq('id', id).maybeSingle()
  if (!actuelle?.logo_path) return {}
  const { error } = await supabase.from('entreprises').update({ logo_path: null }).eq('id', id)
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  await supabase.storage.from('logos').remove([actuelle.logo_path])
  rafraichir(id)
  return { success: 'Logo retiré.' }
}

// ---------------------------------------------------------------------------
// Comptes bancaires
// ---------------------------------------------------------------------------

export async function ajouterCompte(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const banque = requis(fd, 'banque')
  const intitule = requis(fd, 'intitule')
  const numero = requis(fd, 'numero_compte')
  if (!banque || !intitule || !numero) return { error: 'Banque, intitulé et numéro de compte sont obligatoires.' }

  const supabase = await createClient()
  const { count } = await supabase
    .from('entreprise_comptes_bancaires')
    .select('id', { count: 'exact', head: true })
    .eq('entreprise_id', entrepriseId)
  const { error } = await supabase.from('entreprise_comptes_bancaires').insert({
    entreprise_id: entrepriseId,
    banque,
    intitule,
    numero_compte: numero.replace(/\s+/g, ' '),
    code_swift: texte(fd, 'code_swift')?.toUpperCase() ?? null,
    principal: (count ?? 0) === 0, // le premier compte devient le compte principal (celui des factures)
  })
  if (error) return { error: messageErreur(error, 'Ajout du compte impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Compte ajouté.' }
}

export async function definirComptePrincipal(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const compteId = requis(fd, 'compte_id')
  const supabase = await createClient()
  // Deux temps : l'index unique n'autorise qu'un compte principal par entreprise.
  const { error: e1 } = await supabase
    .from('entreprise_comptes_bancaires')
    .update({ principal: false })
    .eq('entreprise_id', entrepriseId)
    .eq('principal', true)
  if (e1) return { error: messageErreur(e1, 'Modification impossible.') }
  const { error: e2 } = await supabase.from('entreprise_comptes_bancaires').update({ principal: true }).eq('id', compteId)
  if (e2) return { error: messageErreur(e2, 'Modification impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Compte principal modifié.' }
}

export async function supprimerCompte(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const supabase = await createClient()
  const { error } = await supabase.from('entreprise_comptes_bancaires').delete().eq('id', requis(fd, 'compte_id'))
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Compte supprimé.' }
}

// ---------------------------------------------------------------------------
// Sites de production et capacités
// ---------------------------------------------------------------------------

function lireSite(fd: FormData) {
  const nom = requis(fd, 'nom')
  if (!nom) return { error: 'Le nom du site est obligatoire.' } as const
  const region = texte(fd, 'region')
  if (region && !(REGIONS as readonly string[]).includes(region)) return { error: 'Région inconnue.' } as const
  const jours = nombre(fd, 'jours_ouvres_semaine') ?? 6
  if (!Number.isInteger(jours) || jours < 1 || jours > 7) return { error: 'Jours ouvrés par semaine : entre 1 et 7.' } as const
  return {
    valeurs: {
      nom,
      region,
      departement: texte(fd, 'departement'),
      commune: texte(fd, 'commune'),
      localite: texte(fd, 'localite'),
      latitude: nombre(fd, 'latitude'),
      longitude: nombre(fd, 'longitude'),
      superficie_ha: nombre(fd, 'superficie_ha'),
      jours_ouvres_semaine: jours,
    },
  } as const
}

export async function ajouterSite(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const site = lireSite(fd)
  if ('error' in site) return { error: site.error }
  const supabase = await createClient()
  const { error } = await supabase.from('sites_production').insert({ entreprise_id: entrepriseId, ...site.valeurs })
  if (error) return { error: messageErreur(error, 'Ajout du site impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Site ajouté.' }
}

export async function modifierSite(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const site = lireSite(fd)
  if ('error' in site) return { error: site.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('sites_production')
    .update({ ...site.valeurs, actif: fd.get('actif') === 'on' })
    .eq('id', requis(fd, 'site_id'))
  if (error) return { error: messageErreur(error, 'Modification impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Site enregistré.' }
}

export async function supprimerSite(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const supabase = await createClient()
  const { error } = await supabase.from('sites_production').delete().eq('id', requis(fd, 'site_id'))
  if (error) return { error: messageErreur(error, 'Suppression impossible : désactivez plutôt le site.') }
  rafraichir(entrepriseId)
  return { success: 'Site supprimé.' }
}

export async function enregistrerCapacite(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const capacite = nombre(fd, 'capacite_jour')
  if (!capacite || capacite <= 0) return { error: 'Indiquez une capacité par jour supérieure à zéro.' }
  const produitId = requis(fd, 'produit_id')
  if (!produitId) return { error: 'Choisissez un produit.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('capacites_production')
    .upsert({ site_id: requis(fd, 'site_id'), produit_id: produitId, capacite_jour: capacite }, { onConflict: 'site_id,produit_id' })
  if (error) return { error: messageErreur(error, 'Enregistrement de la capacité impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Capacité enregistrée.' }
}

export async function supprimerCapacite(fd: FormData): Promise<Resultat> {
  const entrepriseId = requis(fd, 'entreprise_id')
  const supabase = await createClient()
  const { error } = await supabase.from('capacites_production').delete().eq('id', requis(fd, 'capacite_id'))
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  rafraichir(entrepriseId)
  return { success: 'Capacité retirée.' }
}
