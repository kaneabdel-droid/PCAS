'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { estAdmin } from '@/lib/admin'
import { messageErreur, requis, type Resultat } from '@/lib/formulaire'
import { getContexte } from '@/lib/session'

export async function traiterDemande(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const statut = requis(fd, 'statut')
  if (!['nouvelle', 'traitee', 'rejetee'].includes(statut)) return { error: 'Statut inconnu.' }
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase
    .from('demandes_acces')
    .update({
      statut,
      traitee_par: statut === 'nouvelle' ? null : ctx.userId,
      traitee_le: statut === 'nouvelle' ? null : new Date().toISOString(),
    })
    .eq('id', requis(fd, 'demande_id'))
  if (error) return { error: messageErreur(error, 'Modification impossible.') }
  revalidatePath('/admin/demandes')
  return {}
}
