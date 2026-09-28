import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Ouvre la version A4 d'un document (impression ou téléchargement PDF). */
export function LienImpression({ type, id, libelle = 'Imprimer / PDF' }: { type: string; id: string; libelle?: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={`/impression/${type}/${id}`}>
        <FileDown className="h-4 w-4" aria-hidden /> {libelle}
      </Link>
    </Button>
  )
}
