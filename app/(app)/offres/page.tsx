import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Onglets } from '@/components/Onglets'
import { CarteOffre } from '@/components/offres/CarteOffre'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/card'
import { Vide } from '@/components/ui/champ'
import { droitsEcran, exigerLecture } from '@/lib/droits'
import { SELECT_OFFRE, type Offre } from '@/lib/offres'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Mes offres' }

const ONGLETS = [
  { cle: 'publiee', libelle: 'Publiées' },
  { cle: 'brouillon', libelle: 'Brouillons' },
  { cle: 'suspendue', libelle: 'Suspendues' },
  { cle: 'epuisee', libelle: 'Épuisées' },
]

export default async function OffresPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await exigerLecture('/offres', ['producteur'])
  const { ecrire } = await droitsEcran('/offres', ['producteur'])
  const demande = (await searchParams).onglet
  const onglet = ONGLETS.some((o) => o.cle === demande) ? demande! : 'publiee'

  const supabase = await createClient()
  const { data } = await supabase.from('offres').select(SELECT_OFFRE).order('created_at', { ascending: false }).returns<Offre[]>()
  const offres = data ?? []
  const affichees = offres.filter((o) => o.statut === onglet)

  return (
    <>
      <PageHeader
        titre="Mes offres"
        description="Vos produits finis proposés aux clients, disponibles maintenant ou à une date. Les prix sont en FCFA par unité de vente."
      >
        {ecrire && (
          <Button asChild>
            <Link href="/offres/nouvelle">
              <Plus className="h-4 w-4" aria-hidden /> Nouvelle offre
            </Link>
          </Button>
        )}
      </PageHeader>
      <Onglets base="/offres" actif={onglet} onglets={ONGLETS.map((o) => ({ ...o, compte: offres.filter((x) => x.statut === o.cle).length }))} />
      {affichees.length === 0 ? (
        <Vide titre="Aucune offre ici">{onglet === 'publiee' ? 'Créez une offre et publiez-la pour qu’elle soit visible des clients.' : undefined}</Vide>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {affichees.map((o) => (
            <li key={o.id}>
              <CarteOffre offre={o} href={`/offres/${o.id}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
