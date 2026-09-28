import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bell } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { marquerLue, toutMarquerLu } from '@/app/(app)/notifications/actions'
import { getContexte } from '@/lib/session'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Notifications' }

type Notification = { id: string; titre: string; message: string | null; lien: string | null; lu_le: string | null; created_at: string }

export default async function NotificationsPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, titre, message, lien, lu_le, created_at')
    .eq('destinataire_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(200)
    .returns<Notification[]>()
  const notifications = data ?? []
  const nonLues = notifications.filter((n) => !n.lu_le).length

  async function ouvrir(fd: FormData) {
    'use server'
    const id = String(fd.get('id') ?? '')
    const lien = String(fd.get('lien') ?? '')
    await marquerLue(id)
    if (lien.startsWith('/') && !lien.startsWith('//')) redirect(lien)
  }

  return (
    <>
      <PageHeader titre="Notifications" description="Étapes de vos commandes, rappels et alertes. Elles vous sont aussi envoyées par email.">
        {nonLues > 0 && (
          <FormulaireAction action={toutMarquerLu} libelle="Tout marquer comme lu" variante="outline" />
        )}
      </PageHeader>
      {notifications.length === 0 ? (
        <Vide titre="Aucune notification" />
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {notifications.map((n) => (
            <li key={n.id}>
              <form action={ouvrir}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="lien" value={n.lien ?? ''} />
                <button type="submit" className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-muted', !n.lu_le && 'bg-primary-soft/40')}>
                  <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', n.lu_le ? 'bg-surface-muted text-foreground-muted' : 'bg-primary text-primary-foreground')} aria-hidden>
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block', !n.lu_le && 'font-semibold')}>{n.titre}</span>
                    {n.message && <span className="block text-sm text-foreground-muted">{n.message}</span>}
                    <span className="mt-0.5 block text-xs text-foreground-muted">
                      {new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dakar' })}
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
