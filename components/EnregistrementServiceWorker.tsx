'use client'

import { useEffect } from 'react'

/** Installe le service worker (écran « Pas de connexion ») en production. */
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
  }, [])
  return null
}
