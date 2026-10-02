import type { SupabaseClient } from '@supabase/supabase-js'
import { CATEGORIES_PRODUIT, UNITES } from '@/lib/referentiels'

export type Referentiel = { id: string; nom: string }

/**
 * Catégories et unités de vente du catalogue, gérées par l'administrateur (migration 20).
 * Tant que la migration n'est pas appliquée, on retombe sur les listes historiques de lib/referentiels.ts
 * (sans id : elles ne sont alors pas modifiables).
 */
export async function chargerReferentielsProduit(supabase: SupabaseClient) {
  const [categories, unites] = await Promise.all([
    supabase.from('categories_produit').select('id, nom').order('ordre').order('nom').returns<Referentiel[]>(),
    supabase.from('unites_produit').select('id, nom').order('ordre').order('nom').returns<Referentiel[]>(),
  ])
  return {
    categories: categories.error ? CATEGORIES_PRODUIT.map((nom) => ({ id: '', nom })) : (categories.data ?? []),
    unites: unites.error ? UNITES.map((nom) => ({ id: '', nom })) : (unites.data ?? []),
    gerables: !categories.error && !unites.error,
  }
}
