import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { withRetry } from '@/utils/supabase/retry'

// Identité admin partagée entre produits DembaSolution (SSO) : session posée par la connexion admin centralisée de SIGGIE
// (www.dembasolution.com/admin/login) dans le projet Supabase de SIGGIE, cookie à domaine .dembasolution.com lisible par
// tous les produits. Même cookie et mêmes options que SIGGIE, D-QUINCA et D-Scholar (cf. leur admin-identity.ts).
// Distinct du client habituel (utils/supabase/server.ts), scopé au projet Supabase de PCAS.
const ADMIN_COOKIE_OPTIONS = {
  name: 'sb-demba-admin',
  domain: '.dembasolution.com',
  sameSite: 'lax' as const,
  secure: true,
}

/** Emails de l'équipe DembaSolution autorisés à entrer dans l'administration via le SSO (variable ADMIN_EMAILS). */
export function estEmailAdminPartage(email: string | null | undefined): boolean {
  if (!email) return false
  const autorises = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return autorises.includes(email.toLowerCase())
}

/** Utilisateur de la session admin partagée, ou null (pas de session, configuration absente, échec réseau). */
export async function getAdminPartage(): Promise<User | null> {
  const url = process.env.ADMIN_IDENTITY_SUPABASE_URL
  const cle = process.env.ADMIN_IDENTITY_SUPABASE_ANON_KEY
  if (!url || !cle) return null

  const cookieStore = await cookies()
  const supabase = createServerClient(url, cle, {
    cookieOptions: ADMIN_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Appelé hors d'un gestionnaire de route : le jeton rafraîchi sera reposé par SIGGIE.
        }
      },
    },
  })

  try {
    return await withRetry(() => supabase.auth.getUser().then(({ data }) => data.user))
  } catch {
    return null
  }
}
