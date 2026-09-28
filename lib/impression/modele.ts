// Modèle commun d'un document imprimable (commande, bon de paiement, bon de livraison, bon de réception, facture) :
// une seule description, rendue en HTML A4 pour l'impression et en PDF (jsPDF) pour le téléchargement.

export type PartieDocument = {
  role: string
  nom: string
  lignes: string[]
  logo: string | null
}

export type ModeleDocument = {
  titre: string
  numero: string
  date: string
  /** Mention en filigrane (facture provisoire). */
  filigrane?: string
  parties: PartieDocument[]
  infos: [string, string][]
  colonnes: { libelle: string; nombre?: boolean }[]
  lignes: string[][]
  totaux: [string, string][]
  enLettres?: string
  blocs: { titre: string; lignes: string[] }[]
  visas: string[]
  mentions: string | null
  qr: { url: string; jeton: string } | null
  nomFichier: string
}

/** jsPDF (police Helvetica standard) ne connaît pas les espaces insécables produites par toLocaleString. */
export function textePdf(texte: string) {
  return texte.replace(/[   ]/g, ' ')
}
