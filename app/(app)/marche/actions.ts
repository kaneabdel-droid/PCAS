'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { lireConditions } from '@/lib/commandes'
import { messageErreur, nombre, requis, type Resultat } from '@/lib/formulaire'
import { getContexte } from '@/lib/session'

export async function ajouterAuPanier(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/marche', ['client'])
  if (refus) return { error: refus }
  const offreId = requis(fd, 'offre_id')
  const quantite = nombre(fd, 'quantite')
  if (!quantite || quantite <= 0) return { error: 'Indiquez une quantité supérieure à zéro.' }

  const supabase = await createClient()
  const { data: disponible } = await supabase.rpc('quantite_commandable', { p_offre: offreId })
  const { data: offre } = await supabase.from('offres').select('quantite_min_commande').eq('id', offreId).maybeSingle()
  if (!offre) return { error: 'Cette offre n’est plus disponible.' }
  if (offre.quantite_min_commande && quantite < Number(offre.quantite_min_commande)) {
    return { error: `Quantité minimale : ${Number(offre.quantite_min_commande).toLocaleString('fr-FR')}.` }
  }
  if (quantite > Number(disponible ?? 0)) {
    return { error: `Quantité disponible : ${Number(disponible ?? 0).toLocaleString('fr-FR')}.` }
  }
  const ctx = await getContexte()
  const { error } = await supabase
    .from('paniers')
    .upsert({ utilisateur_id: ctx.userId, offre_id: offreId, quantite }, { onConflict: 'utilisateur_id,offre_id' })
  if (error) return { error: messageErreur(error, 'Ajout au panier impossible.') }
  revalidatePath('/panier')
  return { success: 'Ajouté au panier.' }
}

export async function retirerDuPanier(fd: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('paniers').delete().eq('utilisateur_id', ctx.userId).eq('offre_id', requis(fd, 'offre_id'))
  if (error) return { error: messageErreur(error, 'Retrait impossible.') }
  revalidatePath('/panier')
  return {}
}

/** Commande des lignes du panier d'un même producteur ; les lignes commandées quittent le panier. */
export async function commanderProducteur(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/commandes', ['client'])
  if (refus) return { error: refus }
  const producteurId = requis(fd, 'producteur_id')
  const conditions = lireConditions(fd)
  if ('error' in conditions) return { error: conditions.error }

  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: panier } = await supabase
    .from('paniers')
    .select('offre_id, quantite, offres!inner(producteur_id)')
    .eq('utilisateur_id', ctx.userId)
    .eq('offres.producteur_id', producteurId)
  if (!panier?.length) return { error: 'Aucune ligne de ce producteur dans votre panier.' }

  const { data: commandeId, error } = await supabase.rpc('creer_commande', {
    p_producteur: producteurId,
    p_lignes: panier.map((l) => ({ offre_id: l.offre_id, quantite: Number(l.quantite) })),
    ...conditions.parametres,
  })
  if (error) return { error: messageErreur(error, 'Commande impossible.') }

  await supabase
    .from('paniers')
    .delete()
    .eq('utilisateur_id', ctx.userId)
    .in(
      'offre_id',
      panier.map((l) => l.offre_id)
    )
  revalidatePath('/panier')
  revalidatePath('/commandes')
  redirect(`/commandes/${commandeId}`)
}
