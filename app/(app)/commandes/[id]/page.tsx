import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { QrDocument } from '@/components/QrDocument'
import { LienImpression } from '@/components/impression/LienImpression'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Avancement } from '@/components/commandes/Avancement'
import { ExecutionCommande } from '@/components/commandes/ExecutionCommande'
import { Frise, type Evenement } from '@/components/commandes/Frise'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { annulerCommande } from '@/app/(app)/commandes/actions'
import { STATUTS_BON } from '@/lib/bons'
import { MODES_PAIEMENT, STATUTS_COMMANDE } from '@/lib/commandes'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { STATUTS_A_TRAITER } from '@/lib/supervision'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Commande' }

type Commande = {
  id: string
  numero: string
  statut: string
  client_id: string
  producteur_id: string
  mode_paiement: string
  banque_id: string | null
  adresse_livraison: string
  region_livraison: string | null
  contact_livraison: string | null
  date_souhaitee: string | null
  date_livraison_convenue: string | null
  entete_client: Record<string, string | null>
  montant_total: number
  commentaire: string | null
  motif: string | null
  soumise_le: string
  besoin_id: string | null
  facturation_groupee: boolean
}

type Ligne = {
  id: string
  quantite: number
  prix_unitaire: number
  montant: number
  date_disponibilite: string | null
  produits: { nom: string; unite: string } | null
}

export default async function CommandePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/commandes', ['client', 'producteur', 'administrateur', 'superviseur'])
  const { modifier } = await droitsEcran('/commandes', ['client'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data: c }, { data: lignes }, { data: echeancier }, { data: evenements }] = await Promise.all([
    supabase.from('commandes').select('*').eq('id', id).maybeSingle<Commande>(),
    supabase.from('lignes_commande').select('id, quantite, prix_unitaire, montant, date_disponibilite, produits(nom, unite)').eq('commande_id', id).returns<Ligne[]>(),
    supabase.from('echeancier_commande').select('rang, pourcentage, delai_jours').eq('commande_id', id).order('rang'),
    supabase.from('commande_evenements').select('id, horodatage, acteur_nom, acteur_role, action, commentaire').eq('commande_id', id).order('horodatage').returns<Evenement[]>(),
  ])
  if (!c) notFound()

  const [{ data: producteur }, { data: banque }, { data: bons }] = await Promise.all([
    supabase.rpc('producteurs_publics').select('denomination, region, commune, logo_path').eq('id', c.producteur_id).maybeSingle(),
    c.banque_id ? supabase.rpc('banques_publiques').select('denomination').eq('id', c.banque_id).maybeSingle() : Promise.resolve({ data: null }),
    c.mode_paiement === 'bon_banque'
      ? supabase.from('bons_paiement').select('id, numero, statut, reference_bancaire').eq('commande_id', c.id).order('created_at')
      : Promise.resolve({ data: [] }),
  ])
  const statut = STATUTS_COMMANDE[c.statut]
  const client = c.entete_client
  const annulable = ctx.role === 'client' && modifier && ['soumise', 'en_attente'].includes(c.statut)

  return (
    <>
      <Link href="/commandes" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Commandes
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">Commande {c.numero}</h1>
            <Badge ton={statut.ton}>{statut.libelle}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Émise le {formatDate(c.soumise_le)} · {formatMontant(c.montant_total)}
            {c.besoin_id ? ' · issue d’un besoin d’achat' : ''}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {(ctx.role === 'superviseur' || ctx.role === 'administrateur') && STATUTS_A_TRAITER.includes(c.statut) && (
            <Button asChild>
              <Link href={`/supervision/approbations/${c.id}`}>Traiter la commande</Link>
            </Button>
          )}
          <LienImpression type="commande" id={c.id} />
        </div>
      </div>
      <QrDocument type="commande" documentId={c.id} className="mb-6" />

      <div className="mb-6">
        <Avancement statut={c.statut} />
      </div>

      <ExecutionCommande commandeId={c.id} statut={c.statut} facturationGroupee={c.facturation_groupee} ctx={ctx} />

      {c.motif && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>Motif :</strong> {c.motif}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Client</p>
              <div className="flex items-start gap-3">
                <LogoEntreprise chemin={client.logo_path ?? null} denomination={client.denomination ?? ''} taille={44} />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{client.denomination}</p>
                  {client.adresse && <p className="text-foreground-muted">{[client.adresse, client.commune, client.region].filter(Boolean).join(', ')}</p>}
                  {client.identifiant_fiscal && (
                    <p className="text-foreground-muted">
                      {client.type_identifiant} {client.identifiant_fiscal}
                      {client.rccm ? ` · RCCM ${client.rccm}` : ''}
                    </p>
                  )}
                  {(client.telephone || client.email) && <p className="text-foreground-muted">{[client.telephone, client.email].filter(Boolean).join(' · ')}</p>}
                </div>
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Producteur</p>
              <div className="flex items-start gap-3">
                <LogoEntreprise chemin={producteur?.logo_path ?? null} denomination={producteur?.denomination ?? ''} taille={44} />
                <div className="text-sm">
                  <p className="font-semibold">{producteur?.denomination ?? '—'}</p>
                  <p className="text-foreground-muted">{[producteur?.commune, producteur?.region].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-foreground-muted">
                    <th className="px-4 py-2.5 font-medium">Produit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Quantité</th>
                    <th className="px-4 py-2.5 text-right font-medium">Prix unitaire</th>
                    <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(lignes ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-surface-border">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{l.produits?.nom}</span>
                        {l.date_disponibilite && <span className="block text-xs text-foreground-muted">Disponible le {formatDate(l.date_disponibilite)}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatQuantite(l.quantite, l.produits?.unite)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMontant(l.prix_unitaire)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatMontant(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-border">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-heading text-lg font-semibold tabular-nums">{formatMontant(c.montant_total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Livraison</p>
              <p>{c.adresse_livraison}</p>
              {c.region_livraison && <p className="text-foreground-muted">{c.region_livraison}</p>}
              {c.contact_livraison && <p className="text-foreground-muted">Contact : {c.contact_livraison}</p>}
              <p className="mt-2">
                Souhaitée : <strong>{c.date_souhaitee ? formatDate(c.date_souhaitee) : '—'}</strong>
              </p>
              <p>
                Convenue : <strong>{c.date_livraison_convenue ? formatDate(c.date_livraison_convenue) : 'à fixer par le superviseur'}</strong>
              </p>
            </Card>
            <Card className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Paiement</p>
              <p className="font-medium">
                {MODES_PAIEMENT[c.mode_paiement]}
                {banque ? ` · ${banque.denomination}` : ''}
              </p>
              {(bons ?? []).map((b) => (
                <Link key={b.id} href={`/bons-paiement/${b.id}`} className="mt-1 flex items-center gap-2 text-primary hover:underline">
                  Bon {b.numero} <Badge ton={STATUTS_BON[b.statut].ton}>{STATUTS_BON[b.statut].libelle}</Badge>
                  {b.reference_bancaire ? <span className="text-foreground-muted">réf. {b.reference_bancaire}</span> : null}
                </Link>
              ))}
              <ul className="mt-2 space-y-1">
                {(echeancier ?? []).map((e) => (
                  <li key={e.rang} className="flex justify-between gap-2">
                    <span className="text-foreground-muted">
                      {Number(e.pourcentage).toLocaleString('fr-FR')} % {e.delai_jours === 0 ? 'à réception' : `à ${e.delai_jours} jours`}
                    </span>
                    <span className="tabular-nums">{formatMontant(Math.round((c.montant_total * Number(e.pourcentage)) / 100))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          {c.commentaire && (
            <Card className="text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Commentaire du client</p>
              <p className="whitespace-pre-line">{c.commentaire}</p>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 font-heading font-semibold">Suivi</h2>
            <Frise evenements={evenements ?? []} />
          </Card>
          {annulable && (
            <Card className="no-print">
              <h2 className="font-heading font-semibold">Annuler la commande</h2>
              <p className="mb-3 mt-1 text-sm text-foreground-muted">Possible tant que le superviseur ne l’a pas approuvée.</p>
              <FormulaireAction action={annulerCommande} libelle="Annuler la commande" variante="outline" confirmation="Annuler définitivement cette commande ?">
                <input type="hidden" name="commande_id" value={c.id} />
                <Champ id="motif" label="Motif (facultatif)">
                  <Input id="motif" name="motif" maxLength={300} />
                </Champ>
              </FormulaireAction>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
