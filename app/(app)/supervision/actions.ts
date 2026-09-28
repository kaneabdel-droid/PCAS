'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { messageErreur, requis, texte, type Resultat } from '@/lib/formulaire'

const HREF = '/supervision/approbations'
const ROLES = ['superviseur', 'administrateur'] as const

function rafraichir(id: string) {
  revalidatePath(HREF)
  revalidatePath(`${HREF}/${id}`)
  revalidatePath('/commandes')
  revalidatePath(`/commandes/${id}`)
}

export async function approuver(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit(HREF, [...ROLES], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const date = texte(fd, 'date_convenue')
  if (!date) return { error: 'Fixez la date de livraison convenue.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('approuver_commande', { p_commande: id, p_date_convenue: date, p_commentaire: texte(fd, 'commentaire') })
  if (error) return { error: messageErreur(error, 'Approbation impossible.') }
  rafraichir(id)
  redirect(HREF)
}

export async function mettreEnAttente(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit(HREF, [...ROLES], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const supabase = await createClient()
  const { error } = await supabase.rpc('mettre_en_attente', { p_commande: id, p_motif: requis(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Mise en attente impossible.') }
  rafraichir(id)
  return { success: 'Commande mise en attente. Le client en est informé sur le suivi de sa commande.' }
}

export async function refuser(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit(HREF, [...ROLES], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const supabase = await createClient()
  const { error } = await supabase.rpc('refuser_commande', { p_commande: id, p_motif: requis(fd, 'motif') })
  if (error) return { error: messageErreur(error, 'Refus impossible.') }
  rafraichir(id)
  redirect(HREF)
}

/**
 * Réorientation ou répartition. Les champs « q:<ligne_id>:<offre_id> » portent la quantité affectée à chaque offre ;
 * « q:<ligne_id>:origine » la quantité laissée chez le producteur d'origine.
 */
export async function repartir(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit(HREF, [...ROLES], 'modifier')
  if (refus) return { error: refus }
  const id = requis(fd, 'commande_id')
  const affectations: { ligne_id: string; offre_id: string | null; quantite: number }[] = []
  for (const [cle, valeur] of fd.entries()) {
    if (!cle.startsWith('q:')) continue
    const quantite = Number(String(valeur).replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(quantite) || quantite <= 0) continue
    const [, ligneId, cible] = cle.split(':')
    affectations.push({ ligne_id: ligneId, offre_id: cible === 'origine' ? null : cible, quantite })
  }
  if (affectations.length === 0) return { error: 'Indiquez les quantités à affecter.' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('repartir_commande', {
    p_commande: id,
    p_affectations: affectations,
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Répartition impossible.') }
  rafraichir(id)
  revalidatePath('/commandes')
  return { success: `${data} nouvelle(s) commande(s) créée(s), à approuver dans la file.` }
}
