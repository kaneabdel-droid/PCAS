import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Button } from '@/components/ui/button'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { Onglets } from '@/components/Onglets'
import { traiterDemande } from '@/app/(app)/admin/demandes/actions'
import { LIBELLES_TYPES_ENTREPRISE, type TypeEntreprise } from '@/lib/roles'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Demandes d’accès' }

type Demande = {
  id: string
  type_entreprise: TypeEntreprise
  denomination: string
  contact_nom: string
  telephone: string
  email: string
  region: string | null
  message: string | null
  statut: 'nouvelle' | 'traitee' | 'rejetee'
  created_at: string
  traitee_le: string | null
}

export default async function DemandesPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const demande = (await searchParams).onglet
  const onglet = demande === 'traitee' || demande === 'rejetee' ? demande : 'nouvelle'
  const supabase = await createClient()
  const [{ data }, { count: nouvelles }] = await Promise.all([
    supabase.from('demandes_acces').select('*').eq('statut', onglet).order('created_at', { ascending: false }).limit(200).returns<Demande[]>(),
    supabase.from('demandes_acces').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle'),
  ])
  const demandes = data ?? []

  return (
    <>
      <PageHeader
        titre="Demandes d’accès"
        description="Demandes déposées depuis la page publique « Demander un accès ». Créez l’entreprise à partir de la demande, puis invitez ses utilisateurs."
      />
      <Onglets
        base="/admin/demandes"
        actif={onglet}
        onglets={[
          { cle: 'nouvelle', libelle: 'Nouvelles', compte: nouvelles ?? 0 },
          { cle: 'traitee', libelle: 'Traitées' },
          { cle: 'rejetee', libelle: 'Rejetées' },
        ]}
      />
      {demandes.length === 0 ? (
        <Vide titre="Aucune demande" />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {demandes.map((d) => (
            <li key={d.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold">{d.denomination}</p>
                    <p className="text-sm text-foreground-muted">
                      {d.contact_nom}
                      {d.region ? ` · ${d.region}` : ''} · reçue le {formatDate(d.created_at)}
                    </p>
                  </div>
                  <Badge ton="primaire">{LIBELLES_TYPES_ENTREPRISE[d.type_entreprise]}</Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={`tel:${d.telephone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {d.telephone}
                  </a>
                  <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" aria-hidden /> {d.email}
                  </a>
                </div>
                {d.message && <p className="whitespace-pre-line rounded-lg bg-surface-muted p-3 text-sm">{d.message}</p>}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-surface-border pt-3">
                  {d.statut === 'nouvelle' && (
                    <>
                      <Button asChild className="h-8 px-3 text-xs">
                        <Link href={`/admin/entreprises/nouvelle?demande=${d.id}`}>Créer l’entreprise</Link>
                      </Button>
                      <FormulaireAction action={traiterDemande} libelle="Marquer traitée" variante="outline" boutonClassName="h-8 px-3 text-xs">
                        <input type="hidden" name="demande_id" value={d.id} />
                        <input type="hidden" name="statut" value="traitee" />
                      </FormulaireAction>
                      <FormulaireAction
                        action={traiterDemande}
                        libelle="Rejeter"
                        variante="ghost"
                        boutonClassName="h-8 px-3 text-xs text-danger"
                        confirmation={`Rejeter la demande de ${d.denomination} ?`}
                      >
                        <input type="hidden" name="demande_id" value={d.id} />
                        <input type="hidden" name="statut" value="rejetee" />
                      </FormulaireAction>
                    </>
                  )}
                  {d.statut !== 'nouvelle' && (
                    <FormulaireAction action={traiterDemande} libelle="Remettre en attente" variante="outline" boutonClassName="h-8 px-3 text-xs">
                      <input type="hidden" name="demande_id" value={d.id} />
                      <input type="hidden" name="statut" value="nouvelle" />
                    </FormulaireAction>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
