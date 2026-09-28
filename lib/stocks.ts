// Libellés et mise en forme des stocks et des offres.

export type Nature = 'matiere_premiere' | 'produit_fini'

export const MOTIFS: Record<string, string> = {
  recolte: 'Récolte',
  achat: 'Achat',
  production: 'Production',
  transformation: 'Transformation',
  perte: 'Perte / avarie',
  don: 'Don',
  inventaire: 'Inventaire',
  livraison: 'Livraison',
  reservation: 'Réservation',
  liberation: 'Libération',
  autre: 'Autre',
}

/** Motifs proposés à la saisie manuelle, selon le sens et la nature du produit. */
export const MOTIFS_SAISIE = {
  entree: { matiere_premiere: ['recolte', 'achat', 'autre'], produit_fini: ['production', 'recolte', 'achat', 'autre'] },
  sortie: { matiere_premiere: ['perte', 'don', 'autre'], produit_fini: ['perte', 'don', 'autre'] },
} as const

export const TYPES_MOUVEMENT: Record<string, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
  ajustement: 'Inventaire',
  reservation: 'Réservation',
  liberation: 'Libération',
}

export const DISPONIBILITES: Record<string, string> = {
  immediate: 'Disponible maintenant',
  court_terme: 'Court terme',
  moyen_terme: 'Moyen terme',
}

export const STATUTS_OFFRE: Record<string, { libelle: string; ton: 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'primaire' }> = {
  brouillon: { libelle: 'Brouillon', ton: 'neutre' },
  publiee: { libelle: 'Publiée', ton: 'succes' },
  suspendue: { libelle: 'Suspendue', ton: 'alerte' },
  epuisee: { libelle: 'Épuisée', ton: 'danger' },
}

/** Quantité en français, jusqu'à 3 décimales, avec son unité. */
export function formatQuantite(valeur: number | string | null | undefined, unite?: string | null) {
  const n = Number(valeur ?? 0)
  const texte = n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
  return unite ? `${texte} ${unite}` : texte
}

/** URL publique d'une photo d'offre (bucket « offres »). */
export function urlPhotoOffre(chemin: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/offres/${chemin}`
}
