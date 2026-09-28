'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { lireConditions } from '@/lib/commandes'
import { messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { REGIONS } from '@/lib/referentiels'

function rafraichir(id?: string) {
  revalidatePath('/besoins')
  if (id) revalidatePath(`/besoins/${id}`)
}

export async function creerBesoin(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/besoins', ['client'])
  if (refus) return { error: refus }
  const quantite = nombre(fd, 'quantite')
  const prix = nombre(fd, 'prix_cible')
  const date = texte(fd, 'date_souhaitee')
  const region = texte(fd, 'region_livraison')
  if (!requis(fd, 'produit_id')) return { error: 'Choisissez le produit.' }
  if (!quantite || quantite <= 0) return { error: 'La quantité doit être supérieure à zéro.' }
  if (prix !== null && (prix <= 0 || !Number.isInteger(prix))) return { error: 'Le prix cible est un montant entier en FCFA.' }
  if (!date) return { error: 'Indiquez la date souhaitée.' }
  if (region && !(REGIONS as readonly string[]).includes(region)) return { error: 'Région inconnue.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('besoins_achat')
    .insert({
      produit_id: requis(fd, 'produit_id'),
      quantite,
      prix_cible: prix,
      date_souhaitee: date,
      region_livraison: region,
      lieu_livraison: texte(fd, 'lieu_livraison'),
      producteur_souhaite_id: texte(fd, 'producteur_souhaite_id'),
      commentaire: texte(fd, 'commentaire'),
    })
    .select('id')
    .single()
  if (error) return { error: messageErreur(error, 'Publication du besoin impossible.') }
  rafraichir()
  redirect(`/besoins/${data.id}`)
}

export async function changerStatutBesoin(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/besoins', ['client'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'besoin_id')
  const statut = requis(fd, 'statut')
  if (statut !== 'annule' && statut !== 'clos') return { error: 'Statut inconnu.' }
  const supabase = await createClient()
  const { error } = await supabase.from('besoins_achat').update({ statut }).eq('id', id).in('statut', ['ouvert', 'en_traitement'])
  if (error) return { error: messageErreur(error, 'Modification impossible.') }
  rafraichir(id)
  return { success: statut === 'annule' ? 'Besoin annulé.' : 'Besoin clos.' }
}

export async function proposer(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/besoins', ['producteur'])
  if (refus) return { error: refus }
  const besoinId = requis(fd, 'besoin_id')
  const quantite = nombre(fd, 'quantite')
  const prix = nombre(fd, 'prix_unitaire')
  if (!requis(fd, 'site_id')) return { error: 'Choisissez le site de production.' }
  if (!quantite || quantite <= 0) return { error: 'La quantité proposée doit être supérieure à zéro.' }
  if (!prix || prix <= 0 || !Number.isInteger(prix)) return { error: 'Le prix unitaire est un montant entier en FCFA.' }
  const supabase = await createClient()
  const { error } = await supabase.from('propositions_besoin').insert({
    besoin_id: besoinId,
    site_id: requis(fd, 'site_id'),
    offre_id: texte(fd, 'offre_id'),
    quantite,
    prix_unitaire: prix,
    date_disponibilite: texte(fd, 'date_disponibilite'),
    commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Proposition impossible.') }
  rafraichir(besoinId)
  return { success: 'Proposition envoyée au client.' }
}

export async function retirerProposition(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/besoins', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const supabase = await createClient()
  const { error } = await supabase
    .from('propositions_besoin')
    .update({ statut: 'retiree' })
    .eq('id', requis(fd, 'proposition_id'))
    .eq('statut', 'proposee')
  if (error) return { error: messageErreur(error, 'Retrait impossible.') }
  rafraichir(requis(fd, 'besoin_id'))
  return { success: 'Proposition retirée.' }
}

/** Le client retient une proposition : une commande est émise au prix proposé, puis soumise au superviseur. */
export async function retenirProposition(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/commandes', ['client'])
  if (refus) return { error: refus }
  const quantite = nombre(fd, 'quantite')
  if (!quantite || quantite <= 0) return { error: 'Indiquez la quantité retenue.' }
  const conditions = lireConditions(fd)
  if ('error' in conditions) return { error: conditions.error }
  const supabase = await createClient()
  const { data: commandeId, error } = await supabase.rpc('retenir_proposition', {
    p_proposition: requis(fd, 'proposition_id'),
    p_quantite: quantite,
    ...conditions.parametres,
  })
  if (error) return { error: messageErreur(error, 'Commande impossible.') }
  rafraichir(requis(fd, 'besoin_id'))
  revalidatePath('/commandes')
  redirect(`/commandes/${commandeId}`)
}
