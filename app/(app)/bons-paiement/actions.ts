'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

/** Approbation (avec référence bancaire) ou refus (avec motif) d'un bon de paiement par la banque. */
export async function deciderBon(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/bons-paiement', ['financier'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'bon_id')
  const decision = requis(fd, 'decision')
  if (decision !== 'approuve' && decision !== 'refuse') return { error: 'Décision inconnue.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('decider_bon_paiement', {
    p_bon: id,
    p_decision: decision,
    p_reference: texte(fd, 'reference_bancaire'),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Enregistrement de la décision impossible.') }
  revalidatePath('/bons-paiement')
  revalidatePath(`/bons-paiement/${id}`)
  revalidatePath('/commandes')
  return {
    success:
      decision === 'approuve'
        ? 'Bon de paiement approuvé : la commande est transmise au producteur.'
        : 'Bon de paiement refusé : la commande revient au superviseur.',
  }
}
