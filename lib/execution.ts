// Libellés de l'exécution des commandes : réceptions, factures, échéances.

type Ton = 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'primaire'

export const STATUTS_RECEPTION: Record<string, { libelle: string; ton: Ton }> = {
  en_attente: { libelle: 'Réception à confirmer', ton: 'alerte' },
  approuve: { libelle: 'Réception approuvée', ton: 'succes' },
  approuve_avec_reserves: { libelle: 'Approuvée avec réserves', ton: 'alerte' },
  tacite: { libelle: 'Réception tacite', ton: 'info' },
  en_litige: { libelle: 'En litige', ton: 'danger' },
  arbitre: { libelle: 'Arbitrée', ton: 'primaire' },
}

export const STATUTS_FACTURE: Record<string, { libelle: string; ton: Ton }> = {
  provisoire: { libelle: 'Provisoire', ton: 'neutre' },
  receptionnee: { libelle: 'Provisoire réceptionnée', ton: 'info' },
  remplacee: { libelle: 'Remplacée', ton: 'neutre' },
  definitive: { libelle: 'À payer', ton: 'alerte' },
  partiellement_payee: { libelle: 'Partiellement payée', ton: 'info' },
  payee: { libelle: 'Payée', ton: 'succes' },
  annulee: { libelle: 'Annulée', ton: 'neutre' },
}

export const STATUTS_ECHEANCE: Record<string, { libelle: string; ton: Ton }> = {
  a_payer: { libelle: 'À payer', ton: 'alerte' },
  en_retard: { libelle: 'En retard', ton: 'danger' },
  payee: { libelle: 'Payée', ton: 'succes' },
}

export const MODES_REGLEMENT: Record<string, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  bon_banque: 'Bon de paiement bancaire',
  autre: 'Autre',
}

/** Lignes « quantité par identifiant » d'un formulaire : champs nommés `<prefixe>:<id>`. */
export function lireQuantites(fd: FormData, prefixe: string) {
  const lignes: { id: string; quantite: number; motif: string | null }[] = []
  for (const [cle, valeur] of fd.entries()) {
    if (!cle.startsWith(`${prefixe}:`)) continue
    const id = cle.slice(prefixe.length + 1)
    const brut = String(valeur).replace(/\s/g, '').replace(',', '.')
    if (brut === '') continue
    const quantite = Number(brut)
    if (!Number.isFinite(quantite) || quantite < 0) continue
    const motif = String(fd.get(`motif:${id}`) ?? '').trim()
    lignes.push({ id, quantite, motif: motif || null })
  }
  return lignes
}
