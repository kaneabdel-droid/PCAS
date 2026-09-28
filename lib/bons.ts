type Ton = 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'primaire'

export const STATUTS_BON: Record<string, { libelle: string; ton: Ton }> = {
  soumis: { libelle: 'À traiter', ton: 'alerte' },
  approuve: { libelle: 'Approuvé', ton: 'succes' },
  refuse: { libelle: 'Refusé', ton: 'danger' },
}

export type Bon = {
  id: string
  numero: string
  commande_id: string
  banque_id: string
  montant: number
  statut: 'soumis' | 'approuve' | 'refuse'
  reference_bancaire: string | null
  commentaire: string | null
  decide_le: string | null
  created_at: string
}
