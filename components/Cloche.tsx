'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

/**
 * Cloche des notifications. Le nombre de non lues vient du serveur à chaque navigation (le parent remonte le composant
 * avec key={nonLues}) ; les nouvelles notifications arrivées entre-temps s'ajoutent en temps réel.
 */
export function Cloche({ utilisateurId, nonLues, className }: { utilisateurId: string; nonLues: number; className?: string }) {
  const [nouvelles, setNouvelles] = useState(0)
  const affiche = nonLues + nouvelles

  useEffect(() => {
    const supabase = createClient()
    const canal = supabase
      .channel(`notifications-${utilisateurId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${utilisateurId}` },
        () => setNouvelles((n) => n + 1)
      )
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [utilisateurId])

  return (
    <Link
      href="/notifications"
      className={cn('relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground', className)}
      aria-label={affiche ? `Notifications : ${affiche} non lue(s)` : 'Notifications'}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {affiche > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-actif px-1 text-[10px] font-bold text-sidebar-actif-foreground">
          {affiche > 99 ? '99+' : affiche}
        </span>
      )}
    </Link>
  )
}
