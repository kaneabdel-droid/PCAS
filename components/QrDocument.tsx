import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { jetonDocument, qrSvg, urlVerification, type TypeDocument } from '@/lib/qr'

/**
 * QR code d'un document : il renvoie à la page publique de vérification (authenticité et étapes de la commande).
 * Imprimé avec le document ; il fait office de signature.
 */
export async function QrDocument({
  type,
  documentId,
  jeton,
  className,
}: {
  type?: TypeDocument
  documentId?: string
  /** Jeton déjà connu (contrat accepté). */
  jeton?: string | null
  className?: string
}) {
  const jetonFinal = jeton ?? (type && documentId ? await jetonDocument(type, documentId) : null)
  if (!jetonFinal) return null
  const url = urlVerification(jetonFinal)
  const svg = await qrSvg(url)
  return (
    <a
      href={url}
      className={cn('break-inside-avoid inline-flex items-center gap-3 rounded-xl border border-surface-border bg-white p-2 text-[#13201A]', className)}
      title="Vérifier l’authenticité de ce document"
    >
      <span className="block h-24 w-24 shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} aria-hidden />
      <span className="max-w-40 text-xs leading-snug">
        <span className="mb-1 flex items-center gap-1 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Document vérifiable
        </span>
        Scannez ce code pour vérifier son authenticité et le suivi de la commande.
        <span className="mt-1 block break-all font-mono text-[10px] opacity-70">{jetonFinal}</span>
      </span>
    </a>
  )
}
