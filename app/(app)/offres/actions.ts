'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { coche, messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { getContexte } from '@/lib/session'

const TYPES_PHOTO: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function rafraichir(id?: string) {
  revalidatePath('/offres')
  if (id) revalidatePath(`/offres/${id}`)
  revalidatePath('/marche')
}

function lireOffre(fd: FormData) {
  const prix = nombre(fd, 'prix_unitaire')
  const quantite = nombre(fd, 'quantite_offerte')
  const minimum = nombre(fd, 'quantite_min_commande')
  if (!requis(fd, 'site_id') || !requis(fd, 'produit_id')) return { error: 'Choisissez le site et le produit.' } as const
  if (!prix || prix <= 0 || !Number.isInteger(prix)) return { error: 'Le prix unitaire est un montant entier en FCFA, supérieur à zéro.' } as const
  if (!quantite || quantite <= 0) return { error: 'La quantité offerte doit être supérieure à zéro.' } as const
  if (minimum !== null && (minimum <= 0 || minimum > quantite)) return { error: 'La quantité minimale doit être comprise entre zéro et la quantité offerte.' } as const
  const aDate = requis(fd, 'disponibilite') === 'a_date'
  const date = texte(fd, 'date_disponibilite')
  if (aDate && !date) return { error: 'Indiquez la date de disponibilité.' } as const
  return {
    valeurs: {
      site_id: requis(fd, 'site_id'),
      produit_id: requis(fd, 'produit_id'),
      prix_unitaire: prix,
      quantite_offerte: quantite,
      quantite_min_commande: minimum,
      date_disponibilite: aDate ? date : null,
      date_fin_validite: texte(fd, 'date_fin_validite'),
      variete: texte(fd, 'variete'),
      calibre: texte(fd, 'calibre'),
      qualite: texte(fd, 'qualite'),
      conditionnement: texte(fd, 'conditionnement'),
      description: texte(fd, 'description'),
    },
  } as const
}

export async function creerOffre(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'])
  if (refus) return { error: refus }
  const offre = lireOffre(fd)
  if ('error' in offre) return { error: offre.error }
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('offres')
    .insert({ ...offre.valeurs, producteur_id: ctx.entrepriseId, statut: coche(fd, 'publier') ? 'publiee' : 'brouillon' })
    .select('id')
    .single()
  if (error) return { error: messageErreur(error, 'Création de l’offre impossible.') }
  rafraichir()
  redirect(`/offres/${data.id}`)
}

export async function modifierOffre(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const offre = lireOffre(fd)
  if ('error' in offre) return { error: offre.error }
  const supabase = await createClient()
  const { error } = await supabase.from('offres').update(offre.valeurs).eq('id', id)
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  rafraichir(id)
  return { success: 'Offre enregistrée.' }
}

/** Publier, suspendre ou repasser en brouillon (les contrôles de stock, de capacité et de contrat sont faits en base). */
export async function changerStatutOffre(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const statut = requis(fd, 'statut')
  if (!['publiee', 'suspendue', 'brouillon'].includes(statut)) return { error: 'Statut inconnu.' }
  const supabase = await createClient()
  const { error } = await supabase.from('offres').update({ statut }).eq('id', id)
  if (error) return { error: messageErreur(error, 'Changement de statut impossible.') }
  rafraichir(id)
  return {
    success: statut === 'publiee' ? 'Offre publiée : elle est visible des clients.' : statut === 'suspendue' ? 'Offre suspendue.' : 'Offre repassée en brouillon.',
  }
}

export async function supprimerOffre(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const supabase = await createClient()
  const { data: offre } = await supabase.from('offres').select('photos').eq('id', id).maybeSingle()
  const { data, error } = await supabase.from('offres').delete().eq('id', id).select('id')
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  if (!data?.length) return { error: 'Seul un brouillon peut être supprimé : suspendez plutôt une offre publiée.' }
  if (offre?.photos?.length) await supabase.storage.from('offres').remove(offre.photos)
  rafraichir()
  redirect('/offres')
}

export async function ajouterPhoto(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const fichier = fd.get('photo')
  if (!(fichier instanceof File) || fichier.size === 0) return { error: 'Choisissez une photo.' }
  const extension = TYPES_PHOTO[fichier.type]
  if (!extension) return { error: 'Format accepté : PNG, JPEG ou WebP.' }
  if (fichier.size > 3 * 1024 * 1024) return { error: 'La photo ne doit pas dépasser 3 Mo.' }

  const supabase = await createClient()
  const { data: offre } = await supabase.from('offres').select('producteur_id, photos').eq('id', id).maybeSingle()
  if (!offre) return { error: 'Offre introuvable.' }
  if (offre.photos.length >= 6) return { error: 'Six photos au maximum par offre.' }

  const chemin = `${offre.producteur_id}/${id}/${Date.now()}.${extension}`
  const { error: erreurEnvoi } = await supabase.storage.from('offres').upload(chemin, fichier, { contentType: fichier.type })
  if (erreurEnvoi) return { error: 'Envoi de la photo impossible.' }
  const { error } = await supabase.from('offres').update({ photos: [...offre.photos, chemin] }).eq('id', id)
  if (error) {
    await supabase.storage.from('offres').remove([chemin])
    return { error: messageErreur(error, 'Enregistrement de la photo impossible.') }
  }
  rafraichir(id)
  return { success: 'Photo ajoutée.' }
}

export async function retirerPhoto(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const chemin = requis(fd, 'chemin')
  const supabase = await createClient()
  const { data: offre } = await supabase.from('offres').select('photos').eq('id', id).maybeSingle()
  if (!offre?.photos.includes(chemin)) return { error: 'Photo introuvable.' }
  const { error } = await supabase
    .from('offres')
    .update({ photos: offre.photos.filter((p: string) => p !== chemin) })
    .eq('id', id)
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  await supabase.storage.from('offres').remove([chemin])
  rafraichir(id)
  return { success: 'Photo retirée.' }
}

export async function declarerProduction(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/offres', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'offre_id')
  const quantite = nombre(fd, 'quantite')
  if (!quantite || quantite <= 0) return { error: 'La quantité produite doit être supérieure à zéro.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('declarer_production', {
    p_offre: id,
    p_quantite: quantite,
    p_date: texte(fd, 'date_production'),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Déclaration impossible.') }
  rafraichir(id)
  revalidatePath('/stocks/produits')
  return { success: 'Production déclarée : le stock de produits finis est mis à jour.' }
}
