import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { LIBELLES_ROLES, estRoleBase, type RoleBase } from '@/lib/roles'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Utilisateurs' }

type Ligne = {
  id: string
  email: string
  nom_complet: string
  role_base: RoleBase
  actif: boolean
  signataire: boolean
  entreprises: { denomination: string } | null
  profils: { libelle: string } | null
}

export default async function UtilisateursPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; etat?: string }> }) {
  const { q, role, etat } = await searchParams
  const supabase = await createClient()
  let requete = supabase
    .from('utilisateurs')
    .select('id, email, nom_complet, role_base, actif, signataire, entreprises(denomination), profils(libelle)')
    .order('nom_complet')
  if (q?.trim()) {
    const motif = `%${q.trim().replace(/[%_,()]/g, ' ')}%`
    requete = requete.or(`nom_complet.ilike.${motif},email.ilike.${motif}`)
  }
  if (estRoleBase(role)) requete = requete.eq('role_base', role)
  if (etat === 'actif') requete = requete.eq('actif', true)
  if (etat === 'inactif') requete = requete.eq('actif', false)
  const { data } = await requete.returns<Ligne[]>()
  const utilisateurs = data ?? []

  return (
    <>
      <PageHeader titre="Utilisateurs" description="Comptes de la plateforme. Chaque nouvel utilisateur reçoit une invitation par email.">
        <Button asChild>
          <Link href="/admin/utilisateurs/nouveau">
            <UserPlus className="h-4 w-4" aria-hidden /> Inviter un utilisateur
          </Link>
        </Button>
      </PageHeader>

      <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_11rem_10rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Nom ou email" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select name="role" defaultValue={role ?? ''} aria-label="Rôle">
          <option value="">Tous les rôles</option>
          {Object.entries(LIBELLES_ROLES).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </Select>
        <Select name="etat" defaultValue={etat ?? ''} aria-label="État">
          <option value="">Tous</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Désactivés</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>

      {utilisateurs.length === 0 ? (
        <Vide titre="Aucun utilisateur">{q || role || etat ? 'Aucun résultat pour ces filtres.' : undefined}</Vide>
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {utilisateurs.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/utilisateurs/${u.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.nom_complet}</p>
                  <p className="truncate text-sm text-foreground-muted">
                    {u.email} · {u.entreprises?.denomination ?? 'Plateforme PCAS'}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                  <Badge ton="primaire">{u.profils?.libelle ?? LIBELLES_ROLES[u.role_base]}</Badge>
                  {u.signataire && <Badge ton="info">Signataire</Badge>}
                  {!u.actif && <Badge ton="danger">Désactivé</Badge>}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
