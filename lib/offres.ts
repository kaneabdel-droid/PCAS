import { createClient } from '@/utils/supabase/server'

export type Offre = {
  id: string
  producteur_id: string
  site_id: string
  produit_id: string
  disponibilite: 'immediate' | 'court_terme' | 'moyen_terme'
  date_disponibilite: string | null
  date_fin_validite: string | null
  prix_unitaire: number
  quantite_offerte: number
  quantite_reservee: number
  quantite_min_commande: number | null
  variete: string | null
  calibre: string | null
  qualite: string | null
  conditionnement: string | null
  description: string | null
  photos: string[]
  statut: 'brouillon' | 'publiee' | 'suspendue' | 'epuisee'
  publiee_le: string | null
  created_at: string
  produits: { nom: string; unite: string; categorie: string } | null
  sites_production: { nom: string; region: string | null } | null
}

export const SELECT_OFFRE =
  'id, producteur_id, site_id, produit_id, disponibilite, date_disponibilite, date_fin_validite, prix_unitaire, quantite_offerte, quantite_reservee, quantite_min_commande, variete, calibre, qualite, conditionnement, description, photos, statut, publiee_le, created_at, produits(nom, unite, categorie), sites_production(nom, region)'

/** Sites actifs et produits finis actifs du producteur connecté, pour le formulaire d'offre. */
export async function optionsOffre() {
  const supabase = await createClient()
  const [{ data: sites }, { data: produits }] = await Promise.all([
    supabase.from('sites_production').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('produits').select('id, nom, unite').eq('nature', 'produit_fini').eq('actif', true).order('nom'),
  ])
  return { sites: sites ?? [], produits: produits ?? [] }
}
