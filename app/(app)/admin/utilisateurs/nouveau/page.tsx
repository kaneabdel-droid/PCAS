import type { Metadata } from 'next'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsUtilisateur } from '@/components/admin/ChampsUtilisateur'
import { Card, PageHeader } from '@/components/ui/card'
import { inviterUtilisateur } from '@/app/(app)/admin/utilisateurs/actions'
import { optionsUtilisateur } from '@/lib/admin-listes'

export const metadata: Metadata = { title: 'Inviter un utilisateur' }

export default async function NouvelUtilisateurPage({ searchParams }: { searchParams: Promise<{ entreprise?: string }> }) {
  const { entreprise } = await searchParams
  const { entreprises, profils } = await optionsUtilisateur()
  return (
    <>
      <PageHeader
        titre="Inviter un utilisateur"
        description="L’utilisateur reçoit un email avec un lien pour choisir son mot de passe. Administrateur et superviseur appartiennent à la plateforme ; les autres rôles sont rattachés à une entreprise du type correspondant."
      />
      <Card>
        <FormulaireAction action={inviterUtilisateur} libelle="Envoyer l’invitation" enCoursLibelle="Envoi…">
          <ChampsUtilisateur
            entreprises={entreprises}
            profils={profils}
            emailModifiable
            entrepriseParDefaut={entreprise}
          />
        </FormulaireAction>
      </Card>
    </>
  )
}
