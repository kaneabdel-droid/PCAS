import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { TexteContrat } from '@/components/contrat/TexteContrat'
import { Card } from '@/components/ui/card'
import { Badge, Champ } from '@/components/ui/champ'
import { Input, Textarea } from '@/components/ui/input'
import { enregistrerBrouillon, publierContrat, supprimerBrouillon } from '@/app/(app)/admin/contrats/actions'
import type { ModeleContrat } from '@/lib/contrat'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Contrat d’engagement' }

// Aperçu : les marqueurs sont remplacés par des exemples pour montrer le rendu final.
const EXEMPLE = {
  denomination: 'Exemple SARL',
  type_identifiant: 'NINEA',
  identifiant_fiscal: '000000000',
  rccm: 'SN-DKR-2026-B-00000',
  adresse: 'Dakar',
  signataire: 'Prénom Nom',
  fonction: 'Gérant',
}

type Acceptation = { id: string; nom_signataire: string; accepte_le: string; entreprises: { id: string; denomination: string } | null }

export default async function ContratAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: modele }, { data: acceptations }] = await Promise.all([
    supabase.from('modeles_contrat').select('*').eq('id', id).maybeSingle<ModeleContrat>(),
    supabase
      .from('acceptations_contrat')
      .select('id, nom_signataire, accepte_le, entreprises(id, denomination)')
      .eq('modele_id', id)
      .order('accepte_le', { ascending: false })
      .returns<Acceptation[]>(),
  ])
  if (!modele) notFound()
  const brouillon = modele.statut === 'brouillon'

  return (
    <>
      <Link href="/admin/contrats" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Contrats d’engagement
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold">
          {modele.titre} — v{modele.version}
        </h1>
        <Badge ton={brouillon ? 'alerte' : modele.statut === 'en_vigueur' ? 'succes' : 'neutre'}>
          {brouillon ? 'Brouillon' : modele.statut === 'en_vigueur' ? 'En vigueur' : 'Archivé'}
        </Badge>
      </div>

      {brouillon ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <FormulaireAction action={enregistrerBrouillon} libelle="Enregistrer le brouillon">
              <input type="hidden" name="modele_id" value={modele.id} />
              <Champ id="titre" label="Titre" requis>
                <Input id="titre" name="titre" required defaultValue={modele.titre} />
              </Champ>
              <Champ
                id="contenu"
                label="Texte du contrat"
                requis
                aide="Titres : « ### TITRE ». Gras : **texte**. Paragraphes séparés par une ligne vide. Champs remplis automatiquement : {{denomination}}, {{type_identifiant}}, {{identifiant_fiscal}}, {{rccm}}, {{adresse}}, {{signataire}}, {{fonction}}."
              >
                <Textarea id="contenu" name="contenu" required rows={28} defaultValue={modele.contenu} className="font-mono text-xs leading-relaxed" />
              </Champ>
            </FormulaireAction>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-surface-border pt-4">
              <FormulaireAction
                action={publierContrat}
                libelle="Publier cette version"
                confirmation="Publier ce contrat ? La version en vigueur sera archivée et toutes les entreprises concernées devront accepter la nouvelle version. Le texte ne pourra plus être modifié."
              >
                <input type="hidden" name="modele_id" value={modele.id} />
              </FormulaireAction>
              <FormulaireAction action={supprimerBrouillon} libelle="Supprimer le brouillon" variante="ghost" boutonClassName="text-danger" confirmation="Supprimer ce brouillon ?">
                <input type="hidden" name="modele_id" value={modele.id} />
              </FormulaireAction>
            </div>
          </Card>
          <Card className="sm:p-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-foreground-muted">Aperçu (enregistrez pour mettre à jour)</p>
            <TexteContrat contenu={modele.contenu} valeurs={EXEMPLE} />
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <Card className="sm:p-10">
            <TexteContrat contenu={modele.contenu} valeurs={EXEMPLE} />
            <p className="mt-8 break-all border-t border-surface-border pt-4 font-mono text-xs text-foreground-muted">
              Publié le {formatDate(modele.publie_le)} · empreinte SHA-256 : {modele.empreinte_sha256}
            </p>
          </Card>
          <Card className="self-start">
            <h2 className="mb-3 font-heading font-semibold">Acceptations ({acceptations?.length ?? 0})</h2>
            {acceptations?.length ? (
              <ul className="space-y-2 text-sm">
                {acceptations.map((a) => (
                  <li key={a.id}>
                    <Link href={`/admin/entreprises/${a.entreprises?.id}?onglet=contrat`} className="font-medium hover:text-primary hover:underline">
                      {a.entreprises?.denomination}
                    </Link>
                    <span className="block text-foreground-muted">
                      {formatDate(a.accepte_le)} · {a.nom_signataire}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground-muted">Aucune acceptation.</p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
