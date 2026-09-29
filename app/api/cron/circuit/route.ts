import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerNotificationsParEmail } from '@/lib/emails'
import { envoyerNotificationsPush } from '@/lib/push'

// Tâche planifiée du circuit de commande (Vercel Cron, voir vercel.json), protégée par CRON_SECRET :
// 1. réceptions tacites des bons de réception restés sans réponse après le délai ;
// 2. échéances passées en retard (avec notification) ;
// 3. rappels (réception tacite dans 48 h et 24 h, échéances dans 3 jours) ;
// 4. envoi des notifications par email et push.
// Chaque étape est indépendante : une panne de l'une n'empêche pas les suivantes (elles sont toutes rejouables sans
// risque au passage suivant). Réponse 500 si au moins une étape a échoué, pour que l'échec soit visible dans Vercel.
export const maxDuration = 60

function autorise(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const recu = Buffer.from(request.headers.get('authorization') ?? '')
  const attendu = Buffer.from(`Bearer ${secret}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}

export async function GET(request: NextRequest) {
  if (!autorise(request)) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  const supabase = createAdminClient()
  const resultats: Record<string, unknown> = {}
  const echecs: string[] = []

  async function etape(nom: string, execution: () => Promise<unknown>) {
    try {
      resultats[nom] = await execution()
    } catch (erreur) {
      console.error(`cron circuit — ${nom} :`, erreur)
      echecs.push(nom)
    }
  }
  const rpc = (fonction: string) => async () => {
    const { data, error } = await supabase.rpc(fonction)
    if (error) throw error
    return data
  }

  await etape('receptions_tacites', rpc('receptions_tacites'))
  await etape('echeances_en_retard', rpc('echeances_en_retard'))
  await etape('rappels', rpc('rappels'))
  await Promise.all([
    etape('emails', () => envoyerNotificationsParEmail(supabase)),
    etape('push', () => envoyerNotificationsPush(supabase)),
  ])

  return NextResponse.json({ ...resultats, echecs }, { status: echecs.length ? 500 : 200 })
}
