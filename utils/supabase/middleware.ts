import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { fetchAvecDelai } from '@/utils/supabase/fetch'

// Pages accessibles sans connexion : connexion et mot de passe, demande d'accès, retour des liens d'invitation,
// vérification publique des documents par QR code (/v/…), routes serveur-à-serveur (tâches planifiées, protégées par leur secret),
// présentation du produit et connexion en un clic aux comptes de démonstration (/decouvrir-pcas, /demo),
// surveillance (/api/sante) et tunnel Sentry des erreurs du navigateur (/monitoring).
const PUBLIC_PREFIXES = ['/login', '/mot-de-passe-oublie', '/demande-acces', '/verifier', '/hors-ligne', '/guide', '/auth', '/v/', '/api/cron', '/api/sante', '/monitoring', '/demo', '/decouvrir-pcas']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchAvecDelai },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Aucune logique entre createServerClient et getClaims() (rafraîchissement de session). Le jeton est vérifié localement ;
  // l'activité du compte et de son entreprise est contrôlée en base par mon_role().
  const { data: jeton } = await supabase.auth.getClaims()
  const connecte = Boolean(jeton?.claims?.sub)

  const { pathname } = request.nextUrl
  const estPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  if (!connecte && !estPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (connecte && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
