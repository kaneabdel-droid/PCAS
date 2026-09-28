'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { plateformeNative, pluginNatif } from '@/lib/natif'
import { createClient } from '@/utils/supabase/client'

/**
 * Dans l'application mobile uniquement : demande l'autorisation des notifications, enregistre le jeton push de
 * l'appareil pour l'utilisateur connecté, et ouvre la bonne page quand on touche une notification.
 */
export function EnregistrementPush() {
  const router = useRouter()

  useEffect(() => {
    const push = pluginNatif('PushNotifications')
    const plateforme = plateformeNative()
    if (!push || !plateforme || !push.addListener) return

    let actif = true
    push.addListener('registration', async (jeton) => {
      const valeur = (jeton as { value?: string }).value
      if (!actif || !valeur) return
      await createClient().rpc('enregistrer_appareil', { p_jeton: valeur, p_plateforme: plateforme })
    })
    push.addListener('pushNotificationActionPerformed', (action) => {
      const lien = (action as { notification?: { data?: { lien?: string } } }).notification?.data?.lien
      if (lien?.startsWith('/') && !lien.startsWith('//')) router.push(lien)
    })
    ;(async () => {
      const permission = (await push.checkPermissions()) as { receive?: string }
      const statut = permission.receive === 'prompt' ? ((await push.requestPermissions()) as { receive?: string }).receive : permission.receive
      if (statut === 'granted') await push.register()
    })().catch(() => {
      // Notifications refusées ou indisponibles : l'application fonctionne sans.
    })
    return () => {
      actif = false
      push.removeAllListeners?.().catch(() => undefined)
    }
  }, [router])

  return null
}
