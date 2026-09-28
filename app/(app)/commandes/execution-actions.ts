'use server'

// Actions du producteur sur une commande approuvée : validation (réservation), refus, livraison, regroupement de factures.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { lireQuantites } from '@/lib/execution'
import { coche, messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

function rafraichir(id: string) {
  revalidatePath('/commandes')
  revalidatePath(`/commandes/${id}`)
  revalidatePath('/livraisons')
  revalidatePath('/factures')
  revalidatePath('/stocks/produits')
  revalidatePath('/offres')
}

export async function validerCommande(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/commandes', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const supabase = await createClient()
  const { error } = await supabase.rpc('valider_commande', {
    p_commande: id,
    p_facturation_groupee: coche(fd, 'facturation_groupee'),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Validation impossible.') }
  rafraichir(id)
  return { success: 'Commande validée : le stock est réservé pour ce client.' }
}

export async function refuserCommandeProducteur(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/commandes', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const supabase = await createClient()
  const { error } = await supabase.rpc('refuser_par_producteur', { p_commande: id, p_motif: requis(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Refus impossible.') }
  rafraichir(id)
  return { success: 'Commande refusée : elle revient au superviseur.' }
}

export async function emettreBonLivraison(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/livraisons', ['producteur'])
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const lignes = lireQuantites(fd, 'livre').filter((l) => l.quantite > 0)
  if (lignes.length === 0) return { error: 'Indiquez au moins une quantité livrée.' }
  const supabase = await createClient()
  const { data: blId, error } = await supabase.rpc('emettre_bl', {
    p_commande: id,
    p_lignes: lignes.map((l) => ({ ligne_id: l.id, quantite: l.quantite })),
    p_date: texte(fd, 'date_livraison'),
    p_transporteur: texte(fd, 'transporteur'),
    p_immatriculation: texte(fd, 'immatriculation'),
    p_chauffeur: texte(fd, 'chauffeur'),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Émission du bon de livraison impossible.') }
  rafraichir(id)
  redirect(`/livraisons/${blId}`)
}

export async function regrouperFactures(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/factures', ['producteur'])
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const provisoires = fd.getAll('provisoire').map(String).filter(Boolean)
  if (provisoires.length === 0) return { error: 'Cochez les factures provisoires à regrouper.' }
  const supabase = await createClient()
  const { data: factureId, error } = await supabase.rpc('regrouper_factures', { p_commande: id, p_provisoires: provisoires })
  if (error) return { error: messageErreur(error, 'Regroupement impossible.') }
  rafraichir(id)
  redirect(`/factures/${factureId}`)
}
