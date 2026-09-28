import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { creerProfil } from '@/app/(app)/admin/profils/actions'
import { LIBELLES_ROLES, type RoleBase } from '@/lib/roles'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Profils' }

type Ligne = { id: string; libelle: string; role_base: RoleBase; actif: boolean; utilisateurs: { count: number }[] }

export default async function ProfilsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profils')
    .select('id, libelle, role_base, actif, utilisateurs(count)')
    .order('role_base')
    .order('libelle')
    .returns<Ligne[]>()
  const profils = data ?? []

  return (
    <>
      <PageHeader
        titre="Profils"
        description="Un profil part d’un rôle de base et en restreint les droits écran par écran (par exemple un commercial producteur qui ne peut pas confirmer les paiements). Il ne peut jamais accorder plus que le rôle."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {profils.length === 0 ? (
          <Vide titre="Aucun profil personnalisé">Sans profil, chaque utilisateur a tous les droits de son rôle.</Vide>
        ) : (
          <ul className="divide-y divide-surface-border self-start overflow-hidden rounded-xl border border-surface-border bg-surface">
            {profils.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/profils/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.libelle}</p>
                    <p className="text-sm text-foreground-muted">
                      Rôle de base : {LIBELLES_ROLES[p.role_base]} · {p.utilisateurs[0]?.count ?? 0} utilisateur(s)
                    </p>
                  </div>
                  {!p.actif && <Badge ton="alerte">Inactif</Badge>}
                  <ChevronRight className="h-4 w-4 text-foreground-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Card className="self-start">
          <h2 className="mb-4 font-heading font-semibold">Nouveau profil</h2>
          <FormulaireAction action={creerProfil} libelle="Créer le profil">
            <GrilleChamps>
              <Champ id="libelle" label="Libellé" requis className="sm:col-span-2">
                <Input id="libelle" name="libelle" required minLength={2} placeholder="Ex. Commercial producteur" />
              </Champ>
              <Champ id="role_base" label="Rôle de base" requis className="sm:col-span-2">
                <Select id="role_base" name="role_base" required defaultValue="">
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {Object.entries(LIBELLES_ROLES).map(([cle, libelle]) => (
                    <option key={cle} value={cle}>
                      {libelle}
                    </option>
                  ))}
                </Select>
              </Champ>
            </GrilleChamps>
          </FormulaireAction>
        </Card>
      </div>
    </>
  )
}
