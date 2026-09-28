'use server'

// Réception : approbation (quantités corrigées et motifs), contestation par le client, arbitrage par le superviseur.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { lireQuantites } from '@/lib/execution'
import { messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

function rafraichir(blId: string, commandeId: string) {
  revalidatePath('/livraisons')
  revalidatePath(`/livraisons/${blId}`)
  revalidatePath(`/commandes/${commandeId}`)
  revalidatePath('/commandes')
  revalidatePath('/factures')
  revalidatePath('/echeances')
  revalidatePath('/supervision/litiges')
}

export async function approuverReception(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/livraisons', ['client'], 'modifier')
  if (refus) return { error: refus }
  const lignes = lireQuantites(fd, 'recu')
  const supabase = await createClient()
  const { error } = await supabase.rpc('valider_reception', {
    p_br: requis(fd, 'br_id'),
    p_lignes: lignes.map((l) => ({ bl_ligne_id: l.id, quantite_recue: l.quantite, motif: l.motif })),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Enregistrement de la réception impossible.') }
  rafraichir(requis(fd, 'bl_id'), requis(fd, 'commande_id'))
  return { success: 'Réception enregistrée. La facture définitive est établie sur les quantités reçues.' }
}

export async function contesterReception(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/livraisons', ['client'], 'modifier')
  if (refus) return { error: refus }
  const supabase = await createClient()
  const { error } = await supabase.rpc('contester_reception', { p_br: requis(fd, 'br_id'), p_motif: requis(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Contestation impossible.') }
  rafraichir(requis(fd, 'bl_id'), requis(fd, 'commande_id'))
  return { success: 'Contestation enregistrée : le superviseur va arbitrer.' }
}

export async function arbitrerLitige(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/supervision/litiges', ['superviseur', 'administrateur'], 'modifier')
  if (refus) return { error: refus }
  const lignes = lireQuantites(fd, 'recu')
  const supabase = await createClient()
  const { error } = await supabase.rpc('arbitrer_litige', {
    p_br: requis(fd, 'br_id'),
    p_lignes: lignes.map((l) => ({ bl_ligne_id: l.id, quantite_recue: l.quantite, motif: l.motif })),
    p_commentaire: requis(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Arbitrage impossible.') }
  rafraichir(requis(fd, 'bl_id'), requis(fd, 'commande_id'))
  return { success: 'Arbitrage enregistré : la facture définitive est établie sur les quantités retenues.' }
}
