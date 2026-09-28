import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Badge, Vide } from '@/components/ui/champ'
import { Select } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Journal d’audit' }

const PAR_PAGE = 50

const TABLES: Record<string, string> = {
  entreprises: 'Entreprise',
  utilisateurs: 'Utilisateur',
  profils: 'Profil',
  entreprise_comptes_bancaires: 'Compte bancaire',
  sites_production: 'Site de production',
  produits: 'Produit',
  transformations: 'Rendement',
  parametres_plateforme: 'Paramètres',
  modeles_contrat: 'Contrat (modèle)',
  acceptations_contrat: 'Contrat accepté',
  offres: 'Offre',
}

const ACTIONS: Record<string, string> = { creation: 'Création', modification: 'Modification', suppression: 'Suppression' }

// Champs techniques jamais affichés dans le détail.
const MASQUES = new Set(['id', 'created_at', 'updated_at', 'created_by'])

type Ligne = {
  id: number
  horodatage: string
  auteur_email: string | null
  table_nom: string
  entreprise_id: string | null
  action: 'creation' | 'modification' | 'suppression'
  champs: string[] | null
  avant: Record<string, unknown> | null
  apres: Record<string, unknown> | null
  sensible: boolean
}

function valeur(v: unknown) {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function libelleLigne(l: Ligne) {
  const d = l.apres ?? l.avant ?? {}
  return String(d.denomination ?? d.nom_complet ?? d.nom ?? d.libelle ?? d.banque ?? d.titre ?? d.nom_signataire ?? '')
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ sensible?: string; table?: string; page?: string }> }) {
  const { sensible, table, page } = await searchParams
  const numero = Math.max(1, Number(page) || 1)
  const supabase = await createClient()
  let requete = supabase
    .from('journal_audit')
    .select('id, horodatage, auteur_email, table_nom, entreprise_id, action, champs, avant, apres, sensible')
    .order('horodatage', { ascending: false })
    .range((numero - 1) * PAR_PAGE, numero * PAR_PAGE) // une ligne de plus pour savoir s'il y a une page suivante
  if (sensible === '1') requete = requete.eq('sensible', true)
  if (table && table in TABLES) requete = requete.eq('table_nom', table)
  const { data } = await requete.returns<Ligne[]>()
  const lignes = (data ?? []).slice(0, PAR_PAGE)
  const suivante = (data?.length ?? 0) > PAR_PAGE
  const lien = (p: number) => `/admin/journal?${new URLSearchParams({ ...(sensible ? { sensible } : {}), ...(table ? { table } : {}), page: String(p) })}`

  return (
    <>
      <PageHeader
        titre="Journal d’audit"
        description="Toutes les créations, modifications et suppressions, avec leur auteur. Les opérations sensibles (comptes bancaires, identifiant fiscal, suspension, rôles, suppressions) sont signalées."
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-3">
        <Select name="table" defaultValue={table ?? ''} aria-label="Élément" className="w-auto">
          <option value="">Tous les éléments</option>
          {Object.entries(TABLES).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sensible" value="1" defaultChecked={sensible === '1'} className="h-4 w-4 accent-primary" /> Opérations
          sensibles uniquement
        </label>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>

      {lignes.length === 0 ? (
        <Vide titre="Aucune opération enregistrée" />
      ) : (
        <ul className="space-y-2">
          {lignes.map((l) => (
            <li key={l.id} className={`rounded-xl border bg-surface ${l.sensible ? 'border-warning/50' : 'border-surface-border'}`}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  {l.sensible && <ShieldAlert className="h-4 w-4 text-warning" aria-label="Opération sensible" />}
                  <span className="text-sm tabular-nums text-foreground-muted">
                    {new Date(l.horodatage).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Dakar' })}
                  </span>
                  <Badge ton={l.action === 'suppression' ? 'danger' : l.action === 'creation' ? 'succes' : 'info'}>{ACTIONS[l.action]}</Badge>
                  <span className="text-sm font-medium">
                    {TABLES[l.table_nom] ?? l.table_nom}
                    {libelleLigne(l) && ` · ${libelleLigne(l)}`}
                  </span>
                  <span className="ml-auto text-sm text-foreground-muted">{l.auteur_email ?? 'Système'}</span>
                </summary>
                <div className="overflow-x-auto border-t border-surface-border px-4 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-foreground-muted">
                        <th className="py-1 pr-4 font-medium">Champ</th>
                        {l.action !== 'creation' && <th className="py-1 pr-4 font-medium">Avant</th>}
                        {l.action !== 'suppression' && <th className="py-1 font-medium">Après</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(l.champs ?? Object.keys(l.apres ?? l.avant ?? {}))
                        .filter((c) => !MASQUES.has(c))
                        .map((c) => (
                          <tr key={c} className="border-t border-surface-border align-top">
                            <td className="py-1 pr-4 font-mono text-xs">{c}</td>
                            {l.action !== 'creation' && <td className="max-w-xs break-words py-1 pr-4">{valeur(l.avant?.[c])}</td>}
                            {l.action !== 'suppression' && <td className="max-w-xs break-words py-1">{valeur(l.apres?.[c])}</td>}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {l.entreprise_id && (
                    <Link href={`/admin/entreprises/${l.entreprise_id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                      Voir l’entreprise
                    </Link>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-between">
        {numero > 1 ? (
          <Button asChild variant="outline">
            <Link href={lien(numero - 1)}>Plus récents</Link>
          </Button>
        ) : (
          <span />
        )}
        {suivante && (
          <Button asChild variant="outline">
            <Link href={lien(numero + 1)}>Plus anciens</Link>
          </Button>
        )}
      </div>
    </>
  )
}
