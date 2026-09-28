import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetchAvecDelai } from '@/utils/supabase/fetch'

// Client "service role" : contourne la RLS. Réservé aux actions serveur qui en ont réellement besoin
// (invitation d'un utilisateur par l'administrateur via auth.admin, tâches planifiées) et toujours après
// vérification du rôle de l'appelant. Ne jamais importer ce module depuis du code exécuté côté client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant')
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchAvecDelai },
  })
}
