import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Scale } from 'lucide-react'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { FiliereBadge } from '@/components/filieres/FiliereBadge'
import { exigerLecture } from '@/lib/droits'
import { FILIERES, determinerFiliere, type FiliereCode } from '@/lib/filieres'
import { getContexte } from '@/lib/session'
import { cn, formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Litiges de réception' }

type Litige = {
  id: string
  numero: string
  bl_id: string
  motif_litige: string | null
  receptionne_le: string | null
  commandes: {
    numero: string
    producteur_id: string
    entete_client: { denomination?: string }
    lignes_commande?: { produit_id: string; produits?: { id: string; nom: string; categorie: string; filiere?: FiliereCode } | null }[]
  } | null
}

/** Réceptions contestées par les clients, à arbitrer par le superviseur. */
export default async function LitigesPage() {
  await exigerLecture('/supervision/litiges', ['superviseur', 'administrateur'])
  const [ctx, supabase] = await Promise.all([getContexte(), createClient()])
  const [{ data }, { data: producteurs }] = await Promise.all([
    supabase
      .from('bons_reception')
      .select('id, numero, bl_id, motif_litige, receptionne_le, commandes(numero, producteur_id, entete_client, lignes_commande(produit_id, produits(id, nom, categorie, filiere)))')
      .eq('statut', 'en_litige')
      .order('receptionne_le')
      .returns<Litige[]>(),
    supabase.from('entreprises').select('id, denomination').eq('type', 'producteur'),
  ])

  const filiereCible = ctx.filiereActive
  const tousLitiges = data ?? []
  const litiges = filiereCible === 'toutes'
    ? tousLitiges
    : tousLitiges.filter((l) =>
        l.commandes?.lignes_commande?.some((lc) => determinerFiliere(lc.produits) === filiereCible)
      )

  const noms = new Map((producteurs ?? []).map((p) => [p.id, p.denomination]))

  return (
    <>
      <PageHeader
        titre={filiereCible === 'toutes' ? 'Litiges de réception' : `Litiges · ${FILIERES[filiereCible].nomCourt}`}
        description={
          filiereCible === 'toutes'
            ? 'Réceptions contestées par les clients (toutes filières). L’arbitrage fixe les quantités retenues pour la facture définitive.'
            : `Supervision des litiges de réception pour la filière ${FILIERES[filiereCible].nom}.`
        }
      />
      {litiges.length === 0 ? (
        <Vide titre="Aucun litige en cours">
          {filiereCible === 'toutes'
            ? 'Aucune réception n’est contestée actuellement.'
            : `Aucun litige en cours pour la filière ${FILIERES[filiereCible].nom}.`}
        </Vide>
      ) : (
        <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
          {litiges.map((l) => {
            const premierProduit = l.commandes?.lignes_commande?.[0]?.produits
            const filiereLitige = determinerFiliere(premierProduit)
            const fTheme = FILIERES[filiereLitige]?.theme
            return (
              <li key={l.id} className={cn('transition-colors', fTheme?.borderLeftClass)}>
                <Link href={`/livraisons/${l.bl_id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-muted">
                  <Scale className="h-5 w-5 shrink-0 text-danger" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      <span className="font-mono text-sm">{l.numero}</span> · {l.commandes?.entete_client.denomination} ←{' '}
                      {noms.get(l.commandes?.producteur_id ?? '')}
                    </p>
                    <p className="truncate text-sm text-foreground-muted">
                      Contesté le {formatDate(l.receptionne_le)} · {l.motif_litige}
                    </p>
                  </div>
                  {premierProduit && (
                    <FiliereBadge filiere={filiereLitige} taille="petite" court />
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

