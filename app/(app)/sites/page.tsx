import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MapPin } from 'lucide-react'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Sites de production' }

type Site = {
  id: string
  nom: string
  region: string | null
  commune: string | null
  localite: string | null
  superficie_ha: number | null
  jours_ouvres_semaine: number
  actif: boolean
  entreprises: { id: string; denomination: string } | null
  capacites_production: { id: string; capacite_jour: number; produits: { nom: string; unite: string } | null }[]
}

/** Producteur : ses sites se gèrent dans sa fiche entreprise. Plateforme : vue de tous les sites et de leurs capacités. */
export default async function SitesPage({ searchParams }: { searchParams: Promise<{ region?: string }> }) {
  const ctx = await exigerLecture('/sites', ['producteur', 'administrateur', 'superviseur'])
  if (ctx.role === 'producteur') redirect('/entreprise?onglet=sites')

  const { region } = await searchParams
  const supabase = await createClient()
  let requete = supabase
    .from('sites_production')
    .select('id, nom, region, commune, localite, superficie_ha, jours_ouvres_semaine, actif, entreprises(id, denomination), capacites_production(id, capacite_jour, produits(nom, unite))')
    .order('region')
    .order('nom')
  if (region) requete = requete.eq('region', region)
  const { data } = await requete.returns<Site[]>()
  const sites = data ?? []
  const regions = [...new Set(sites.map((s) => s.region).filter(Boolean))] as string[]

  return (
    <>
      <PageHeader titre="Sites de production" description="Sites déclarés par les producteurs et capacité de production par jour ouvré." />
      {regions.length > 1 && !region && (
        <div className="mb-4 flex flex-wrap gap-2">
          {regions.map((r) => (
            <Link key={r} href={`/sites?region=${encodeURIComponent(r)}`} className="rounded-full border border-surface-border bg-surface px-3 py-1 text-sm hover:border-primary">
              {r}
            </Link>
          ))}
        </div>
      )}
      {sites.length === 0 ? (
        <Vide titre="Aucun site de production déclaré" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => (
            <li key={s.id}>
              <Card className="h-full space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-semibold">{s.nom}</p>
                    {ctx.role === 'administrateur' ? (
                      <Link href={`/admin/entreprises/${s.entreprises?.id}?onglet=sites`} className="text-sm text-primary hover:underline">
                        {s.entreprises?.denomination}
                      </Link>
                    ) : (
                      <p className="text-sm text-foreground-muted">{s.entreprises?.denomination}</p>
                    )}
                  </div>
                  {!s.actif && <Badge ton="alerte">Inactif</Badge>}
                </div>
                <p className="flex items-center gap-1 text-sm text-foreground-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {[s.localite, s.commune, s.region].filter(Boolean).join(', ') || '—'}
                </p>
                {s.capacites_production.length > 0 ? (
                  <ul className="space-y-1 border-t border-surface-border pt-3 text-sm">
                    {s.capacites_production.map((c) => (
                      <li key={c.id} className="flex justify-between gap-2">
                        <span>{c.produits?.nom}</span>
                        <span className="tabular-nums text-foreground-muted">{formatQuantite(c.capacite_jour, c.produits?.unite)} / jour</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-surface-border pt-3 text-sm text-foreground-muted">Aucune capacité déclarée.</p>
                )}
                <p className="text-xs text-foreground-muted">
                  {s.jours_ouvres_semaine} jours ouvrés / semaine{s.superficie_ha ? ` · ${formatQuantite(s.superficie_ha)} ha` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
