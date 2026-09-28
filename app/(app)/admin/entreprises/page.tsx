import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { LIBELLES_TYPES_ENTREPRISE, type TypeEntreprise } from '@/lib/roles'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Entreprises' }

type Ligne = {
  id: string
  type: TypeEntreprise
  denomination: string
  region: string | null
  identifiant_fiscal: string | null
  type_identifiant: string
  logo_path: string | null
  statut: 'actif' | 'suspendu'
  utilisateurs: { count: number }[]
}

export default async function EntreprisesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; statut?: string }>
}) {
  const { q, type, statut } = await searchParams
  const supabase = await createClient()
  let requete = supabase
    .from('entreprises')
    .select('id, type, denomination, region, identifiant_fiscal, type_identifiant, logo_path, statut, utilisateurs(count)')
    .order('denomination')
  if (q?.trim()) {
    const motif = `%${q.trim().replace(/[%_,()]/g, ' ')}%`
    requete = requete.or(`denomination.ilike.${motif},identifiant_fiscal.ilike.${motif},sigle.ilike.${motif}`)
  }
  if (type && type in LIBELLES_TYPES_ENTREPRISE) requete = requete.eq('type', type)
  if (statut === 'actif' || statut === 'suspendu') requete = requete.eq('statut', statut)
  const { data } = await requete.returns<Ligne[]>()
  const entreprises = data ?? []

  return (
    <>
      <PageHeader titre="Entreprises" description="Producteurs, clients et banques inscrits sur la plateforme.">
        <Button asChild>
          <Link href="/admin/entreprises/nouvelle">
            <Plus className="h-4 w-4" aria-hidden /> Nouvelle entreprise
          </Link>
        </Button>
      </PageHeader>

      <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_10rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="Dénomination, sigle ou NINEA" className="pl-9" aria-label="Rechercher" />
        </div>
        <Select name="type" defaultValue={type ?? ''} aria-label="Type">
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_TYPES_ENTREPRISE).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </Select>
        <Select name="statut" defaultValue={statut ?? ''} aria-label="Statut">
          <option value="">Tous statuts</option>
          <option value="actif">Actives</option>
          <option value="suspendu">Suspendues</option>
        </Select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>

      {entreprises.length === 0 ? (
        <Vide titre="Aucune entreprise">
          {q || type || statut ? 'Aucun résultat pour ces filtres.' : 'Créez la première entreprise de la plateforme.'}
        </Vide>
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {entreprises.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/entreprises/${e.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted">
                <LogoEntreprise chemin={e.logo_path} denomination={e.denomination} taille={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.denomination}</p>
                  <p className="truncate text-sm text-foreground-muted">
                    {[e.identifiant_fiscal && `${e.type_identifiant} ${e.identifiant_fiscal}`, e.region].filter(Boolean).join(' · ') ||
                      'Fiche à compléter'}
                  </p>
                </div>
                <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                  <Badge ton="primaire">{LIBELLES_TYPES_ENTREPRISE[e.type]}</Badge>
                  <Badge>
                    {e.utilisateurs[0]?.count ?? 0} utilisateur{(e.utilisateurs[0]?.count ?? 0) > 1 ? 's' : ''}
                  </Badge>
                  {e.statut === 'suspendu' && <Badge ton="danger">Suspendue</Badge>}
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
