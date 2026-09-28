import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { PageHeader } from '@/components/ui/card'
import { exigerLecture } from '@/lib/droits'
import { ETATS } from '@/lib/etats'

export const metadata: Metadata = { title: 'Impressions et états' }

export default async function EtatsPage() {
  const ctx = await exigerLecture('/etats', ['administrateur', 'superviseur', 'producteur', 'client', 'financier'])
  const etats = ETATS.filter((e) => e.roles.includes(ctx.role))
  return (
    <>
      <PageHeader
        titre="Impressions et états"
        description="Choisissez un état, sa période, ses colonnes et son orientation, puis imprimez-le ou téléchargez-le en PDF ou en CSV (Excel)."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {etats.map((e) => (
          <li key={e.id}>
            <Link href={`/etats/${e.id}`} className="flex h-full items-start gap-3 rounded-xl border border-surface-border bg-surface p-4 transition-shadow hover:shadow-lg">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <FileText className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-semibold">{e.titre}</span>
                <span className="mt-1 block text-sm text-foreground-muted">{e.description}</span>
              </span>
              <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
