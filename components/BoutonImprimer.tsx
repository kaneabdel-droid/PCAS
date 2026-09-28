'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Impression du contenu de la page (le menu et les boutons sont masqués à l'impression). */
export function BoutonImprimer({ libelle = 'Imprimer' }: { libelle?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden /> {libelle}
    </Button>
  )
}
