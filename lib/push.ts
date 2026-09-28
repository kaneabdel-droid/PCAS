import { createSign } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Notifications push vers les applications mobiles, par l'API HTTP v1 de Firebase Cloud Messaging (Android, et iPhone
// via la clé APNs déposée dans Firebase). Variable : FIREBASE_SERVICE_ACCOUNT = contenu JSON du compte de service.
// Sans elle, rien n'est envoyé.

type CompteService = { client_email: string; private_key: string; project_id: string }

function compteService(): CompteService | null {
  const brut = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!brut) return null
  try {
    const c = JSON.parse(brut) as CompteService
    return c.client_email && c.private_key && c.project_id ? c : null
  } catch {
    return null
  }
}

const base64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

/** Jeton d'accès OAuth 2 du compte de service (JWT signé RS256, échangé auprès de Google). */
async function jetonAcces(c: CompteService) {
  const maintenant = Math.floor(Date.now() / 1000)
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const charge = base64url(
    JSON.stringify({
      iss: c.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: maintenant,
      exp: maintenant + 3600,
    })
  )
  const signature = createSign('RSA-SHA256').update(`${entete}.${charge}`).sign(c.private_key.replace(/\\n/g, '\n'))
  const reponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${entete}.${charge}.${base64url(signature)}` }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!reponse.ok) throw new Error(`Jeton Firebase refusé (${reponse.status})`)
  return ((await reponse.json()) as { access_token: string }).access_token
}

/** Envoie en push les notifications récentes pas encore poussées. Renvoie le nombre de messages envoyés. */
export async function envoyerNotificationsPush(supabase: SupabaseClient, limite = 300) {
  const c = compteService()
  if (!c) return 0
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, destinataire_id, titre, message, lien')
    .is('push_envoye_le', null)
    .gte('created_at', depuis)
    .order('created_at')
    .limit(limite)
  if (!notifications?.length) return 0

  const destinataires = [...new Set(notifications.map((n) => n.destinataire_id))]
  const { data: appareils } = await supabase.from('appareils').select('jeton, utilisateur_id').in('utilisateur_id', destinataires)
  const parUtilisateur = new Map<string, string[]>()
  for (const a of appareils ?? []) parUtilisateur.set(a.utilisateur_id, [...(parUtilisateur.get(a.utilisateur_id) ?? []), a.jeton])

  const acces = await jetonAcces(c)
  let envoyes = 0
  for (const n of notifications) {
    for (const jeton of parUtilisateur.get(n.destinataire_id) ?? []) {
      const reponse = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${acces}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: jeton,
            notification: { title: n.titre, body: n.message ?? '' },
            data: { lien: n.lien ?? '/' },
            apns: { payload: { aps: { sound: 'default' } } },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null)
      if (reponse?.ok) envoyes += 1
      // Jeton périmé (application désinstallée) : l'appareil est oublié.
      else if (reponse && (reponse.status === 404 || reponse.status === 400)) await supabase.from('appareils').delete().eq('jeton', jeton)
    }
    await supabase.from('notifications').update({ push_envoye_le: new Date().toISOString() }).eq('id', n.id)
  }
  return envoyes
}
