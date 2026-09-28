import QRCode from 'qrcode'
import { createClient } from '@/utils/supabase/server'

export type TypeDocument = 'commande' | 'bon_paiement' | 'bon_livraison' | 'bon_reception' | 'facture'

/** Adresse publique de vérification d'un document. */
export function urlVerification(jeton: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${site.replace(/\/$/, '')}/v/${jeton}`
}

/** QR code en SVG (net à toutes les tailles, écrans Retina et impression). */
export async function qrSvg(texte: string) {
  return QRCode.toString(texte, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#13201A', light: '#FFFFFF' } })
}

/** Jeton public d'un document (null tant que la transaction d'émission n'est pas terminée ou si non visible). */
export async function jetonDocument(type: TypeDocument, documentId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('documents').select('jeton_public').eq('type', type).eq('document_id', documentId).maybeSingle()
  return data?.jeton_public ?? null
}
