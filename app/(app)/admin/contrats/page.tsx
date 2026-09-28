import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { creerBrouillon } from '@/app/(app)/admin/contrats/actions'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Contrats d’engagement' }

type Ligne = {
  id: string
  type: 'producteur' | 'client'
  version: string
  titre: string
  statut: 'brouillon' | 'en_vigueur' | 'archive'
  publie_le: string | null
  created_at: string
  acceptations_contrat: { count: number }[]
}

const STATUTS = {
  en_vigueur: { libelle: 'En vigueur', ton: 'succes' },
  brouillon: { libelle: 'Brouillon', ton: 'alerte' },
  archive: { libelle: 'Archivé', ton: 'neutre' },
} as const

export default async function ContratsPage() {
  const supabase = await createClient()
  const [{ data }, { count: nbProducteurs }, { count: nbClients }] = await Promise.all([
    supabase
      .from('modeles_contrat')
      .select('id, type, version, titre, statut, publie_le, created_at, acceptations_contrat(count)')
      .order('created_at', { ascending: false })
      .returns<Ligne[]>(),
    supabase.from('entreprises').select('id', { count: 'exact', head: true }).eq('type', 'producteur').eq('statut', 'actif'),
    supabase.from('entreprises').select('id', { count: 'exact', head: true }).eq('type', 'client').eq('statut', 'actif'),
  ])
  const modeles = data ?? []
  const totaux = { producteur: nbProducteurs ?? 0, client: nbClients ?? 0 }

  return (
    <>
      <PageHeader
        titre="Contrats d’engagement"
        description="Chaque producteur et chaque client doit accepter la version en vigueur de son contrat. Un contrat publié est figé : toute modification passe par une nouvelle version."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {(['producteur', 'client'] as const).map((type) => (
            <section key={type}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
                Contrat {type === 'producteur' ? 'producteur' : 'client'}
              </h2>
              <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
                {modeles
                  .filter((m) => m.type === type)
                  .map((m) => (
                    <li key={m.id}>
                      <Link href={`/admin/contrats/${m.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {m.titre} — v{m.version}
                          </p>
                          <p className="text-sm text-foreground-muted">
                            {m.publie_le ? `Publié le ${formatDate(m.publie_le)}` : `Créé le ${formatDate(m.created_at)}`}
                            {m.statut !== 'brouillon' &&
                              ` · ${m.acceptations_contrat[0]?.count ?? 0} acceptation(s)${m.statut === 'en_vigueur' ? ` sur ${totaux[type]} entreprise(s) active(s)` : ''}`}
                          </p>
                        </div>
                        <Badge ton={STATUTS[m.statut].ton}>{STATUTS[m.statut].libelle}</Badge>
                        <ChevronRight className="h-4 w-4 text-foreground-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <Card className="self-start">
          <h2 className="font-heading font-semibold">Nouvelle version</h2>
          <p className="mb-4 mt-1 text-sm text-foreground-muted">
            Le brouillon reprend le texte en vigueur ; vous le modifiez puis le publiez.
          </p>
          <FormulaireAction action={creerBrouillon} libelle="Créer le brouillon">
            <GrilleChamps>
              <Champ id="type" label="Contrat" requis>
                <Select id="type" name="type" required defaultValue="producteur">
                  <option value="producteur">Producteur</option>
                  <option value="client">Client</option>
                </Select>
              </Champ>
              <Champ id="version" label="Version" requis>
                <Input id="version" name="version" required placeholder="1.1" />
              </Champ>
            </GrilleChamps>
          </FormulaireAction>
        </Card>
      </div>
    </>
  )
}
