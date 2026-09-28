import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Onglets } from '@/components/Onglets'
import { ComptesBancaires } from '@/components/entreprise/ComptesBancaires'
import { EnteteEntreprise } from '@/components/entreprise/EnteteEntreprise'
import { FicheForm } from '@/components/entreprise/FicheForm'
import { ListeUtilisateurs } from '@/components/entreprise/ListeUtilisateurs'
import { LogoForm } from '@/components/entreprise/LogoForm'
import { SitesProduction } from '@/components/entreprise/SitesProduction'
import { Card } from '@/components/ui/card'
import { enregistrerFiche } from '@/app/(app)/entreprise/actions'
import { chargerEntreprise, produitsFinis } from '@/lib/entreprise'
import { getContexte } from '@/lib/session'

export const metadata: Metadata = { title: 'Fiche entreprise' }

/** Fiche de l'entreprise de l'utilisateur connecté, qu'il met à jour lui-même (sauf le type, réservé à l'administrateur). */
export default async function MonEntreprisePage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await getContexte()
  if (!ctx.entrepriseId) notFound()
  const donnees = await chargerEntreprise(ctx.entrepriseId)
  if (!donnees) notFound()
  const { entreprise, comptes, sites, utilisateurs } = donnees

  const estProducteur = entreprise.type === 'producteur'
  const onglets = [
    { cle: 'fiche', libelle: 'Fiche' },
    { cle: 'comptes', libelle: 'Comptes bancaires', compte: comptes.length },
    ...(estProducteur ? [{ cle: 'sites', libelle: 'Sites de production', compte: sites.length }] : []),
    { cle: 'utilisateurs', libelle: 'Utilisateurs', compte: utilisateurs.length },
  ]
  const demande = (await searchParams).onglet
  const onglet = onglets.some((o) => o.cle === demande) ? demande! : 'fiche'

  return (
    <>
      <EnteteEntreprise entreprise={entreprise} />
      <Onglets base="/entreprise" actif={onglet} onglets={onglets} />

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
      {onglet === 'comptes' && <ComptesBancaires entrepriseId={entreprise.id} comptes={comptes} />}
      {onglet === 'sites' && estProducteur && (
        <SitesProduction entrepriseId={entreprise.id} sites={sites} produits={await produitsFinis()} />
      )}
      {onglet === 'utilisateurs' && (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Les comptes sont créés, modifiés et désactivés par l’administrateur de la plateforme. Pour ajouter un collègue,
            adressez-lui votre demande.{' '}
            {(entreprise.type === 'producteur' || entreprise.type === 'client') && (
              <Link href="/contrat" className="font-medium text-primary hover:underline">
                Voir le contrat d’engagement
              </Link>
            )}
          </p>
          <ListeUtilisateurs utilisateurs={utilisateurs} />
        </div>
      )}
    </>
  )
}
