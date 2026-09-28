import Link from 'next/link'
import { PackageCheck, Truck, XCircle } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { emettreBonLivraison, refuserCommandeProducteur, regrouperFactures, validerCommande } from '@/app/(app)/commandes/execution-actions'
import { STATUTS_FACTURE, STATUTS_RECEPTION } from '@/lib/execution'
import { peutMenu } from '@/lib/permissions'
import type { Contexte } from '@/lib/session'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

type Ligne = {
  id: string
  quantite: number
  quantite_livree: number
  quantite_recue: number
  date_disponibilite: string | null
  produits: { nom: string; unite: string } | null
}
type BonLivraison = {
  id: string
  numero: string
  date_livraison: string
  bons_reception: { numero: string; statut: string; date_limite: string } | null
}
type Facture = { id: string; numero: string; nature: string; statut: string; montant_total: number; date_facture: string }

const STATUTS_LIVRABLES = ['validee', 'livree_partiellement', 'livree', 'en_litige', 'receptionnee', 'partiellement_payee']

/** Exécution d'une commande : validation par le producteur, livraisons, réceptions et factures. */
export async function ExecutionCommande({
  commandeId,
  statut,
  facturationGroupee,
  ctx,
}: {
  commandeId: string
  statut: string
  facturationGroupee: boolean
  ctx: Contexte
}) {
  const supabase = await createClient()
  const [{ data: lignesData }, { data: bls }, { data: factures }] = await Promise.all([
    supabase
      .from('lignes_commande')
      .select('id, quantite, quantite_livree, quantite_recue, date_disponibilite, produits(nom, unite)')
      .eq('commande_id', commandeId)
      .returns<Ligne[]>(),
    supabase
      .from('bons_livraison')
      .select('id, numero, date_livraison, bons_reception(numero, statut, date_limite)')
      .eq('commande_id', commandeId)
      .order('created_at')
      .returns<BonLivraison[]>(),
    supabase
      .from('factures')
      .select('id, numero, nature, statut, montant_total, date_facture')
      .eq('commande_id', commandeId)
      .order('created_at')
      .returns<Facture[]>(),
  ])
  const lignes = lignesData ?? []
  const producteur = ctx.role === 'producteur'
  const peutValider = producteur && peutMenu(ctx, '/commandes', ['producteur'], 'modifier') && ['approuvee', 'approuvee_banque'].includes(statut)
  const resteALivrer = lignes.some((l) => Number(l.quantite_livree) < Number(l.quantite))
  const peutLivrer = producteur && peutMenu(ctx, '/livraisons', ['producteur'], 'ecrire') && STATUTS_LIVRABLES.includes(statut) && resteALivrer
  const aRegrouper = (factures ?? []).filter((f) => f.nature === 'provisoire' && f.statut === 'receptionnee')
  const peutRegrouper = producteur && facturationGroupee && aRegrouper.length > 0 && peutMenu(ctx, '/factures', ['producteur'], 'ecrire')
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const execution = lignes.some((l) => Number(l.quantite_livree) > 0) || STATUTS_LIVRABLES.includes(statut)

  if (!peutValider && !execution && statut !== 'attente_banque') return null

  return (
    <div className="no-print mb-6 space-y-6">
      {producteur && statut === 'attente_banque' && (
        <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
          Paiement par bon bancaire : vous pourrez valider cette commande dès que la banque aura approuvé le bon de paiement.
        </p>
      )}

      {peutValider && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
              <PackageCheck className="h-5 w-5 text-success" aria-hidden /> Valider la commande
            </h2>
            <p className="mb-4 text-sm text-foreground-muted">
              La validation vous engage à livrer à la date convenue. Le stock des lignes disponibles maintenant est réservé ; les
              lignes sur offre à date sont réservées sur l’offre (déclarez la production avant de livrer).
            </p>
            <FormulaireAction action={validerCommande} libelle="Valider et réserver" confirmation="Valider cette commande ? Le stock sera réservé pour ce client.">
              <input type="hidden" name="commande_id" value={commandeId} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="facturation_groupee" className="mt-0.5 h-4 w-4 accent-primary" />
                <span>
                  <strong>Facturation regroupée</strong> : une seule facture définitive pour plusieurs livraisons (sinon, une facture
                  définitive à chaque réception).
                </span>
              </label>
              <Input name="commentaire" maxLength={500} placeholder="Commentaire (facultatif)" aria-label="Commentaire" />
            </FormulaireAction>
          </Card>
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
              <XCircle className="h-5 w-5 text-danger" aria-hidden /> Refuser
            </h2>
            <p className="mb-4 text-sm text-foreground-muted">La commande revient au superviseur, qui pourra la réorienter vers un autre producteur.</p>
            <FormulaireAction action={refuserCommandeProducteur} libelle="Refuser la commande" variante="outline" confirmation="Refuser cette commande ?">
              <input type="hidden" name="commande_id" value={commandeId} />
              <Input name="motif" required minLength={3} maxLength={500} placeholder="Motif (obligatoire)" aria-label="Motif du refus" />
            </FormulaireAction>
          </Card>
        </div>
      )}

      {execution && (
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold">
            <Truck className="h-5 w-5 text-primary" aria-hidden /> Livraisons et réceptions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-foreground-muted">
                  <th className="py-2 pr-4 font-medium">Produit</th>
                  <th className="py-2 pr-4 text-right font-medium">Commandé</th>
                  <th className="py-2 pr-4 text-right font-medium">Livré</th>
                  <th className="py-2 text-right font-medium">Reçu</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-t border-surface-border">
                    <td className="py-2 pr-4">{l.produits?.nom}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatQuantite(l.quantite, l.produits?.unite)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatQuantite(l.quantite_livree)}</td>
                    <td className="py-2 text-right tabular-nums">{formatQuantite(l.quantite_recue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(bls ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-surface-border rounded-lg border border-surface-border">
              {bls!.map((bl) => {
                const br = bl.bons_reception
                const st = br ? STATUTS_RECEPTION[br.statut] : null
                return (
                  <li key={bl.id}>
                    <Link href={`/livraisons/${bl.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-muted">
                      <span className="font-mono">{bl.numero}</span>
                      <span className="text-foreground-muted">livré le {formatDate(bl.date_livraison)}</span>
                      {st && <Badge ton={st.ton}>{st.libelle}</Badge>}
                      {br?.statut === 'en_attente' && (
                        <span className="text-xs text-foreground-muted">réception tacite le {formatDate(br.date_limite)}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {peutLivrer && (
            <details className="mt-4 rounded-lg border border-surface-border" open={(bls ?? []).length === 0}>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-primary">Émettre un bon de livraison</summary>
              <div className="border-t border-surface-border p-3">
                <FormulaireAction action={emettreBonLivraison} libelle="Émettre le bon de livraison" confirmation="Émettre le bon de livraison ? Le stock sera sorti et une facture provisoire établie.">
                  <input type="hidden" name="commande_id" value={commandeId} />
                  <div className="space-y-2">
                    {lignes
                      .filter((l) => Number(l.quantite_livree) < Number(l.quantite))
                      .map((l) => {
                        const reste = Number(l.quantite) - Number(l.quantite_livree)
                        return (
                          <label key={l.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 text-sm">
                            <span>
                              {l.produits?.nom} <span className="text-foreground-muted">· reste {formatQuantite(reste, l.produits?.unite)}</span>
                              {l.date_disponibilite && <span className="block text-xs text-foreground-muted">Offre à date : production à déclarer avant la livraison</span>}
                            </span>
                            <Input name={`livre:${l.id}`} inputMode="decimal" defaultValue={reste} aria-label={`Quantité livrée de ${l.produits?.nom}`} className="h-9" />
                          </label>
                        )
                      })}
                  </div>
                  <GrilleChamps>
                    <Champ id="date_livraison" label="Date de livraison">
                      <Input id="date_livraison" name="date_livraison" type="date" max={aujourdhui} defaultValue={aujourdhui} />
                    </Champ>
                    <Champ id="transporteur" label="Transporteur">
                      <Input id="transporteur" name="transporteur" />
                    </Champ>
                    <Champ id="immatriculation" label="Immatriculation">
                      <Input id="immatriculation" name="immatriculation" />
                    </Champ>
                    <Champ id="chauffeur" label="Chauffeur">
                      <Input id="chauffeur" name="chauffeur" />
                    </Champ>
                  </GrilleChamps>
                  <Input name="commentaire" maxLength={1000} placeholder="Commentaire (facultatif)" aria-label="Commentaire" />
                </FormulaireAction>
              </div>
            </details>
          )}
        </Card>
      )}

      {(factures ?? []).length > 0 && (
        <Card>
          <h2 className="mb-3 font-heading text-lg font-semibold">Factures</h2>
          <ul className="divide-y divide-surface-border rounded-lg border border-surface-border">
            {factures!.map((f) => (
              <li key={f.id}>
                <Link href={`/factures/${f.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-surface-muted">
                  <span className="font-mono">{f.numero}</span>
                  <span className="text-foreground-muted">
                    {f.nature === 'provisoire' ? 'Provisoire' : 'Définitive'} du {formatDate(f.date_facture)}
                  </span>
                  <Badge ton={STATUTS_FACTURE[f.statut].ton}>{STATUTS_FACTURE[f.statut].libelle}</Badge>
                  <span className="ml-auto font-semibold tabular-nums">{formatMontant(f.montant_total)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {peutRegrouper && (
            <div className="mt-4 rounded-lg border border-surface-border p-3">
              <p className="mb-2 text-sm font-medium">Regrouper des factures provisoires réceptionnées en une facture définitive</p>
              <FormulaireAction action={regrouperFactures} libelle="Établir la facture définitive">
                <input type="hidden" name="commande_id" value={commandeId} />
                {aRegrouper.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="provisoire" value={f.id} defaultChecked className="h-4 w-4 accent-primary" />
                    {f.numero} · {formatMontant(f.montant_total)}
                  </label>
                ))}
              </FormulaireAction>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
