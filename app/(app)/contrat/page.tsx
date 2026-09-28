import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2, FileSignature } from 'lucide-react'
import { QrDocument } from '@/components/QrDocument'
import { BoutonImprimer } from '@/components/BoutonImprimer'
import { FormulaireAction } from '@/components/FormulaireAction'
import { TexteContrat } from '@/components/contrat/TexteContrat'
import { Card, PageHeader } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { accepterContrat } from '@/app/(app)/contrat/actions'
import { contratEnVigueur, valeursContrat } from '@/lib/contrat'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'
import type { Entreprise } from '@/lib/entreprise'

export const metadata: Metadata = { title: 'Contrat d’engagement' }

export default async function ContratPage() {
  const ctx = await getContexte()
  if (!ctx.entrepriseId || (ctx.entrepriseType !== 'producteur' && ctx.entrepriseType !== 'client')) notFound()

  const supabase = await createClient()
  const [modele, { data: entreprise }, { data: moi }] = await Promise.all([
    contratEnVigueur(ctx.entrepriseType),
    supabase.from('entreprises').select('*').eq('id', ctx.entrepriseId).single<Entreprise>(),
    supabase.from('utilisateurs').select('signataire, fonction').eq('id', ctx.userId).single(),
  ])
  if (!entreprise) notFound()

  if (!modele) {
    return (
      <>
        <PageHeader titre="Contrat d’engagement" />
        <Vide titre="Aucun contrat publié pour le moment">Vous serez averti dès qu’un contrat sera à accepter.</Vide>
      </>
    )
  }

  const { data: acceptation } = await supabase
    .from('acceptations_contrat')
    .select('nom_signataire, fonction_signataire, accepte_le, jeton_public')
    .eq('entreprise_id', ctx.entrepriseId)
    .eq('modele_id', modele.id)
    .maybeSingle()

  const valeurs = valeursContrat(
    entreprise,
    acceptation
      ? { nom: acceptation.nom_signataire, fonction: acceptation.fonction_signataire }
      : { nom: entreprise.representant_legal, fonction: null }
  )

  return (
    <>
      <PageHeader titre={modele.titre} description={`Version ${modele.version} · en vigueur depuis le ${formatDate(modele.publie_le)}`}>
        {acceptation ? <Badge ton="succes">Accepté</Badge> : <Badge ton="alerte">À accepter</Badge>}
        <BoutonImprimer />
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="sm:p-10">
          <p className="mb-6 text-center font-heading text-lg font-semibold uppercase tracking-wide">
            {modele.titre} — version {modele.version}
          </p>
          <TexteContrat contenu={modele.contenu} valeurs={valeurs} />

          {acceptation && (
            <div className="mt-10 break-inside-avoid rounded-lg border border-surface-border bg-surface-muted p-4 text-sm">
              <p>
                Fait et accepté électroniquement sur la plateforme PCAS le <strong>{formatDate(acceptation.accepte_le)}</strong>, par{' '}
                <strong>{acceptation.nom_signataire}</strong>, {acceptation.fonction_signataire}, pour le compte de{' '}
                <strong>{entreprise.denomination}</strong>.
              </p>
              <p className="mt-2 break-all font-mono text-xs text-foreground-muted">
                Empreinte de la version : {modele.empreinte_sha256} · Référence : {acceptation.jeton_public}
              </p>
              <QrDocument jeton={acceptation.jeton_public} className="mt-3" />
            </div>
          )}
        </Card>

        <aside className="no-print space-y-4 xl:sticky xl:top-6 xl:self-start">
          {acceptation ? (
            <Card className="flex gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold">Contrat accepté</p>
                <p className="mt-1 text-foreground-muted">
                  Le {formatDate(acceptation.accepte_le)} par {acceptation.nom_signataire} ({acceptation.fonction_signataire}).
                </p>
              </div>
            </Card>
          ) : moi?.signataire ? (
            <Card>
              <h2 className="mb-1 flex items-center gap-2 font-heading font-semibold">
                <FileSignature className="h-5 w-5 text-primary" aria-hidden /> Signer le contrat
              </h2>
              <p className="mb-4 text-sm text-foreground-muted">
                Vous signez au nom de <strong>{entreprise.denomination}</strong>. Votre acceptation est horodatée et enregistrée
                avec la version exacte du texte.
              </p>
              <FormulaireAction action={accepterContrat} libelle="J’accepte le contrat" boutonClassName="w-full">
                <input type="hidden" name="modele_id" value={modele.id} />
                <GrilleChamps>
                  <Champ id="nom_signataire" label="Nom du signataire" requis className="sm:col-span-2">
                    <Input id="nom_signataire" name="nom_signataire" required minLength={2} defaultValue={ctx.nomComplet} />
                  </Champ>
                  <Champ id="fonction_signataire" label="Fonction" requis className="sm:col-span-2">
                    <Input id="fonction_signataire" name="fonction_signataire" required minLength={2} defaultValue={moi.fonction ?? ''} />
                  </Champ>
                </GrilleChamps>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="lu_accepte" required className="mt-0.5 h-4 w-4 accent-primary" />
                  J’ai lu l’intégralité du contrat et je l’accepte au nom de {entreprise.denomination}.
                </label>
              </FormulaireAction>
            </Card>
          ) : (
            <Card className="text-sm">
              <p className="font-semibold">Signature réservée</p>
              <p className="mt-1 text-foreground-muted">
                Seul un utilisateur habilité de {entreprise.denomination} peut accepter ce contrat. Contactez l’administrateur de la
                plateforme pour désigner votre signataire.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
