import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react'
import { QrDocument } from '@/components/QrDocument'
import { LienImpression } from '@/components/impression/LienImpression'
import { FormulaireAction } from '@/components/FormulaireAction'
import { LogoEntreprise } from '@/components/entreprise/LogoEntreprise'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { deciderBon } from '@/app/(app)/bons-paiement/actions'
import { STATUTS_BON, type Bon } from '@/lib/bons'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Bon de paiement' }

type Commande = {
  id: string
  numero: string
  statut: string
  producteur_id: string
  montant_total: number
  date_livraison_convenue: string | null
  adresse_livraison: string
  entete_client: Record<string, string | null>
}

export default async function BonPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await exigerLecture('/bons-paiement', ['financier', 'client', 'administrateur', 'superviseur'])
  const { modifier } = await droitsEcran('/bons-paiement', ['financier'])
  const { id } = await params
  const supabase = await createClient()
  const { data: bon } = await supabase.from('bons_paiement').select('*').eq('id', id).maybeSingle<Bon>()
  if (!bon) notFound()

  const [{ data: commande }, { data: lignes }, { data: echeancier }, { data: banque }] = await Promise.all([
    supabase
      .from('commandes')
      .select('id, numero, statut, producteur_id, montant_total, date_livraison_convenue, adresse_livraison, entete_client')
      .eq('id', bon.commande_id)
      .maybeSingle<Commande>(),
    supabase.from('lignes_commande').select('id, quantite, prix_unitaire, montant, produits(nom, unite)').eq('commande_id', bon.commande_id),
    supabase.from('echeancier_commande').select('rang, pourcentage, delai_jours').eq('commande_id', bon.commande_id).order('rang'),
    supabase.rpc('banques_publiques').select('denomination, logo_path').eq('id', bon.banque_id).maybeSingle(),
  ])
  const { data: producteur } = commande
    ? await supabase.rpc('producteurs_publics').select('denomination, region').eq('id', commande.producteur_id).maybeSingle()
    : { data: null }
  const client = commande?.entete_client ?? {}
  const statut = STATUTS_BON[bon.statut]
  const aDecider = ctx.role === 'financier' && modifier && bon.statut === 'soumis' && commande?.statut === 'attente_banque'
  const b = banque as { denomination: string; logo_path: string | null } | null
  const p = producteur as { denomination: string; region: string | null } | null

  return (
    <>
      <Link href="/bons-paiement" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Bons de paiement
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold">Bon de paiement {bon.numero}</h1>
            <Badge ton={statut.ton}>{statut.libelle}</Badge>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Émis le {formatDate(bon.created_at)}
            {bon.decide_le ? ` · décidé le ${formatDate(bon.decide_le)}` : ''}
            {bon.reference_bancaire ? ` · référence bancaire ${bon.reference_bancaire}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <QrDocument type="bon_paiement" documentId={bon.id} />
          <LienImpression type="bon_paiement" id={bon.id} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Banque</p>
              <div className="flex items-center gap-2">
                <LogoEntreprise chemin={b?.logo_path ?? null} denomination={b?.denomination ?? ''} taille={36} />
                <p className="font-semibold">{b?.denomination}</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Donneur d’ordre (client)</p>
              <p className="font-semibold">{client.denomination}</p>
              <p className="text-foreground-muted">{[client.adresse, client.region].filter(Boolean).join(', ')}</p>
              {client.identifiant_fiscal && (
                <p className="text-foreground-muted">
                  {client.type_identifiant} {client.identifiant_fiscal}
                </p>
              )}
            </div>
            <div className="text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Bénéficiaire (producteur)</p>
              <p className="font-semibold">{p?.denomination}</p>
              {p?.region && <p className="text-foreground-muted">{p.region}</p>}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-foreground-muted">
                Commande <span className="font-mono">{commande?.numero}</span> · livraison convenue le {formatDate(commande?.date_livraison_convenue)}
              </p>
              <p className="font-heading text-2xl font-semibold text-primary">{formatMontant(bon.montant)}</p>
            </div>
            <ul className="divide-y divide-surface-border text-sm">
              {(lignes ?? []).map((l) => {
                const produit = l.produits as unknown as { nom: string; unite: string } | null
                return (
                  <li key={l.id} className="flex justify-between gap-3 py-2">
                    <span>
                      {produit?.nom} · {formatQuantite(l.quantite, produit?.unite)} × {formatMontant(l.prix_unitaire)}
                    </span>
                    <span className="tabular-nums">{formatMontant(l.montant)}</span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 border-t border-surface-border pt-3 text-sm">
              <p className="mb-1 font-medium">Échéancier convenu</p>
              {(echeancier ?? []).map((e) => (
                <p key={e.rang} className="flex justify-between text-foreground-muted">
                  <span>
                    {Number(e.pourcentage).toLocaleString('fr-FR')} % {e.delai_jours === 0 ? 'à réception' : `à ${e.delai_jours} jours`}
                  </span>
                  <span className="tabular-nums">{formatMontant(Math.round((bon.montant * Number(e.pourcentage)) / 100))}</span>
                </p>
              ))}
            </div>
          </Card>
          {bon.commentaire && (
            <Card className="text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                {bon.statut === 'refuse' ? 'Motif du refus' : 'Commentaire de la banque'}
              </p>
              <p className="whitespace-pre-line">{bon.commentaire}</p>
            </Card>
          )}
        </div>

        <aside className="no-print space-y-6">
          {aDecider ? (
            <>
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden /> Approuver le bon
                </h2>
                <FormulaireAction action={deciderBon} libelle="Approuver" boutonClassName="w-full">
                  <input type="hidden" name="bon_id" value={bon.id} />
                  <input type="hidden" name="decision" value="approuve" />
                  <Champ id="reference_bancaire" label="Référence bancaire de l’engagement" requis>
                    <Input id="reference_bancaire" name="reference_bancaire" required minLength={2} />
                  </Champ>
                  <Champ id="commentaire-a" label="Commentaire">
                    <Input id="commentaire-a" name="commentaire" maxLength={1000} />
                  </Champ>
                </FormulaireAction>
              </Card>
              <Card>
                <h2 className="mb-3 flex items-center gap-2 font-heading font-semibold">
                  <XCircle className="h-5 w-5 text-danger" aria-hidden /> Refuser le bon
                </h2>
                <FormulaireAction action={deciderBon} libelle="Refuser" variante="danger" boutonClassName="w-full" confirmation="Refuser ce bon de paiement ?">
                  <input type="hidden" name="bon_id" value={bon.id} />
                  <input type="hidden" name="decision" value="refuse" />
                  <Input name="commentaire" required minLength={3} maxLength={1000} placeholder="Motif du refus" aria-label="Motif du refus" />
                </FormulaireAction>
              </Card>
            </>
          ) : (
            commande && (
              <Card className="text-sm">
                <Link href={`/commandes/${commande.id}`} className="font-medium text-primary hover:underline">
                  Voir la commande {commande.numero}
                </Link>
              </Card>
            )
          )}
        </aside>
      </div>
    </>
  )
}
