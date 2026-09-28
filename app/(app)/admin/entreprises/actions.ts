'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estAdmin } from '@/lib/admin'
import { demoActive, MESSAGE_DEMO } from '@/lib/demo'
import { lireFiche } from '@/lib/fiche'
import { messageErreur, requis, type Resultat } from '@/lib/formulaire'
import { LIBELLES_TYPES_ENTREPRISE } from '@/lib/roles'

export async function creerEntreprise(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const type = requis(fd, 'type')
  if (!(type in LIBELLES_TYPES_ENTREPRISE)) return { error: 'Choisissez le type d’entreprise.' }
  const lecture = lireFiche(fd)
  if ('error' in lecture) return lecture

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('entreprises')
    .insert({ type, ...lecture.valeurs })
    .select('id')
    .single()
  if (error) return { error: messageErreur(error, 'Création impossible.') }

  const demande = requis(fd, 'demande_id')
  if (demande) {
    await supabase
      .from('demandes_acces')
      .update({ statut: 'traitee', traitee_le: new Date().toISOString() })
      .eq('id', demande)
    revalidatePath('/admin/demandes')
  }
  revalidatePath('/admin/entreprises')
  redirect(`/admin/entreprises/${data.id}?onglet=utilisateurs`)
}

export async function changerStatutEntreprise(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  if (demoActive()) return { error: MESSAGE_DEMO }
  const id = requis(fd, 'entreprise_id')
  const statut = requis(fd, 'statut')
  if (statut !== 'actif' && statut !== 'suspendu') return { error: 'Statut inconnu.' }
  const supabase = await createClient()
  const { error } = await supabase.from('entreprises').update({ statut }).eq('id', id)
  if (error) return { error: messageErreur(error, 'Modification impossible.') }
  revalidatePath(`/admin/entreprises/${id}`)
  revalidatePath('/admin/entreprises')
  return {
    success:
      statut === 'suspendu'
        ? 'Entreprise suspendue : ses utilisateurs n’ont plus accès à la plateforme.'
        : 'Entreprise réactivée.',
  }
}

/**
 * Suppression définitive : confirmée par la saisie exacte de la dénomination. Les fiches utilisateurs sont supprimées
 * avec la session de l'administrateur (tracées dans le journal), puis leurs comptes d'authentification avec la clé de service.
 * Une entreprise qui a un historique (commandes, factures, contrat accepté) ne peut pas être supprimée : on la suspend.
 */
export async function supprimerEntreprise(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  if (demoActive()) return { error: MESSAGE_DEMO }
  const id = requis(fd, 'entreprise_id')
  const supabase = await createClient()
  const { data: entreprise } = await supabase.from('entreprises').select('denomination').eq('id', id).maybeSingle()
  if (!entreprise) return { error: 'Entreprise introuvable.' }
  if (requis(fd, 'confirmation') !== entreprise.denomination) {
    return { error: 'Saisissez exactement la dénomination de l’entreprise pour confirmer la suppression.' }
  }

  const { count: acceptations } = await supabase
    .from('acceptations_contrat')
    .select('id', { count: 'exact', head: true })
    .eq('entreprise_id', id)
  if (acceptations) {
    return { error: 'Cette entreprise a accepté un contrat d’engagement : son historique doit être conservé. Suspendez-la plutôt.' }
  }

  const { data: utilisateurs } = await supabase.from('utilisateurs').select('id').eq('entreprise_id', id)
  const ids = (utilisateurs ?? []).map((u) => u.id)
  if (ids.length) {
    const { error } = await supabase.from('utilisateurs').delete().in('id', ids)
    if (error) return { error: messageErreur(error, 'Suppression des utilisateurs impossible.') }
  }
  const { error } = await supabase.from('entreprises').delete().eq('id', id)
  if (error) {
    return { error: messageErreur(error, 'Suppression impossible : l’entreprise a un historique sur la plateforme. Suspendez-la plutôt.') }
  }

  const admin = createAdminClient()
  const { data: logos } = await admin.storage.from('logos').list(id)
  if (logos?.length) await admin.storage.from('logos').remove(logos.map((f) => `${id}/${f.name}`))
  for (const uid of ids) await admin.auth.admin.deleteUser(uid)

  revalidatePath('/admin/entreprises')
  revalidatePath('/admin/utilisateurs')
  redirect('/admin/entreprises')
}
