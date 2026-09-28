// Listes de référence (Sénégal).

export const REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kédougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sédhiou',
  'Tambacounda',
  'Thiès',
  'Ziguinchor',
] as const

export const FORMES_JURIDIQUES = ['SA', 'SAS', 'SARL', 'SUARL', 'GIE', 'Coopérative', 'Entreprise individuelle', 'Autre']

export const TYPES_IDENTIFIANT = ['NINEA', 'NIF', 'Autre']

export const CATEGORIES_PRODUIT = ['Céréales', 'Légumes', 'Tubercules', 'Fruits', 'Fruits à coque', 'Autres'] as const

export const UNITES = ['kg', 'tonne', 'sac de 25 kg', 'sac de 50 kg', 'caisse', 'régime', 'pièce'] as const

export const NATURES_PRODUIT: Record<string, string> = {
  matiere_premiere: 'Matière première',
  produit_fini: 'Produit fini',
}

/** URL publique d'un logo stocké dans le bucket « logos ». */
export function urlLogo(chemin: string | null | undefined): string | null {
  if (!chemin) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${chemin}`
}
