'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

export async function annulerCommande(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/commandes', ['client'], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const supabase = await createClient()
  const { error } = await supabase.rpc('annuler_commande', { p_commande: id, p_motif: texte(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Annulation impossible.') }
  revalidatePath('/commandes')
  revalidatePath(`/commandes/${id}`)
  return { success: 'Commande annulée.' }
}
