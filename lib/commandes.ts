// Libellés du circuit de commande et des besoins d'achat.

type Ton = 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'primaire'

export const STATUTS_COMMANDE: Record<string, { libelle: string; ton: Ton }> = {
  soumise: { libelle: 'Soumise', ton: 'info' },
  en_attente: { libelle: 'En attente', ton: 'alerte' },
  approuvee: { libelle: 'Approuvée', ton: 'primaire' },
  attente_banque: { libelle: 'Attente banque', ton: 'alerte' },
  approuvee_banque: { libelle: 'Approuvée par la banque', ton: 'primaire' },
  refusee_banque: { libelle: 'Refusée par la banque', ton: 'danger' },
  validee: { libelle: 'Validée par le producteur', ton: 'primaire' },
  refusee_producteur: { libelle: 'Refusée par le producteur', ton: 'danger' },
  en_livraison: { libelle: 'En livraison', ton: 'info' },
  livree_partiellement: { libelle: 'Livrée partiellement', ton: 'info' },
  livree: { libelle: 'Livrée', ton: 'info' },
  en_litige: { libelle: 'En litige', ton: 'danger' },
  receptionnee: { libelle: 'Réceptionnée', ton: 'succes' },
  partiellement_payee: { libelle: 'Partiellement payée', ton: 'alerte' },
  soldee: { libelle: 'Soldée', ton: 'succes' },
  refusee: { libelle: 'Refusée', ton: 'danger' },
  reorientee: { libelle: 'Réorientée', ton: 'neutre' },
  repartie: { libelle: 'Répartie', ton: 'neutre' },
  annulee: { libelle: 'Annulée', ton: 'neutre' },
}

export const ACTIONS_COMMANDE: Record<string, string> = {
  soumise: 'Commande émise par le client',
  annulee: 'Commande annulée',
  mise_en_attente: 'Mise en attente',
  approuvee: 'Approuvée par le superviseur',
  reorientee: 'Réorientée vers un autre producteur',
  repartie: 'Répartie entre plusieurs producteurs',
  refusee: 'Refusée',
  approuvee_banque: 'Bon de paiement approuvé par la banque',
  refusee_banque: 'Bon de paiement refusé par la banque',
  validee: 'Validée par le producteur',
  refusee_producteur: 'Refusée par le producteur',
  livree: 'Bon de livraison émis',
  receptionnee: 'Réception approuvée',
  echeance_payee: 'Échéance payée',
  litige: 'Réception contestée par le client',
  arbitrage: 'Litige arbitré par le superviseur',
  reception_tacite: 'Réception tacite (délai dépassé)',
  facture_definitive: 'Facture définitive établie',
  paiement_annule: 'Confirmation de paiement annulée',
  soldee: 'Commande soldée',
}

export const MODES_PAIEMENT: Record<string, string> = {
  virement: 'Virement bancaire',
  cheque: 'Chèque',
  especes: 'Espèces',
  bon_banque: 'Bon de paiement bancaire',
}

export type Echeance = { pourcentage: number; delai_jours: number }

/** Conditions de paiement proposées (modifiables). Délai compté à partir de la facture définitive. */
export const ECHEANCIERS_TYPES: { cle: string; libelle: string; echeances: Echeance[] }[] = [
  { cle: 'comptant', libelle: 'Comptant à réception', echeances: [{ pourcentage: 100, delai_jours: 0 }] },
  { cle: '30j', libelle: '30 jours', echeances: [{ pourcentage: 100, delai_jours: 30 }] },
  {
    cle: '50-50',
    libelle: '50 % à réception, 50 % à 30 jours',
    echeances: [
      { pourcentage: 50, delai_jours: 0 },
      { pourcentage: 50, delai_jours: 30 },
    ],
  },
  {
    cle: 'tiers',
    libelle: 'Trois tiers : réception, 30 et 60 jours',
    echeances: [
      { pourcentage: 34, delai_jours: 0 },
      { pourcentage: 33, delai_jours: 30 },
      { pourcentage: 33, delai_jours: 60 },
    ],
  },
]

export const STATUTS_BESOIN: Record<string, { libelle: string; ton: Ton }> = {
  ouvert: { libelle: 'Ouvert', ton: 'info' },
  en_traitement: { libelle: 'En traitement', ton: 'alerte' },
  converti: { libelle: 'Converti en commande', ton: 'succes' },
  clos: { libelle: 'Clos', ton: 'neutre' },
  annule: { libelle: 'Annulé', ton: 'neutre' },
}

export const STATUTS_PROPOSITION: Record<string, { libelle: string; ton: Ton }> = {
  proposee: { libelle: 'Proposée', ton: 'info' },
  retenue: { libelle: 'Retenue', ton: 'succes' },
  ecartee: { libelle: 'Écartée', ton: 'neutre' },
  retiree: { libelle: 'Retirée', ton: 'neutre' },
}

/** Étapes du circuit, pour la frise d'avancement d'une commande. */
export const ETAPES_CIRCUIT = [
  { cle: 'commande', libelle: 'Commande', statuts: ['soumise', 'en_attente'] },
  { cle: 'approbation', libelle: 'Approbation', statuts: ['approuvee', 'attente_banque', 'approuvee_banque'] },
  { cle: 'validation', libelle: 'Validation', statuts: ['validee'] },
  { cle: 'livraison', libelle: 'Livraison', statuts: ['en_livraison', 'livree_partiellement', 'livree'] },
  { cle: 'reception', libelle: 'Réception', statuts: ['en_litige', 'receptionnee'] },
  { cle: 'paiement', libelle: 'Paiement', statuts: ['partiellement_payee', 'soldee'] },
] as const

/** Conditions de commande saisies dans ChampsCommande, au format attendu par les fonctions creer_commande / retenir_proposition. */
export function lireConditions(fd: FormData) {
  const echeancier = lireEcheancier(String(fd.get('echeancier') ?? ''))
  if ('error' in echeancier) return echeancier
  const valeur = (cle: string) => {
    const v = String(fd.get(cle) ?? '').trim()
    return v === '' ? null : v
  }
  const mode = valeur('mode_paiement') ?? ''
  if (!(mode in MODES_PAIEMENT)) return { error: 'Choisissez le mode de paiement.' }
  if (mode === 'bon_banque' && !valeur('banque_id')) return { error: 'Choisissez la banque qui émettra le bon de paiement.' }
  if ((valeur('adresse_livraison') ?? '').length < 3) return { error: 'Indiquez l’adresse de livraison.' }
  return {
    parametres: {
      p_mode_paiement: mode,
      p_banque: mode === 'bon_banque' ? valeur('banque_id') : null,
      p_adresse: valeur('adresse_livraison'),
      p_region: valeur('region_livraison'),
      p_contact: valeur('contact_livraison'),
      p_date_souhaitee: valeur('date_souhaitee'),
      p_echeancier: echeancier,
      p_commentaire: valeur('commentaire'),
    },
  }
}

/** Lecture et validation de l'échéancier transmis par le formulaire (JSON). */
export function lireEcheancier(brut: string | null): Echeance[] | { error: string } {
  try {
    const liste = JSON.parse(brut ?? '[]') as Echeance[]
    if (!Array.isArray(liste) || liste.length === 0 || liste.length > 6) return { error: 'L’échéancier comporte de 1 à 6 échéances.' }
    const propres = liste.map((e) => ({ pourcentage: Number(e.pourcentage), delai_jours: Math.round(Number(e.delai_jours)) }))
    if (propres.some((e) => !(e.pourcentage > 0 && e.pourcentage <= 100) || !(e.delai_jours >= 0 && e.delai_jours <= 365))) {
      return { error: 'Chaque échéance a un pourcentage entre 0 et 100 et un délai entre 0 et 365 jours.' }
    }
    const somme = Math.round(propres.reduce((s, e) => s + e.pourcentage, 0) * 100) / 100
    if (somme !== 100) return { error: `Les échéances doivent totaliser 100 % (actuellement ${somme.toLocaleString('fr-FR')} %).` }
    return propres
  } catch {
    return { error: 'Échéancier invalide.' }
  }
}
