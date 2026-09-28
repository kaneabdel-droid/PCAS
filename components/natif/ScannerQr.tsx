'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pluginNatif } from '@/lib/natif'

type Detecteur = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/** Ouvre la page de vérification correspondant au contenu d'un QR code PCAS (adresse /v/<code>). */
function jetonDepuis(texte: string) {
  const morceau = texte.split('/v/').pop()?.split(/[?#\s]/)[0]
  return morceau && /^[A-Za-z0-9_-]{8,64}$/.test(morceau) ? morceau : null
}

/**
 * Scanner de QR code : lecteur natif dans l'application mobile (ML Kit), sinon caméra du navigateur quand il sait
 * détecter les codes (Chrome sur Android notamment). Ailleurs, le bouton ne s'affiche pas : la saisie du code reste possible.
 */
export function ScannerQr() {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  // Connu seulement dans le navigateur : rendu serveur sans le bouton, puis affichage si un lecteur existe.
  const disponible = useSyncExternalStore(
    () => () => undefined,
    () => Boolean(pluginNatif('BarcodeScanner')) || 'BarcodeDetector' in window,
    () => false
  )
  const [actif, setActif] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function scanner() {
    setErreur(null)
    const natif = pluginNatif('BarcodeScanner')
    if (natif) {
      try {
        const resultat = (await natif.scan({ formats: ['QR_CODE'] })) as { barcodes?: { rawValue: string }[] }
        const jeton = jetonDepuis(resultat.barcodes?.[0]?.rawValue ?? '')
        if (jeton) router.push(`/v/${jeton}`)
        else setErreur('Ce QR code n’est pas un document PCAS.')
      } catch {
        setErreur('Lecture annulée ou caméra indisponible.')
      }
      return
    }
    setActif(true)
  }

  useEffect(() => {
    if (!actif) return
    let flux: MediaStream | null = null
    let arret = false
    const Classe = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detecteur }).BarcodeDetector
    const detecteur = new Classe({ formats: ['qr_code'] })
    ;(async () => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = flux
        await video.current.play()
        while (!arret && video.current) {
          const codes = await detecteur.detect(video.current).catch(() => [])
          const jeton = codes.map((c) => jetonDepuis(c.rawValue)).find(Boolean)
          if (jeton) {
            router.push(`/v/${jeton}`)
            return
          }
          await new Promise((r) => setTimeout(r, 250))
        }
      } catch {
        setErreur('Accès à la caméra refusé ou impossible.')
        setActif(false)
      }
    })()
    return () => {
      arret = true
      flux?.getTracks().forEach((t) => t.stop())
    }
  }, [actif, router])

  if (!disponible) return null
  return (
    <div className="mb-6 space-y-3">
      {actif ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-10 rounded-xl border-2 border-white/80" aria-hidden />
          <Button type="button" variant="outline" size="icon" className="absolute right-3 top-3" onClick={() => setActif(false)} aria-label="Fermer la caméra">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={scanner} className="h-11 w-full">
          <Camera className="h-4 w-4" aria-hidden /> Scanner le QR code
        </Button>
      )}
      {erreur && <p className="text-sm text-danger">{erreur}</p>}
    </div>
  )
}
