import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estEmailAdminPartage, getAdminPartage } from '@/utils/supabase/admin-identity'
import { withRetry } from '@/utils/supabase/retry'
import { createClient } from '@/utils/supabase/server'

// Connexion unique depuis Demba Admin (SIGGIE) : un membre de l'équipe DembaSolution déjà connecté à l'administration
// centralisée entre directement dans l'administration PCAS, sans ressaisir ses identifiants.
// PCAS garde ses propres comptes et sa RLS (mon_role()) : on ouvre donc une vraie session PCAS sur le compte
// administrateur portant le même email, par lien de connexion à usage unique généré et vérifié côté serveur — même
// mécanisme que la connexion de démonstration (app/demo/actions.ts). Aucun compte n'est créé ici : sans compte
// administrateur actif à ce nom dans PCAS, l'accès est refusé.
export async function GET(request: NextRequest) {
  const suite = request.nextUrl.searchParams.get('next') ?? '/admin/entreprises'
  // Redirection interne uniquement (même règle que app/auth/confirm/route.ts).
  const destination = /^\/(?![/\\])[^\\\s]*$/.test(suite) ? suite : '/admin/entreprises'

  const partage = await getAdminPartage()
  const email = partage?.email?.toLowerCase()
  // Pas de session admin partagée : connexion PCAS classique.
  if (!email || !estEmailAdminPartage(email)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = await createClient()
  const { data: jeton } = await supabase.auth.getClaims()
  const emailCourant = (jeton?.claims?.email as string | undefined)?.toLowerCase()

  const admin = createAdminClient()
  const { data: compte } = await admin
    .from('utilisateurs')
    .select('id, role_base, actif')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()

  if (!compte || compte.role_base !== 'administrateur' || !compte.actif) {
    console.error('SSO PCAS : aucun compte administrateur actif pour', email)
    return NextResponse.redirect(new URL('/login?erreur=sso', request.url))
  }

  // Déjà connecté à PCAS avec ce compte : rien à faire.
  if (emailCourant === email && jeton?.claims?.sub === compte.id) {
    return NextResponse.redirect(new URL(destination, request.url))
  }

  const { data, error } = await withRetry(() => admin.auth.admin.generateLink({ type: 'magiclink', email })).catch((e) => ({
    data: null,
    error: e as Error,
  }))
  if (error || !data?.properties?.hashed_token) {
    console.error('SSO PCAS : lien de connexion impossible', error?.message)
    return NextResponse.redirect(new URL('/login?erreur=sso', request.url))
  }

  // Une autre session PCAS éventuelle (compte de démonstration, autre utilisateur) est remplacée.
  if (emailCourant) await supabase.auth.signOut()
  const { error: erreurVerification } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (erreurVerification) {
    console.error('SSO PCAS : connexion impossible', erreurVerification.message)
    return NextResponse.redirect(new URL('/login?erreur=sso', request.url))
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
