import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerNotificationsParEmail } from '@/lib/emails'
import { envoyerNotificationsPush } from '@/lib/push'

// Tâche planifiée du circuit de commande (Vercel Cron, voir vercel.json), protégée par CRON_SECRET :
// 1. réceptions tacites des bons de réception restés sans réponse après le délai ;
// 2. échéances passées en retard (avec notification) ;
// 3. rappels (réception tacite dans 48 h et 24 h, échéances dans 3 jours) ;
// 4. envoi par email des notifications.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }
  const supabase = createAdminClient()
  const receptions = await supabase.rpc('receptions_tacites')
  const retards = await supabase.rpc('echeances_en_retard')
  const rappels = await supabase.rpc('rappels')
  const erreur = receptions.error ?? retards.error ?? rappels.error
  if (erreur) {
    console.error('cron circuit :', erreur)
    return NextResponse.json({ erreur: 'Échec de la tâche' }, { status: 500 })
  }
  const [emails, push] = await Promise.all([
    envoyerNotificationsParEmail(supabase),
    envoyerNotificationsPush(supabase).catch((e) => {
      console.error('push :', e)
      return 0
    }),
  ])
  return NextResponse.json({ receptions_tacites: receptions.data, echeances_en_retard: retards.data, rappels: rappels.data, emails, push })
}
