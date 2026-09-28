import Link from 'next/link'
import { FileSignature } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { EnregistrementPush } from '@/components/natif/EnregistrementPush'
import { getContexte } from '@/lib/session'
import { LIBELLES_ROLES } from '@/lib/roles'
import { createClient } from '@/utils/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()

  const supabase = await createClient()
  const { count: nonLues } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('destinataire_id', ctx.userId)
    .is('lu_le', null)

  // Producteur ou client dont l'entreprise n'a pas accepté le contrat en vigueur : consultation possible, mais les actions
  // (offres, commandes, besoins) sont bloquées en base. Le bandeau l'explique et mène au contrat.
  let contratAAccepter = false
  if (ctx.entrepriseId && (ctx.role === 'producteur' || ctx.role === 'client')) {
    const { data } = await supabase.rpc('contrat_en_regle', { p_entreprise: ctx.entrepriseId })
    contratAAccepter = data === false
  }

  return (
    <AppShell
      utilisateur={ctx.nomComplet}
      role={ctx.role}
      roleLibelle={ctx.profilLibelle ?? LIBELLES_ROLES[ctx.role]}
      entreprise={ctx.entrepriseNom ?? 'Plateforme PCAS'}
      permissions={ctx.permissions}
      utilisateurId={ctx.userId}
      nonLues={nonLues ?? 0}
    >
      <EnregistrementPush />
      {contratAAccepter && (
        <div className="no-print mb-6 flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <FileSignature className="h-6 w-6 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>Contrat d’engagement à accepter.</strong> Tant qu’il n’est pas accepté par un signataire habilité de votre
            entreprise, vous pouvez consulter la plateforme mais pas commander ni publier d’offre ou de besoin.
          </p>
          <Link href="/contrat" className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
            Voir le contrat
          </Link>
        </div>
      )}
      {children}
    </AppShell>
  )
}
