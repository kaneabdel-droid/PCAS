import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Point de contrôle pour la surveillance (UptimeRobot, Better Stack…) : 200 si l'application joint la base, 503 sinon.
// Public et sans donnée métier : seulement l'état, la latence Vercel → Supabase et la région d'exécution.
export const dynamic = 'force-dynamic'

export async function GET() {
  const debut = performance.now()
  let base: 'ok' | 'indisponible' = 'ok'
  try {
    const { error } = await createAdminClient().from('parametres_plateforme').select('id', { head: true, count: 'exact' })
    if (error) throw error
  } catch (erreur) {
    console.error('santé : base injoignable', erreur)
    base = 'indisponible'
  }
  const corps = {
    statut: base === 'ok' ? 'ok' : 'degrade',
    base,
    latence_base_ms: Math.round(performance.now() - debut),
    region: process.env.VERCEL_REGION ?? 'locale',
    horodatage: new Date().toISOString(),
  }
  return NextResponse.json(corps, { status: base === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
