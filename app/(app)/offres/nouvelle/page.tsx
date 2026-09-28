import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsOffre } from '@/components/offres/ChampsOffre'
import { Card, PageHeader } from '@/components/ui/card'
import { creerOffre } from '@/app/(app)/offres/actions'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { optionsOffre } from '@/lib/offres'

export const metadata: Metadata = { title: 'Nouvelle offre' }

export default async function NouvelleOffrePage() {
  await exigerLecture('/offres', ['producteur'])
  const { ecrire } = await droitsEcran('/offres', ['producteur'])
  if (!ecrire) notFound()
  const { sites, produits } = await optionsOffre()
  const aujourdhui = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageHeader titre="Nouvelle offre" description="Vous pourrez ajouter des photos après l’enregistrement." />
      {sites.length === 0 ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Déclarez d’abord un site de production actif dans{' '}
          <Link href="/entreprise?onglet=sites" className="font-medium text-primary hover:underline">
            Fiche entreprise › Sites de production
          </Link>
          .
        </p>
      ) : (
        <Card>
          <FormulaireAction action={creerOffre} libelle="Enregistrer l’offre">
            <ChampsOffre sites={sites} produits={produits} aujourdhui={aujourdhui} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="publier" className="h-4 w-4 accent-primary" /> Publier immédiatement (sinon, l’offre reste en
              brouillon)
            </label>
          </FormulaireAction>
        </Card>
      )}
    </>
  )
}
