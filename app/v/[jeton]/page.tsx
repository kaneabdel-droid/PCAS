import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, SearchX, ShieldAlert } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ACTIONS_COMMANDE, STATUTS_COMMANDE } from '@/lib/commandes'
import { STATUTS_BON } from '@/lib/bons'
import { STATUTS_FACTURE, STATUTS_RECEPTION } from '@/lib/execution'
import { LIBELLES_ROLES, estRoleBase } from '@/lib/roles'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Vérification d’un document', robots: { index: false } }

type Verification = {
  trouve: boolean
  type?: 'commande' | 'bon_paiement' | 'bon_livraison' | 'bon_reception' | 'facture' | 'contrat'
  numero?: string
  emis_le?: string
  conforme?: boolean
  empreinte?: string
  statut?: string
  remplacee_par?: string | null
  commande?: string
  commande_statut?: string
  client?: string
  producteur?: string
  emetteur?: string
  signataire?: string
  partie?: boolean
  detail?: { montant: number | null; lignes: { produit: string; unite: string; quantite: number; prix_unitaire?: number; livree?: number }[] | null; lien: string } | null
  etapes?: { action: string; horodatage: string; role: string | null; acteur: string | null }[] | null
}

const TYPES: Record<string, string> = {
  commande: 'Commande',
  bon_paiement: 'Bon de paiement',
  bon_livraison: 'Bon de livraison',
  bon_reception: 'Bon de réception',
  facture: 'Facture',
  contrat: 'Contrat d’engagement accepté',
}

function libelleStatut(type: string | undefined, statut: string | undefined) {
  if (!statut) return null
  if (type === 'commande') return STATUTS_COMMANDE[statut]?.libelle
  if (type === 'bon_paiement') return STATUTS_BON[statut]?.libelle
  if (type === 'facture') return STATUTS_FACTURE[statut]?.libelle
  if (type === 'bon_reception') return STATUTS_RECEPTION[statut]?.libelle
  if (type === 'bon_livraison') return statut === 'emis' ? 'Émis' : STATUTS_RECEPTION[statut.replace('reception_', '')]?.libelle
  if (type === 'contrat') return statut === 'en_vigueur' ? 'Version en vigueur' : 'Version archivée'
  return statut
}

/** Page publique (sans connexion) ouverte en scannant le QR code d'un document. */
export default async function VerificationPage({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('verifier_document', { p_jeton: jeton.slice(0, 64) })
  const v = (data ?? { trouve: false }) as Verification
  const { data: session } = await supabase.auth.getClaims()
  const connecte = Boolean(session?.claims?.sub)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:py-12">
      <Logo className="mb-8 text-foreground" />

      {!v.trouve ? (
        <section className="rounded-2xl border border-danger/40 bg-surface p-6 text-center">
          <SearchX className="mx-auto mb-3 h-12 w-12 text-danger" aria-hidden />
          <h1 className="font-heading text-xl font-semibold">Document introuvable</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Ce code ne correspond à aucun document émis sur la plateforme PCAS. Le document présenté n’est pas authentique, ou le code a été
            mal recopié.
          </p>
        </section>
      ) : (
        <>
          <section className={`rounded-2xl border p-6 ${v.conforme ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10'}`}>
            <div className="flex items-start gap-4">
              {v.conforme ? (
                <CheckCircle2 className="h-10 w-10 shrink-0 text-success" aria-hidden />
              ) : (
                <ShieldAlert className="h-10 w-10 shrink-0 text-danger" aria-hidden />
              )}
              <div>
                <h1 className="font-heading text-xl font-semibold">{v.conforme ? 'Document authentique' : 'Document non conforme'}</h1>
                <p className="mt-1 text-sm">
                  {v.conforme
                    ? 'Ce document a bien été émis sur la plateforme PCAS et son contenu n’a pas été modifié depuis.'
                    : 'Le contenu enregistré ne correspond plus à celui de l’émission : ne vous fiez pas à ce document et contactez la plateforme.'}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-foreground-muted">Document</dt>
                <dd className="font-medium">
                  {TYPES[v.type ?? '']} <span className="font-mono">{v.numero}</span>
                </dd>
              </div>
              <div>
                <dt className="text-foreground-muted">{v.type === 'contrat' ? 'Accepté le' : 'Émis le'}</dt>
                <dd className="font-medium">{formatDate(v.emis_le)}</dd>
              </div>
              {v.statut && (
                <div>
                  <dt className="text-foreground-muted">Statut actuel</dt>
                  <dd className="font-medium">
                    {libelleStatut(v.type, v.statut)}
                    {v.remplacee_par ? ` · remplacée par la facture définitive ${v.remplacee_par}` : ''}
                  </dd>
                </div>
              )}
              {v.type === 'contrat' ? (
                <>
                  <div>
                    <dt className="text-foreground-muted">Entreprise</dt>
                    <dd className="font-medium">{v.emetteur}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground-muted">Signataire</dt>
                    <dd className="font-medium">{v.signataire}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt className="text-foreground-muted">Producteur</dt>
                    <dd className="font-medium">{v.producteur}</dd>
                  </div>
                  <div>
                    <dt className="text-foreground-muted">Client</dt>
                    <dd className="font-medium">{v.client}</dd>
                  </div>
                  {v.type !== 'commande' && (
                    <div>
                      <dt className="text-foreground-muted">Commande</dt>
                      <dd className="font-medium">
                        <span className="font-mono">{v.commande}</span> · {STATUTS_COMMANDE[v.commande_statut ?? '']?.libelle}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            <p className="mt-4 break-all font-mono text-[11px] text-foreground-muted">Empreinte SHA-256 : {v.empreinte}</p>
          </section>

          {v.detail ? (
            <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-heading font-semibold">Détail</h2>
                {v.detail.montant !== null && <span className="font-heading text-lg font-semibold tabular-nums">{formatMontant(v.detail.montant)}</span>}
              </div>
              <ul className="divide-y divide-surface-border text-sm">
                {(v.detail.lignes ?? []).map((l, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2">
                    <span>{l.produit}</span>
                    <span className="tabular-nums text-foreground-muted">
                      {formatQuantite(l.quantite, l.unite)}
                      {l.livree !== undefined && l.livree !== l.quantite ? ` (livré ${formatQuantite(l.livree)})` : ''}
                      {l.prix_unitaire ? ` × ${formatMontant(l.prix_unitaire)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={v.detail.lien} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
                Ouvrir le document dans PCAS
              </Link>
            </section>
          ) : (
            v.type !== 'contrat' && (
              <p className="mt-6 rounded-xl bg-surface-muted p-4 text-sm text-foreground-muted">
                Les montants et le détail ne sont visibles que des entreprises concernées par cette commande.{' '}
                {!connecte && (
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Se connecter
                  </Link>
                )}
              </p>
            )
          )}

          {(v.etapes ?? []).length > 0 && (
            <section className="mt-6 rounded-2xl border border-surface-border bg-surface p-6">
              <h2 className="mb-4 font-heading font-semibold">Étapes de la commande</h2>
              <ol className="relative space-y-4 border-l-2 border-surface-border pl-5">
                {v.etapes!.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <p className="text-sm font-medium">{ACTIONS_COMMANDE[e.action] ?? e.action}</p>
                    <p className="text-xs text-foreground-muted">
                      {new Date(e.horodatage).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Dakar' })}
                      {e.acteur ? ` · ${e.acteur}` : ' · Système'}
                      {e.role && estRoleBase(e.role) ? ` (${LIBELLES_ROLES[e.role]})` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <p className="mt-10 text-center text-xs text-foreground-muted">
        PCAS — Plateforme de Commercialisation Agricole du Sénégal · un produit DembaSolution
      </p>
    </main>
  )
}
