import { iconePng } from '@/lib/icone'

// /icone/192, /icone/512 (icônes standard) et /icone/512-maskable (Android), référencées par le manifeste.
const TAILLES: Record<string, { taille: number; marge: boolean }> = {
  '192': { taille: 192, marge: false },
  '512': { taille: 512, marge: false },
  '512-maskable': { taille: 512, marge: true },
  // Source des icônes des applications mobiles et de bureau (voir docs/applications.md)
  '1024': { taille: 1024, marge: false },
  '1024-plein': { taille: 1024, marge: true },
}

export function generateStaticParams() {
  return Object.keys(TAILLES).map((taille) => ({ taille }))
}

export async function GET(_requete: Request, { params }: { params: Promise<{ taille: string }> }) {
  const choix = TAILLES[(await params).taille]
  if (!choix) return new Response('Introuvable', { status: 404 })
  return iconePng(choix.taille, choix.marge)
}
