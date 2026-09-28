'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { coche, messageErreur, requis, type Resultat } from '@/lib/formulaire'

/** Acceptation électronique du contrat d'engagement (contrôles d'habilitation et de version dans accepter_contrat()). */
export async function accepterContrat(fd: FormData): Promise<Resultat> {
  if (!coche(fd, 'lu_accepte')) return { error: 'Cochez la case « J’ai lu et j’accepte » pour signer le contrat.' }
  const entetes = await headers()
  const ip = entetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? entetes.get('x-real-ip')
  const supabase = await createClient()
  const { error } = await supabase.rpc('accepter_contrat', {
    p_modele: requis(fd, 'modele_id'),
    p_nom_signataire: requis(fd, 'nom_signataire'),
    p_fonction_signataire: requis(fd, 'fonction_signataire'),
    p_adresse_ip: ip ?? null,
    p_agent_utilisateur: entetes.get('user-agent'),
  })
  if (error) return { error: messageErreur(error, 'Acceptation impossible. Réessayez.') }
  revalidatePath('/', 'layout')
  return { success: 'Contrat accepté. Merci : vous avez désormais accès à toutes les fonctions de la plateforme.' }
}
