import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Déconnexion forcée d'un compte qui ne peut pas accéder à la plateforme (désactivé, non configuré, entreprise suspendue).
// Un composant serveur ne peut pas effacer les cookies de session : il redirige ici. Sans cette étape, le proxy renverrait
// l'utilisateur encore connecté de /login vers l'accueil, en boucle.
const MOTIFS = ['compte', 'entreprise']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const motif = request.nextUrl.searchParams.get('erreur')
  const cible = new URL('/login', request.url)
  if (motif && MOTIFS.includes(motif)) cible.searchParams.set('erreur', motif)
  return NextResponse.redirect(cible)
}
