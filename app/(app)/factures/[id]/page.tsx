import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Landmark } from 'lucide-react'
import { QrDocument } from '@/components/QrDocument'
import { LienImpression } from '@/components/impression/LienImpression'
import { FormulaireAction } from '@/components/FormulaireAction'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { annulerPaiement, marquerPayee } from '@/app/(app)/factures/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { MODES_REGLEMENT, STATUTS_ECHEANCE, STATUTS_FACTURE } from '@/lib/execution'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant, ilYa } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Facture' }

type Facture = {
  id: string
  numero: string
  nature: 'provisoire' | 'definitive'
  statut: string
  commande_id: string
  bl_id: string | null
  producteur_id: string
  date_facture: string
  montant_total: number
  mention_tva: string | null
  compte_bancaire: { banque?: string; intitule?: string; numero_compte?: string; code_swift?: string | null } | null
  commandes: { numero: string; entete_client: Record<string, string | null>; mode_paiement: string } | null
  bons_livraison: { numero: string } | null
}
type Ligne = { id: string; quantite: number; prix_unitaire: number; montant: number; produits: { nom: string; unite: string } | null }
type Echeance = {
  id: string
  rang: number
  date_echeance: string
  montant: number
  statut: string
  payee_le: string | null
  mode_reglement: string | null
  reference: string | null
  saisie_paiement_le: string | null
}

export default async function FacturePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/factures', ['producteur', 'client', 'financier', 'administrateur', 'superviseur'])
  const { modifier } = await droitsEcran('/echeances', ['producteur'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data: f }, { data: lignes }, { data: echeances }, { data: liens }] = await Promise.all([
    supabase
      .from('factures')
      .select('id, numero, nature, statut, commande_id, bl_id, producteur_id, date_facture, montant_total, mention_tva, compte_bancaire, commandes(numero, entete_client, mode_paiement), bons_livraison(numero)')
      .eq('id', id)
      .maybeSingle<Facture>(),
    supabase.from('lignes_facture').select('id, quantite, prix_unitaire, montant, produits(nom, unite)').eq('facture_id', id).returns<Ligne[]>(),
    supabase.from('echeances').select('id, rang, date_echeance, montant, statut, payee_le, mode_reglement, reference, saisie_paiement_le').eq('facture_id', id).order('rang').returns<Echeance[]>(),
    supabase.from('factures_definitives_provisoires').select('facture_definitive_id, facture_provisoire_id').or(`facture_definitive_id.eq.${id},facture_provisoire_id.eq.${id}`),
  ])
  if (!f) notFound()
  const idsLies = (liens ?? []).map((l) => (l.facture_definitive_id === id ? l.facture_provisoire_id : l.facture_definitive_id))
  const [{ data: liees }, { data: producteur }] = await Promise.all([
    idsLies.length ? supabase.from('factures').select('id, numero, nature').in('id', idsLies) : Promise.resolve({ data: [] as { id: string; numero: string; nature: string }[] }),
    supabase.rpc('producteurs_publics').select('denomination, region, commune, logo_path').eq('id', f.producteur_id).maybeSingle(),
  ])
  const p = producteur as { denomination: string; region: string | null; commune: string | null; logo_path: string | null } | null
  const client = f.commandes?.entete_client ?? {}
  const st = STATUTS_FACTURE[f.statut]
  const emetteur = ctx.role === 'producteur' && modifier
  const aujourdhui = new Date().toISOString().slice(0, 10)
  // Annulation d'une confirmation possible pendant 48 h (contrôlé aussi en base)
  const limiteAnnulation = ilYa(48)

  return (
    <>
      <Link href="/factures" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Factures
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">
              Facture {f.nature === 'provisoire' ? 'provisoire' : 'définitive'} {f.numero}
            </h1>
            <Badge ton={st.ton}>{st.libelle}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Du {formatDate(f.date_facture)} ·{' '}
            <Link href={`/commandes/${f.commande_id}`} className="text-primary hover:underline">
              commande {f.commandes?.numero}
            </Link>
            {f.bons_livraison && f.bl_id && (
              <>
                {' '}·{' '}
                <Link href={`/livraisons/${f.bl_id}`} className="text-primary hover:underline">
                  bon de livraison {f.bons_livraison.numero}
                </Link>
              </>
            )}
          </p>
          {(liees ?? []).length > 0 && (
            <p className="text-sm text-foreground-muted">
              {f.nature === 'provisoire' ? 'Remplacée par ' : 'Remplace '}
              {liees!.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && ', '}
                  <Link href={`/factures/${l.id}`} className="font-mono text-primary hover:underline">
                    {l.numero}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <QrDocument type="facture" documentId={f.id} />
          <LienImpression type="facture" id={f.id} />
        </div>
      </div>

      {f.nature === 'provisoire' && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-center text-sm font-semibold uppercase tracking-wide">
          Provisoire — non exigible. La facture définitive est établie sur les quantités reçues.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="grid gap-6 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <LogoEntreprise chemin={p?.logo_path ?? null} denomination={p?.denomination ?? ''} taille={44} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Émetteur (producteur)</p>
                <p className="font-semibold">{p?.denomination}</p>
                <p className="text-foreground-muted">{[p?.commune, p?.region].filter(Boolean).join(', ')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <LogoEntreprise chemin={client.logo_path ?? null} denomination={client.denomination ?? ''} taille={44} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Client</p>
                <p className="font-semibold">{client.denomination}</p>
                <p className="text-foreground-muted">{[client.adresse, client.region].filter(Boolean).join(', ')}</p>
                {client.identifiant_fiscal && (
                  <p className="text-foreground-muted">
                    {client.type_identifiant} {client.identifiant_fiscal}
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-foreground-muted">
                    <th className="px-4 py-2.5 font-medium">Produit</th>
                    <th className="px-4 py-2.5 text-right font-medium">{f.nature === 'provisoire' ? 'Livré' : 'Reçu'}</th>
                    <th className="px-4 py-2.5 text-right font-medium">Prix unitaire</th>
                    <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(lignes ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-surface-border">
                      <td className="px-4 py-2.5">{l.produits?.nom}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatQuantite(l.quantite, l.produits?.unite)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMontant(l.prix_unitaire)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMontant(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-border">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                      Total {f.mention_tva ? <span className="font-normal text-foreground-muted">({f.mention_tva})</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right font-heading text-lg font-semibold tabular-nums">{formatMontant(f.montant_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {f.compte_bancaire?.numero_compte && (
            <Card className="flex items-start gap-3 text-sm">
              <Landmark className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-semibold">Paiement par virement : {f.compte_bancaire.banque}</p>
                <p className="text-foreground-muted">{f.compte_bancaire.intitule}</p>
                <p className="font-mono">{f.compte_bancaire.numero_compte}</p>
                {f.compte_bancaire.code_swift && <p className="text-foreground-muted">SWIFT / BIC : {f.compte_bancaire.code_swift}</p>}
              </div>
            </Card>
          )}
        </div>

        {f.nature === 'definitive' && (
          <aside className="space-y-4">
            <h2 className="font-heading text-lg font-semibold">Échéances</h2>
            {(echeances ?? []).map((e) => {
              const ste = STATUTS_ECHEANCE[e.statut]
              const annulable = emetteur && e.statut === 'payee' && e.saisie_paiement_le && e.saisie_paiement_le > limiteAnnulation
              return (
                <Card key={e.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold tabular-nums">{formatMontant(e.montant)}</p>
                      <p className="text-sm text-foreground-muted">
                        Échéance {e.rang} · le {formatDate(e.date_echeance)}
                      </p>
                    </div>
                    <Badge ton={ste.ton}>{ste.libelle}</Badge>
                  </div>
                  {e.statut === 'payee' && (
                    <p className="text-sm text-foreground-muted">
                      Payée le {formatDate(e.payee_le)} · {MODES_REGLEMENT[e.mode_reglement ?? 'autre']}
                      {e.reference ? ` · réf. ${e.reference}` : ''}
                    </p>
                  )}
                  {emetteur && e.statut !== 'payee' && (
                    <details className="no-print rounded-lg border border-surface-border">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">Confirmer le paiement reçu</summary>
                      <div className="border-t border-surface-border p-3">
                        <FormulaireAction action={marquerPayee} libelle="Marquer payée" boutonClassName="w-full" confirmation="Confirmer que ce paiement a bien été reçu ?">
                          <input type="hidden" name="echeance_id" value={e.id} />
                          <input type="hidden" name="facture_id" value={f.id} />
                          <GrilleChamps>
                            <Champ id={`date-${e.id}`} label="Reçu le" requis>
                              <Input id={`date-${e.id}`} name="payee_le" type="date" required max={aujourdhui} defaultValue={aujourdhui} />
                            </Champ>
                            <Champ id={`mode-${e.id}`} label="Mode" requis>
                              <Select id={`mode-${e.id}`} name="mode_reglement" required defaultValue={f.commandes?.mode_paiement ?? 'virement'}>
                                {Object.entries(MODES_REGLEMENT).map(([cle, libelle]) => (
                                  <option key={cle} value={cle}>
                                    {libelle}
                                  </option>
                                ))}
                              </Select>
                            </Champ>
                            <Champ id={`ref-${e.id}`} label="Référence (n° de chèque, de virement…)" className="sm:col-span-2">
                              <Input id={`ref-${e.id}`} name="reference" maxLength={100} />
                            </Champ>
                          </GrilleChamps>
                        </FormulaireAction>
                      </div>
                    </details>
                  )}
                  {annulable && (
                    <details className="no-print rounded-lg border border-surface-border">
                      <summary className="cursor-pointer px-3 py-2 text-sm text-foreground-muted">Annuler cette confirmation (erreur de saisie)</summary>
                      <div className="border-t border-surface-border p-3">
                        <FormulaireAction action={annulerPaiement} libelle="Annuler la confirmation" variante="outline" confirmation="Annuler la confirmation de ce paiement ?">
                          <input type="hidden" name="echeance_id" value={e.id} />
                          <input type="hidden" name="facture_id" value={f.id} />
                          <Input name="motif" required minLength={3} maxLength={300} placeholder="Motif" aria-label="Motif de l’annulation" />
                        </FormulaireAction>
                      </div>
                    </details>
                  )}
                </Card>
              )
            })}
            {ctx.role !== 'producteur' && (
              <p className="text-xs text-foreground-muted">Seul le producteur confirme la réception de chaque paiement.</p>
            )}
          </aside>
        )}
      </div>
    </>
  )
}
