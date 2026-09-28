import type { Metadata } from 'next'
import { PageStocks, type FiltresStocks } from '@/components/stocks/PageStocks'
import { exigerLecture } from '@/lib/droits'

export const metadata: Metadata = { title: 'Stock matière première' }

export default async function StockMatieresPage({ searchParams }: { searchParams: Promise<FiltresStocks> }) {
  await exigerLecture('/stocks/matieres', ['producteur', 'administrateur', 'superviseur'])
  return (
    <PageStocks
      nature="matiere_premiere"
      href="/stocks/matieres"
      titre="Stock matière première"
      description="Jamais visible des clients. Avec vos capacités de production, il permet à la plateforme d’estimer la production attendue."
      filtres={await searchParams}
    />
  )
}
