'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import type { Resultat } from '@/lib/formulaire'

export async function toutMarquerLu(): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ lu_le: new Date().toISOString() })
    .eq('destinataire_id', ctx.userId)
    .is('lu_le', null)
  if (error) return { error: 'Mise à jour impossible.' }
  revalidatePath('/', 'layout')
  return {}
}

/** Ouverture d'une notification : marquée comme lue. */
export async function marquerLue(id: string) {
  const supabase = await createClient()
  await supabase.from('notifications').update({ lu_le: new Date().toISOString() }).eq('id', id).is('lu_le', null)
  revalidatePath('/', 'layout')
}
