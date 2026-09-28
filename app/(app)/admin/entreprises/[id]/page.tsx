import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Onglets } from '@/components/Onglets'
import { ComptesBancaires } from '@/components/entreprise/ComptesBancaires'
import { EnteteEntreprise } from '@/components/entreprise/EnteteEntreprise'
import { FicheForm } from '@/components/entreprise/FicheForm'
import { ListeUtilisateurs } from '@/components/entreprise/ListeUtilisateurs'
import { LogoForm } from '@/components/entreprise/LogoForm'
import { SitesProduction } from '@/components/entreprise/SitesProduction'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge, Champ, Vide } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { enregistrerFiche } from '@/app/(app)/entreprise/actions'
import { changerStatutEntreprise, supprimerEntreprise } from '@/app/(app)/admin/entreprises/actions'
import { chargerEntreprise, produitsFinis } from '@/lib/entreprise'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Entreprise' }

export default async function EntrepriseAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { id } = await params
  const donnees = await chargerEntreprise(id)
  if (!donnees) notFound()
  const { entreprise, comptes, sites, utilisateurs, acceptations } = donnees
  const estProducteur = entreprise.type === 'producteur'
  const aContrat = entreprise.type !== 'banque'

  const onglets = [
    { cle: 'fiche', libelle: 'Fiche' },
    { cle: 'comptes', libelle: 'Comptes bancaires', compte: comptes.length },
    ...(estProducteur ? [{ cle: 'sites', libelle: 'Sites de production', compte: sites.length }] : []),
    { cle: 'utilisateurs', libelle: 'Utilisateurs', compte: utilisateurs.length },
    ...(aContrat ? [{ cle: 'contrat', libelle: 'Contrat d’engagement' }] : []),
    { cle: 'gestion', libelle: 'Suspension et suppression' },
  ]
  const demande = (await searchParams).onglet
  const onglet = onglets.some((o) => o.cle === demande) ? demande! : 'fiche'
  const base = `/admin/entreprises/${id}`

  let enRegle: boolean | null = null
  if (onglet === 'contrat' && aContrat) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('contrat_en_regle', { p_entreprise: id })
    enRegle = data
  }

  return (
    <>
      <Link href="/admin/entreprises" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Entreprises
      </Link>
      <EnteteEntreprise entreprise={entreprise} />
      <Onglets base={base} actif={onglet} onglets={onglets} />

      {onglet === 'fiche' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
          <Card>
            <FicheForm entreprise={entreprise} action={enregistrerFiche} libelle="Enregistrer la fiche" />
          </Card>
          <Card className="xl:self-start">
            <h2 className="mb-4 font-heading font-semibold">Logo</h2>
            <LogoForm entreprise={entreprise} />
          </Card>
        </div>
      )}

      {onglet === 'comptes' && <ComptesBancaires entrepriseId={id} comptes={comptes} />}

      {onglet === 'sites' && estProducteur && <SitesProduction entrepriseId={id} sites={sites} produits={await produitsFinis()} />}

      {onglet === 'utilisateurs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button asChild>
              <Link href={`/admin/utilisateurs/nouveau?entreprise=${id}`}>
                <UserPlus className="h-4 w-4" aria-hidden /> Inviter un utilisateur
              </Link>
            </Button>
          </div>
          <ListeUtilisateurs utilisateurs={utilisateurs} lienGestion />
        </div>
      )}

      {onglet === 'contrat' && aContrat && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Situation vis-à-vis du contrat en vigueur</p>
              <p className="text-sm text-foreground-muted">
                Tant que le contrat n’est pas accepté, l’entreprise peut consulter la plateforme mais pas commander, publier
                d’offre ni de besoin.
              </p>
            </div>
            {enRegle ? <Badge ton="succes">En règle</Badge> : <Badge ton="alerte">Contrat à accepter</Badge>}
          </Card>
          {acceptations.length === 0 ? (
            <Vide titre="Aucune acceptation enregistrée">
              {utilisateurs.some((u) => u.signataire)
                ? 'Un utilisateur habilité doit accepter le contrat à sa prochaine connexion.'
                : 'Aucun utilisateur n’est habilité à signer : cochez « Signataire » sur la fiche d’un utilisateur.'}
            </Vide>
          ) : (
            <ul className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-surface">
              {acceptations.map((a) => (
                <li key={a.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    <strong>{a.modeles_contrat?.titre}</strong> v{a.modeles_contrat?.version} — accepté le {formatDate(a.accepte_le)} par{' '}
                    {a.nom_signataire} ({a.fonction_signataire})
                  </span>
                  <span className="font-mono text-xs text-foreground-muted">{a.jeton_public}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {onglet === 'gestion' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-heading font-semibold">{entreprise.statut === 'actif' ? 'Suspendre l’entreprise' : 'Réactiver l’entreprise'}</h2>
            <p className="mb-4 mt-1 text-sm text-foreground-muted">
              {entreprise.statut === 'actif'
                ? 'Ses utilisateurs perdent immédiatement l’accès à la plateforme. Son historique est conservé et la suspension est réversible.'
                : 'Ses utilisateurs actifs retrouvent l’accès à la plateforme.'}
            </p>
            <FormulaireAction
              action={changerStatutEntreprise}
              libelle={entreprise.statut === 'actif' ? 'Suspendre' : 'Réactiver'}
              variante={entreprise.statut === 'actif' ? 'outline' : 'default'}
              confirmation={entreprise.statut === 'actif' ? `Suspendre ${entreprise.denomination} ?` : undefined}
            >
              <input type="hidden" name="entreprise_id" value={id} />
              <input type="hidden" name="statut" value={entreprise.statut === 'actif' ? 'suspendu' : 'actif'} />
            </FormulaireAction>
          </Card>
          <Card className="border-danger/40">
            <h2 className="font-heading font-semibold text-danger">Supprimer définitivement</h2>
            <p className="mb-4 mt-1 text-sm text-foreground-muted">
              Supprime l’entreprise, sa fiche, ses comptes bancaires, ses sites et les comptes de ses {utilisateurs.length}{' '}
              utilisateur(s). Impossible si l’entreprise a un historique (contrat accepté, commandes, factures) : suspendez-la alors.
            </p>
            <FormulaireAction
              action={supprimerEntreprise}
              libelle="Supprimer définitivement"
              variante="danger"
              confirmation="Cette suppression est définitive. Continuer ?"
            >
              <input type="hidden" name="entreprise_id" value={id} />
              <Champ id="confirmation" label={`Pour confirmer, saisissez : ${entreprise.denomination}`}>
                <Input id="confirmation" name="confirmation" required autoComplete="off" />
              </Champ>
            </FormulaireAction>
          </Card>
        </div>
      )}
    </>
  )
}
