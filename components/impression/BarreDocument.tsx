'use client'

import { useState } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ModeleDocument } from '@/lib/impression/modele'

/** Barre d'actions au-dessus de la feuille (masquée à l'impression). */
export function BarreDocument({ modele, logos, qr, retour }: { modele: ModeleDocument; logos: (string | null)[]; qr: string | null; retour: string }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function telecharger() {
    setEnCours(true)
    setErreur(null)
    try {
      const { pdfDocument } = await import('@/lib/impression/pdf')
      await pdfDocument(modele, logos, qr)
    } catch {
      setErreur('Création du PDF impossible. Utilisez « Imprimer » puis « Enregistrer au format PDF ».')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="no-print sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-2 border-b border-surface-border bg-background/95 px-4 py-3 backdrop-blur">
      <Button asChild variant="ghost">
        <a href={retour}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour
        </a>
      </Button>
      <span className="flex-1" />
      {erreur && <p className="text-sm text-danger">{erreur}</p>}
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden /> Imprimer
      </Button>
      <Button type="button" onClick={telecharger} disabled={enCours}>
        <Download className="h-4 w-4" aria-hidden /> {enCours ? 'Création…' : 'Télécharger PDF'}
      </Button>
    </div>
  )
}
