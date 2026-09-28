import { createClient } from '@/utils/supabase/server'
import { dateDans } from '@/lib/utils'

/** Résultat de analyse_capacite() pour un producteur, un produit et une date. */
export type Analyse = {
  stock_disponible: number
  potentiel_matiere: number
  transforme: boolean
  capacite_periode: number
  production_attendue: number
  disponible_total: number
  engage: number
  marge: number
}

export type Alternative = {
  producteur_id: string
  denomination: string
  region: string | null
  offre_id: string
  prix_unitaire: number
  quantite_commandable: number
  date_disponibilite: string | null
  marge: number | null
}

/** Statuts des commandes que le superviseur doit traiter. */
export const STATUTS_A_TRAITER = ['soumise', 'en_attente', 'refusee_producteur', 'refusee_banque']

export async function analyser(producteurId: string, produitId: string, date: string, exclure?: string): Promise<Analyse | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('analyse_capacite', { p_producteur: producteurId, p_produit: produitId, p_date: date, p_exclure: exclure ?? null })
    .maybeSingle()
  if (!data) return null
  const a = data as Record<string, unknown>
  return {
    stock_disponible: Number(a.stock_disponible),
    potentiel_matiere: Number(a.potentiel_matiere),
    transforme: Boolean(a.transforme),
    capacite_periode: Number(a.capacite_periode),
    production_attendue: Number(a.production_attendue),
    disponible_total: Number(a.disponible_total),
    engage: Number(a.engage),
    marge: Number(a.marge),
  }
}

/**
 * Niveau de risque d'une commande de `quantite` compte tenu de l'analyse :
 * vert si la marge restante après la commande est d'au moins 10 % du disponible, orange si elle est positive mais faible,
 * rouge si le producteur ne peut pas honorer la quantité.
 */
export function niveauRisque(analyse: Analyse, quantite: number): 'ok' | 'juste' | 'insuffisant' {
  const reste = analyse.marge - quantite
  if (reste < 0) return 'insuffisant'
  if (analyse.disponible_total > 0 && reste < analyse.disponible_total * 0.1) return 'juste'
  return 'ok'
}

/** Date d'analyse par défaut : date convenue, sinon souhaitée, sinon dans 7 jours. */
export function dateAnalyse(convenue: string | null, souhaitee: string | null) {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const candidate = convenue ?? souhaitee
  if (candidate && candidate >= aujourdhui) return candidate
  return dateDans(7)
}
