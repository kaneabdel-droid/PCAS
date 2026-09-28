import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, Scale } from 'lucide-react'
import { QrDocument } from '@/components/QrDocument'
import { LienImpression } from '@/components/impression/LienImpression'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/champ'
import { Input, Textarea } from '@/components/ui/input'
import { approuverReception, arbitrerLitige, contesterReception } from '@/app/(app)/livraisons/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { STATUTS_RECEPTION } from '@/lib/execution'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Bon de livraison' }

type BonLivraison = {
  id: string
  numero: string
  commande_id: string
  producteur_id: string
  date_livraison: string
  transporteur: string | null
  immatriculation: string | null
  chauffeur: string | null
  commentaire: string | null
  commandes: { numero: string; entete_client: Record<string, string | null>; adresse_livraison: string; contact_livraison: string | null } | null
}
type LigneBL = { id: string; quantite: number; prix_unitaire: number; produits: { nom: string; unite: string } | null }
type Reception = {
  id: string
  numero: string
  statut: string
  date_limite: string
  receptionne_le: string | null
  commentaire: string | null
  motif_litige: string | null
  arbitre_le: string | null
  commentaire_arbitrage: string | null
  br_lignes: { bl_ligne_id: string; quantite_livree: number; quantite_recue: number; motif_ecart: string | null }[]
}

export default async function BonLivraisonPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/livraisons', ['producteur', 'client', 'administrateur', 'superviseur'])
  const droitsClient = await droitsEcran('/livraisons', ['client'])
  const droitsSupervision = await droitsEcran('/supervision/litiges', ['superviseur', 'administrateur'])
  const { id } = await params
  const supabase = await createClient()
  const [{ data: bl }, { data: lignesData }, { data: br }] = await Promise.all([
    supabase
      .from('bons_livraison')
      .select('id, numero, commande_id, producteur_id, date_livraison, transporteur, immatriculation, chauffeur, commentaire, commandes(numero, entete_client, adresse_livraison, contact_livraison)')
      .eq('id', id)
      .maybeSingle<BonLivraison>(),
    supabase.from('bl_lignes').select('id, quantite, prix_unitaire, produits(nom, unite)').eq('bl_id', id).returns<LigneBL[]>(),
    supabase
      .from('bons_reception')
      .select('id, numero, statut, date_limite, receptionne_le, commentaire, motif_litige, arbitre_le, commentaire_arbitrage, br_lignes(bl_ligne_id, quantite_livree, quantite_recue, motif_ecart)')
      .eq('bl_id', id)
      .maybeSingle<Reception>(),
  ])
  if (!bl) notFound()
  const lignes = lignesData ?? []
  const { data: producteur } = await supabase.rpc('producteurs_publics').select('denomination, region').eq('id', bl.producteur_id).maybeSingle()
  const p = producteur as { denomination: string; region: string | null } | null
  const client = bl.commandes?.entete_client ?? {}
  const recues = new Map((br?.br_lignes ?? []).map((l) => [l.bl_ligne_id, l]))
  const st = br ? STATUTS_RECEPTION[br.statut] : null
  const aReceptionner = ctx.role === 'client' && droitsClient.modifier && br?.statut === 'en_attente'
  const aArbitrer = (ctx.role === 'superviseur' || ctx.role === 'administrateur') && droitsSupervision.modifier && br?.statut === 'en_litige'
  const total = lignes.reduce((s, l) => s + Math.round(Number(l.quantite) * l.prix_unitaire), 0)

  const champsQuantites = (
    <div className="space-y-3">
      {lignes.map((l) => (
        <div key={l.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr] sm:items-center">
          <span className="text-sm">
            {l.produits?.nom} <span className="text-foreground-muted">· livré {formatQuantite(l.quantite, l.produits?.unite)}</span>
          </span>
          <Input name={`recu:${l.id}`} inputMode="decimal" defaultValue={Number(l.quantite)} aria-label={`Quantité reçue de ${l.produits?.nom}`} className="h-9" />
          <Input name={`motif:${l.id}`} maxLength={500} placeholder="Motif si écart" aria-label={`Motif d’écart pour ${l.produits?.nom}`} className="h-9" />
        </div>
      ))}
    </div>
  )
  const cachés = (
    <>
      <input type="hidden" name="br_id" value={br?.id ?? ''} />
      <input type="hidden" name="bl_id" value={bl.id} />
      <input type="hidden" name="commande_id" value={bl.commande_id} />
    </>
  )

  return (
    <>
      <Link href="/livraisons" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Livraisons et réceptions
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">Bon de livraison {bl.numero}</h1>
            {st && <Badge ton={st.ton}>{st.libelle}</Badge>}
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Livré le {formatDate(bl.date_livraison)} ·{' '}
            <Link href={`/commandes/${bl.commande_id}`} className="text-primary hover:underline">
              commande {bl.commandes?.numero}
            </Link>
            {br ? ` · bon de réception ${br.numero}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <QrDocument type="bon_livraison" documentId={bl.id} />
          {br && br.statut !== 'en_attente' && br.statut !== 'en_litige' && <QrDocument type="bon_reception" documentId={br.id} />}
          <LienImpression type="bon_livraison" id={bl.id} libelle="Bon de livraison" />
          {br && br.statut !== 'en_attente' && br.statut !== 'en_litige' && <LienImpression type="bon_reception" id={br.id} libelle="Bon de réception" />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="grid gap-6 text-sm sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Producteur</p>
              <p className="font-semibold">{p?.denomination}</p>
              {p?.region && <p className="text-foreground-muted">{p.region}</p>}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Client</p>
              <p className="font-semibold">{client.denomination}</p>
              <p className="text-foreground-muted">{bl.commandes?.adresse_livraison}</p>
              {bl.commandes?.contact_livraison && <p className="text-foreground-muted">{bl.commandes.contact_livraison}</p>}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Transport</p>
              <p>{bl.transporteur ?? '—'}</p>
              <p className="text-foreground-muted">{[bl.immatriculation, bl.chauffeur].filter(Boolean).join(' · ')}</p>
            </div>
          </Card>

          <Card className="p-0 sm:p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-surface-muted text-left text-foreground-muted">
                    <th className="px-4 py-2.5 font-medium">Produit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Livré</th>
                    <th className="px-4 py-2.5 text-right font-medium">Reçu</th>
                    <th className="px-4 py-2.5 text-right font-medium">Montant livré</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => {
                    const r = recues.get(l.id)
                    return (
                      <tr key={l.id} className="border-t border-surface-border align-top">
                        <td className="px-4 py-2.5">
                          {l.produits?.nom}
                          {r?.motif_ecart && <span className="block text-xs text-warning">Écart : {r.motif_ecart}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatQuantite(l.quantite, l.produits?.unite)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r ? formatQuantite(r.quantite_recue) : '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatMontant(Math.round(Number(l.quantite) * l.prix_unitaire))}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-border">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                      Total livré
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMontant(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          {bl.commentaire && <Card className="text-sm"><strong>Commentaire du producteur :</strong> {bl.commentaire}</Card>}
          {br?.commentaire && <Card className="text-sm"><strong>Commentaire de réception :</strong> {br.commentaire}</Card>}
          {br?.motif_litige && (
            <Card className="border-danger/40 text-sm">
              <strong>Contestation du client :</strong> {br.motif_litige}
            </Card>
          )}
          {br?.commentaire_arbitrage && (
            <Card className="text-sm">
              <strong>Arbitrage du superviseur ({formatDate(br.arbitre_le)}) :</strong> {br.commentaire_arbitrage}
            </Card>
          )}
        </div>

        <aside className="no-print space-y-6">
          {br?.statut === 'en_attente' && !aReceptionner && (
            <Card className="text-sm text-foreground-muted">
              En attente de la réception du client. Sans réponse, la réception sera réputée conforme le {formatDate(br.date_limite)}.
            </Card>
          )}
          {aReceptionner && (
            <>
              <Card>
                <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> Confirmer la réception
                </h2>
                <p className="mb-4 text-sm text-foreground-muted">
                  Corrigez les quantités réellement reçues (avec le motif de chaque écart). La facture définitive sera établie sur
                  ces quantités. Sans réponse avant le {formatDate(br!.date_limite)}, la réception sera réputée conforme.
                </p>
                <FormulaireAction action={approuverReception} libelle="Approuver la réception" boutonClassName="w-full">
                  {cachés}
                  {champsQuantites}
                  <Textarea name="commentaire" rows={2} maxLength={1000} placeholder="Commentaire d’approbation" aria-label="Commentaire d’approbation" />
                </FormulaireAction>
              </Card>
              <Card>
                <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                  <AlertTriangle className="h-5 w-5 text-danger" aria-hidden /> Contester
                </h2>
                <p className="mb-4 text-sm text-foreground-muted">Qualité non conforme, marchandise abîmée… Le superviseur arbitrera.</p>
                <FormulaireAction action={contesterReception} libelle="Contester la réception" variante="outline" confirmation="Contester cette réception ?">
                  {cachés}
                  <Textarea name="motif" required minLength={10} rows={3} maxLength={1000} placeholder="Décrivez le problème" aria-label="Motif de la contestation" />
                </FormulaireAction>
              </Card>
            </>
          )}
          {aArbitrer && (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                <Scale className="h-5 w-5 text-primary" aria-hidden /> Arbitrer le litige
              </h2>
              <p className="mb-4 text-sm text-foreground-muted">Fixez les quantités acceptées : la facture définitive sera établie sur ces quantités.</p>
              <FormulaireAction action={arbitrerLitige} libelle="Enregistrer l’arbitrage" boutonClassName="w-full" confirmation="Enregistrer cet arbitrage ? Il est définitif.">
                {cachés}
                {champsQuantites}
                <Textarea name="commentaire" required minLength={3} rows={3} maxLength={1000} placeholder="Motivation de l’arbitrage (obligatoire)" aria-label="Motivation" />
              </FormulaireAction>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
