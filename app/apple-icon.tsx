import { iconePng } from '@/lib/icone'

// Icône d'écran d'accueil iOS et du Dock macOS (Safari « Ajouter au Dock »).
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return iconePng(180)
}
