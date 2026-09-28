'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { estAdmin } from '@/lib/admin'
import { messageErreur, requis, type Resultat } from '@/lib/formulaire'

/** Nouveau brouillon d'un contrat, à partir du texte de la version en vigueur. */
export async function creerBrouillon(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const type = requis(fd, 'type')
  const version = requis(fd, 'version')
  if (type !== 'producteur' && type !== 'client') return { error: 'Type de contrat inconnu.' }
  if (!version) return { error: 'Indiquez le numéro de version (ex. 1.1).' }
  const supabase = await createClient()
  const { data: base } = await supabase
    .from('modeles_contrat')
    .select('titre, contenu')
    .eq('type', type)
    .eq('statut', 'en_vigueur')
    .maybeSingle()
  const { data, error } = await supabase
    .from('modeles_contrat')
    .insert({
      type,
      version,
      titre: base?.titre ?? (type === 'producteur' ? 'Contrat d’engagement producteur' : 'Contrat d’engagement client'),
      contenu: base?.contenu ?? '',
    })
    .select('id')
    .single()
  if (error) return { error: messageErreur(error, 'Création impossible.') }
  revalidatePath('/admin/contrats')
  redirect(`/admin/contrats/${data.id}`)
}

export async function enregistrerBrouillon(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const titre = requis(fd, 'titre')
  const contenu = String(fd.get('contenu') ?? '').replace(/\r\n/g, '\n').trim()
  if (!titre || contenu.length < 100) return { error: 'Le titre et le texte du contrat sont obligatoires.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('modeles_contrat')
    .update({ titre, contenu })
    .eq('id', requis(fd, 'modele_id'))
    .eq('statut', 'brouillon')
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath(`/admin/contrats/${requis(fd, 'modele_id')}`)
  return { success: 'Brouillon enregistré.' }
}

/** Publication : la version en vigueur est archivée ; les entreprises devront accepter la nouvelle version. */
export async function publierContrat(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('publier_modele_contrat', { p_modele: requis(fd, 'modele_id') })
  if (error) return { error: messageErreur(error, 'Publication impossible.') }
  revalidatePath('/admin/contrats')
  revalidatePath('/', 'layout')
  return { success: 'Contrat publié. Les entreprises concernées sont invitées à l’accepter à leur prochaine connexion.' }
}

export async function supprimerBrouillon(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const { error } = await supabase.from('modeles_contrat').delete().eq('id', requis(fd, 'modele_id')).eq('statut', 'brouillon')
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  revalidatePath('/admin/contrats')
  redirect('/admin/contrats')
}
