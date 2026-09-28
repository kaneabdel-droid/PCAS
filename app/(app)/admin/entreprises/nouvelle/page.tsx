import type { Metadata } from 'next'
import { FicheForm } from '@/components/entreprise/FicheForm'
import { Card, PageHeader } from '@/components/ui/card'
import { creerEntreprise } from '@/app/(app)/admin/entreprises/actions'
import { createClient } from '@/utils/supabase/server'
import type { Entreprise } from '@/lib/entreprise'

export const metadata: Metadata = { title: 'Nouvelle entreprise' }

/** Création d'une entreprise, éventuellement pré-remplie depuis une demande d'accès (?demande=…). */
export default async function NouvelleEntreprisePage({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const { demande } = await searchParams
  let prerempli: Entreprise | undefined
  let typeDemande: string | undefined
  if (demande) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('demandes_acces')
      .select('type_entreprise, denomination, telephone, email, region')
      .eq('id', demande)
      .maybeSingle()
    if (data) {
      typeDemande = data.type_entreprise
      prerempli = {
        denomination: data.denomination,
        telephone: data.telephone,
        email: data.email,
        region: data.region,
        type_identifiant: 'NINEA',
      } as Entreprise
    }
  }

  async function creer(fd: FormData) {
    'use server'
    if (demande) fd.set('demande_id', demande)
    return creerEntreprise(fd)
  }

  return (
    <>
      <PageHeader
        titre="Nouvelle entreprise"
        description={
          typeDemande
            ? `Pré-remplie depuis une demande d’accès (${typeDemande}). Vérifiez le type avant d’enregistrer.`
            : 'Après la création, vous pourrez ajouter le logo, les comptes bancaires, les sites et inviter les utilisateurs.'
        }
      />
      <Card>
        <FicheForm entreprise={prerempli} action={creer} libelle="Créer l’entreprise" choixType typeParDefaut={typeDemande} />
      </Card>
    </>
  )
}
