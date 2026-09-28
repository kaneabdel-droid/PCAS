import { createClient } from '@/utils/supabase/server'

/** Offre telle que la voit un client sur la place de marché (fonction marche_offres, sans stock ni contact). */
export type OffreMarche = {
  id: string
  producteur_id: string
  producteur_nom: string
  producteur_logo: string | null
  region: string | null
  commune: string | null
  produit_id: string
  produit_nom: string
  categorie: string
  unite: string
  prix_unitaire: number
  disponibilite: 'immediate' | 'court_terme' | 'moyen_terme'
  date_disponibilite: string | null
  date_fin_validite: string | null
  quantite_commandable: number
  quantite_min_commande: number | null
  variete: string | null
  calibre: string | null
  qualite: string | null
  conditionnement: string | null
  description: string | null
  photos: string[]
  publiee_le: string | null
}

/** Entreprise du client connecté (adresse de livraison par défaut) et banques inscrites (bon de paiement). */
export async function contexteCommande(entrepriseId: string) {
  const supabase = await createClient()
  const [{ data: entreprise }, { data: banques }] = await Promise.all([
    supabase.from('entreprises').select('adresse, commune, region').eq('id', entrepriseId).maybeSingle(),
    supabase.rpc('banques_publiques').select('id, denomination').order('denomination'),
  ])
  return {
    adresse: [entreprise?.adresse, entreprise?.commune].filter(Boolean).join(', ') || null,
    region: entreprise?.region ?? null,
    banques: (banques ?? []) as { id: string; denomination: string }[],
  }
}
