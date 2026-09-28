import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ScanLine } from 'lucide-react'
import { EcranAuth } from '@/components/EcranAuth'
import { ScannerQr } from '@/components/natif/ScannerQr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const metadata: Metadata = { title: 'Vérifier un document' }

async function verifier(fd: FormData) {
  'use server'
  const saisie = String(fd.get('code') ?? '').trim()
  // Accepte le code seul ou l'adresse complète lue sur le document.
  const jeton = saisie.split('/v/').pop()?.split(/[?#\s]/)[0] ?? ''
  if (jeton) redirect(`/v/${encodeURIComponent(jeton)}`)
}

/** Vérification manuelle d'un document (code imprimé sous le QR), accessible sans connexion. */
export default function VerifierPage() {
  return (
    <EcranAuth titre="Vérifier un document" sousTitre="Scannez le QR code du document avec l’appareil photo de votre téléphone, ou saisissez le code imprimé dessous.">
      <ScannerQr />
      <form action={verifier} className="space-y-4">
        <Input name="code" required placeholder="Code du document ou adresse de vérification" aria-label="Code du document" className="h-11 font-mono" autoComplete="off" />
        <Button type="submit" className="h-11 w-full">
          <ScanLine className="h-4 w-4" aria-hidden /> Vérifier
        </Button>
      </form>
    </EcranAuth>
  )
}
