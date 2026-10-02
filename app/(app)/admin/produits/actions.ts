'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { estAdmin } from '@/lib/admin'
import { coche, messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { NATURES_PRODUIT } from '@/lib/referentiels'
import { chargerReferentielsProduit } from '@/lib/catalogue'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function lireProduit(supabase: Supabase, fd: FormData) {
  const nom = requis(fd, 'nom')
  const categorie = requis(fd, 'categorie')
  const nature = requis(fd, 'nature')
  const unite = requis(fd, 'unite')
  const { categories, unites } = await chargerReferentielsProduit(supabase)
  if (nom.length < 2) return { error: 'Le nom est obligatoire.' } as const
  if (!categories.some((c) => c.nom === categorie)) return { error: 'Catégorie inconnue.' } as const
  if (!(nature in NATURES_PRODUIT)) return { error: 'Nature inconnue.' } as const
  if (!unites.some((u) => u.nom === unite)) return { error: 'Unité inconnue.' } as const
  return { valeurs: { nom, categorie, nature, unite, description: texte(fd, 'description') } } as const
}

export async function creerProduit(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const produit = await lireProduit(supabase, fd)
  if ('error' in produit) return { error: produit.error }
  const { error } = await supabase.from('produits').insert(produit.valeurs)
  if (error) return { error: messageErreur(error, 'Création impossible.') }
  revalidatePath('/admin/produits')
  return { success: `« ${produit.valeurs.nom} » ajouté au catalogue.` }
}

export async function modifierProduit(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const supabase = await createClient()
  const produit = await lireProduit(supabase, fd)
  if ('error' in produit) return { error: produit.error }
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

// Catégories et unités de vente (tables de référence, migration 20).
const REFERENTIELS = {
  categories_produit: { libelle: 'Catégorie', min: 2, max: 60 },
  unites_produit: { libelle: 'Unité', min: 1, max: 40 },
} as const

function lireTable(fd: FormData) {
  const table = requis(fd, 'table')
  return table in REFERENTIELS ? (table as keyof typeof REFERENTIELS) : null
}

/** Ajoute une catégorie ou une unité, ou la renomme si `id` est fourni (le nouveau nom se répercute sur les produits). */
export async function enregistrerReferentiel(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const table = lireTable(fd)
  if (!table) return { error: 'Liste inconnue.' }
  const { libelle, min, max } = REFERENTIELS[table]
  const nom = requis(fd, 'nom').replace(/\s+/g, ' ')
  if (nom.length < min || nom.length > max) return { error: `${libelle} : entre ${min} et ${max} caractères.` }
  const id = texte(fd, 'id')
  const supabase = await createClient()
  const { error } = id ? await supabase.from(table).update({ nom }).eq('id', id) : await supabase.from(table).insert({ nom })
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/produits')
  revalidatePath('/marche')
  return { success: id ? `${libelle} renommée en « ${nom} ».` : `« ${nom} » ajoutée.` }
}

export async function supprimerReferentiel(fd: FormData): Promise<Resultat> {
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const table = lireTable(fd)
  if (!table) return { error: 'Liste inconnue.' }
  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', requis(fd, 'id'))
  if (error?.code === '23503')
    return { error: `Des produits utilisent encore cette ${REFERENTIELS[table].libelle.toLowerCase()} : changez-les d’abord.` }
  if (error) return { error: messageErreur(error, 'Suppression impossible.') }
  revalidatePath('/admin/produits')
  revalidatePath('/marche')
  return { success: 'Supprimée.' }
}
