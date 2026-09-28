import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { enregistrerProfil, supprimerProfil } from '@/app/(app)/admin/profils/actions'
import { MENUS } from '@/lib/menus'
import { permissionMenu, type ActionPermission, type Matrice } from '@/lib/permissions'
import { LIBELLES_ROLES, type RoleBase } from '@/lib/roles'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Profil' }

const ACTIONS: { cle: ActionPermission; libelle: string }[] = [
  { cle: 'lire', libelle: 'Voir' },
  { cle: 'ecrire', libelle: 'Créer' },
  { cle: 'modifier', libelle: 'Modifier / valider' },
]

type Profil = { id: string; libelle: string; role_base: RoleBase; actif: boolean; matrice_permissions: Matrice; utilisateurs: { count: number }[] }

export default async function ProfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: profil } = await supabase
    .from('profils')
    .select('id, libelle, role_base, actif, matrice_permissions, utilisateurs(count)')
    .eq('id', id)
    .maybeSingle<Profil>()
  if (!profil) notFound()

  const groupes = MENUS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(profil.role_base)) })).filter(
    (g) => g.items.length > 0
  )
  const nbUtilisateurs = profil.utilisateurs[0]?.count ?? 0

  return (
    <>
      <Link href="/admin/profils" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Profils
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold">{profil.libelle}</h1>
        <Badge ton="primaire">Rôle de base : {LIBELLES_ROLES[profil.role_base]}</Badge>
        <Badge>{nbUtilisateurs} utilisateur(s)</Badge>
      </div>

      <Card>
        <FormulaireAction action={enregistrerProfil} libelle="Enregistrer le profil">
          <input type="hidden" name="profil_id" value={profil.id} />
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Champ id="libelle" label="Libellé" requis>
              <Input id="libelle" name="libelle" required defaultValue={profil.libelle} />
            </Champ>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" name="actif" defaultChecked={profil.actif} className="h-4 w-4 accent-primary" /> Profil actif
            </label>
          </div>

          <p className="text-sm text-foreground-muted">
            Décochez ce que ce profil ne doit pas pouvoir faire. Les écrans marqués « bientôt » arriveront dans les prochaines
            versions : leur réglage sera appliqué dès leur mise en service.
          </p>

          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-surface-muted text-left text-foreground-muted">
                  <th className="px-4 py-2.5 font-medium">Écran</th>
                  {ACTIONS.map((a) => (
                    <th key={a.cle} className="w-32 px-2 py-2.5 text-center font-medium">
                      {a.libelle}
                    </th>
                  ))}
                </tr>
              </thead>
              {groupes.map((groupe) => (
                <tbody key={groupe.titre}>
                  <tr>
                    <td colSpan={4} className="border-t border-surface-border bg-surface-muted/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      {groupe.titre}
                    </td>
                  </tr>
                  {groupe.items.map((item) => (
                    <tr key={item.href} className="border-t border-surface-border">
                      <td className="px-4 py-2">
                        {item.label}
                        {item.bientot && <span className="ml-2 text-xs text-foreground-muted">(bientôt)</span>}
                      </td>
                      {ACTIONS.map((a) => (
                        <td key={a.cle} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            name={`${item.href}|${a.cle}`}
                            defaultChecked={permissionMenu(profil.matrice_permissions, item.href, a.cle)}
                            aria-label={`${item.label} — ${a.libelle}`}
                            className="h-4 w-4 accent-primary"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </FormulaireAction>
      </Card>

      <Card className="mt-6 border-danger/40">
        <h2 className="font-heading font-semibold text-danger">Supprimer le profil</h2>
        <p className="mb-3 mt-1 text-sm text-foreground-muted">
          {nbUtilisateurs > 0
            ? `Les ${nbUtilisateurs} utilisateur(s) concerné(s) retrouveront tous les droits de leur rôle de base.`
            : 'Aucun utilisateur n’utilise ce profil.'}
        </p>
        <FormulaireAction action={supprimerProfil} libelle="Supprimer" variante="danger" confirmation={`Supprimer le profil « ${profil.libelle} » ?`}>
          <input type="hidden" name="profil_id" value={profil.id} />
        </FormulaireAction>
      </Card>
    </>
  )
}
