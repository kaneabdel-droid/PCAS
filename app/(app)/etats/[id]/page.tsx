import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { EtatTableau } from '@/components/etats/EtatTableau'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { exigerLecture } from '@/lib/droits'
import { ETATS, formaterValeur, raccourcisPeriode, type Valeur } from '@/lib/etats'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'État' }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function EtatPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ du?: string; au?: string; regroupement?: string }> }) {
  const ctx = await exigerLecture('/etats', ['administrateur', 'superviseur', 'producteur', 'client', 'financier'])
  const { id } = await params
  const etat = ETATS.find((e) => e.id === id)
  if (!etat || !etat.roles.includes(ctx.role)) notFound()

  const raccourcis = raccourcisPeriode()
  const s = await searchParams
  const du = s.du && DATE.test(s.du) ? s.du : raccourcis[0].du
  const au = s.au && DATE.test(s.au) ? s.au : raccourcis[0].au
  const regroupement = etat.regroupements?.some((r) => r.cle === s.regroupement) ? s.regroupement : etat.regroupements?.[0].cle
  const filtres = { du, au, regroupement }

  const colonnes = etat.colonnes(filtres)
  const brutes: Valeur[][] = await etat.charger(filtres)
  const lignes = brutes.map((l) => l.map((v, i) => formaterValeur(v, colonnes[i].type)))
  const totaux = colonnes.map((c, i) =>
    c.type === 'montant' ? formaterValeur(brutes.reduce((t, l) => t + (typeof l[i] === 'number' ? (l[i] as number) : 0), 0), 'montant') : i === 0 ? 'Total' : null
  )
  const libelleRegroupement = etat.regroupements?.find((r) => r.cle === regroupement)?.libelle
  const sousTitre = [
    etat.periode ? `${etat.periode} du ${formatDate(du)} au ${formatDate(au)}` : `À la date du ${formatDate(new Date().toISOString())}`,
    libelleRegroupement,
    ctx.entrepriseNom ?? 'Plateforme PCAS',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <Link href="/etats" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Impressions et états
      </Link>
      <div className="no-print">
        <PageHeader titre={etat.titre} description={etat.description} />
      </div>

      {(etat.periode || etat.regroupements) && (
        <form method="get" className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-surface-border bg-surface p-3">
          {etat.periode && (
            <>
              <label className="text-sm">
                <span className="mb-1 block text-foreground-muted">Du</span>
                <Input type="date" name="du" defaultValue={du} className="w-auto" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-foreground-muted">Au</span>
                <Input type="date" name="au" defaultValue={au} className="w-auto" />
              </label>
            </>
          )}
          {etat.regroupements && (
            <label className="text-sm">
              <span className="mb-1 block text-foreground-muted">Regroupement</span>
              <Select name="regroupement" defaultValue={regroupement} className="w-auto">
                {etat.regroupements.map((r) => (
                  <option key={r.cle} value={r.cle}>
                    {r.libelle}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <Button type="submit">Afficher</Button>
          {etat.periode && (
            <div className="flex flex-wrap gap-1.5">
              {raccourcis.map((r) => (
                <Link
                  key={r.libelle}
                  href={`/etats/${etat.id}?${new URLSearchParams({ du: r.du, au: r.au, ...(regroupement ? { regroupement } : {}) })}`}
                  className="rounded-full border border-surface-border px-3 py-1 text-xs hover:border-primary hover:text-primary"
                >
                  {r.libelle}
                </Link>
              ))}
            </div>
          )}
        </form>
      )}

      <p className="no-print mb-4 text-sm text-foreground-muted">{sousTitre}</p>
      <EtatTableau
        titre={etat.titre}
        sousTitre={sousTitre}
        colonnes={colonnes.map((c) => ({ libelle: c.libelle, nombre: c.type === 'montant' || c.type === 'quantite' }))}
        lignes={lignes}
        csv={brutes}
        totaux={totaux}
        orientationDefaut={etat.orientation}
        nomFichier={`PCAS-${etat.id}-${du}-${au}`}
      />
    </>
  )
}
