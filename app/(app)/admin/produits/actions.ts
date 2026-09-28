'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { estAdmin } from '@/lib/admin'
import { coche, messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { CATEGORIES_PRODUIT, NATURES_PRODUIT, UNITES } from '@/lib/referentiels'

function lireProduit(fd: FormData) {
  const nom = requis(fd, 'nom')
  const categorie = requis(fd, 'categorie')
  const nature = requis(fd, 'nature')
  const unite = requis(fd, 'unite')
  if (nom.length < 2) return { error: 'Le nom est obligatoire.' } as const
  if (!(CATEGORIES_PRODUIT as readonly string[]).includes(categorie)) return { error: 'Catégorie inconnue.' } as const
  if (!(nature in NATURES_PRODUIT)) return { error: 'Nature inconnue.' } as const
  if (!(UNITES as readonly string[]).includes(unite)) return { error: 'Unité inconnue.' } as const
  return { valeurs: { nom, categorie, nature, unite, description: texte(fd, 'description') } } as const
}

export async function creerProduit(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const produit = lireProduit(fd)
  if ('error' in produit) return { error: produit.error }
  const supabase = await createClient()
  const { error } = await supabase.from('produits').insert(produit.valeurs)
  if (error) return { error: messageErreur(error, 'Création impossible.') }
  revalidatePath('/admin/produits')
  return { success: `« ${produit.valeurs.nom} » ajouté au catalogue.` }
}

export async function modifierProduit(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const produit = lireProduit(fd)
  if ('error' in produit) return { error: produit.error }
  const supabase = await createClient()
  const { error } = await supabase
    .from('produits')
    .update({ ...produit.valeurs, actif: coche(fd, 'actif') })
    .eq('id', requis(fd, 'produit_id'))
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/produits')
  return { success: 'Produit enregistré.' }
}

export async function enregistrerTransformation(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const rendement = nombre(fd, 'rendement')
  if (!rendement || rendement <= 0 || rendement > 10000) return { error: 'Rendement invalide.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('transformations')
    .upsert(
      { matiere_id: requis(fd, 'matiere_id'), produit_id: requis(fd, 'produit_id'), rendement },
      { onConflict: 'matiere_id,produit_id' }
    )
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/produits')
  return { success: 'Rendement enregistré.' }
}

export async function supprimerTransformation(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const { error } = await supabase.from('transformations').delete().eq('id', requis(fd, 'transformation_id'))
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  revalidatePath('/admin/produits')
  return { success: 'Rendement supprimé.' }
}
