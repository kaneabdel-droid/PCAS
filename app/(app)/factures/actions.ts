'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

function rafraichir(factureId: string) {
  revalidatePath('/factures')
  revalidatePath(`/factures/${factureId}`)
  revalidatePath('/echeances')
  revalidatePath('/commandes')
}

/** Confirmation d'un paiement reçu : seul le producteur émetteur peut cocher « payé » (contrôlé en base). */
export async function marquerPayee(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/echeances', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const supabase = await createClient()
  const { error } = await supabase.rpc('marquer_echeance_payee', {
    p_echeance: requis(fd, 'echeance_id'),
    p_date: texte(fd, 'payee_le'),
    p_mode: requis(fd, 'mode_reglement'),
    p_reference: texte(fd, 'reference'),
  })
  if (error) return { error: messageErreur(error, 'Enregistrement du paiement impossible.') }
  rafraichir(requis(fd, 'facture_id'))
  return { success: 'Paiement confirmé.' }
}

export async function annulerPaiement(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/echeances', ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const supabase = await createClient()
  const { error } = await supabase.rpc('annuler_paiement_echeance', { p_echeance: requis(fd, 'echeance_id'), p_motif: requis(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Annulation impossible.') }
  rafraichir(requis(fd, 'facture_id'))
  return { success: 'Confirmation de paiement annulée.' }
}
