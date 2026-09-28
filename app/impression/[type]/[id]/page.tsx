import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { BarreDocument } from '@/components/impression/BarreDocument'
import { FeuilleDocument } from '@/components/impression/FeuilleDocument'
import { chargerModele } from '@/lib/impression/documents'
import { getContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Impression' }

const RETOURS: Record<string, (id: string) => string> = {
  commande: (id) => `/commandes/${id}`,
  bon_paiement: (id) => `/bons-paiement/${id}`,
  bon_livraison: (id) => `/livraisons/${id}`,
  bon_reception: () => '/livraisons',
  facture: (id) => `/factures/${id}`,
}

/** Image distante (logo) intégrée en données : elle s'imprime et entre dans le PDF sans requête supplémentaire. */
async function enDonnees(url: string | null) {
  if (!url) return null
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!reponse.ok) return null
    const type = reponse.headers.get('content-type') ?? 'image/png'
    const octets = Buffer.from(await reponse.arrayBuffer())
    return `data:${type};base64,${octets.toString('base64')}`
  } catch {
    return null
  }
}

/** Document A4 (hors de la mise en page de l'application) : impression navigateur ou téléchargement PDF. */
export default async function ImpressionPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  await getContexte() // connexion obligatoire ; la RLS limite ensuite aux documents visibles
  const { type, id } = await params
  if (!(type in RETOURS)) notFound()
  const modele = await chargerModele(type, id)
  if (!modele) notFound()

  const [logos, qr] = await Promise.all([
    Promise.all(modele.parties.map((p) => enDonnees(p.logo))),
    modele.qr ? QRCode.toDataURL(modele.qr.url, { margin: 1, width: 360, errorCorrectionLevel: 'M' }) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen bg-background pb-10 print:bg-white print:pb-0">
      <style>{`@media print { @page { size: A4 portrait; margin: 0; } .feuille-a4 { width: 210mm; min-height: 297mm; } }`}</style>
      <BarreDocument modele={modele} logos={logos} qr={qr} retour={RETOURS[type](id)} />
      <div className="overflow-x-auto px-4 print:overflow-visible print:px-0">
        <div className="mx-auto w-[210mm] min-w-[210mm] print:w-auto print:min-w-0">
          <FeuilleDocument modele={modele} logos={logos} qr={qr} />
        </div>
      </div>
    </div>
  )
}
