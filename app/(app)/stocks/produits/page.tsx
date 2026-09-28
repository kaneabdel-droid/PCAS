import type { Metadata } from 'next'
import { PageStocks, type FiltresStocks } from '@/components/stocks/PageStocks'
import { exigerLecture } from '@/lib/droits'

export const metadata: Metadata = { title: 'Stock produits finis' }

export default async function StockProduitsPage({ searchParams }: { searchParams: Promise<FiltresStocks> }) {
  await exigerLecture('/stocks/produits', ['producteur', 'administrateur', 'superviseur'])
  return (
    <PageStocks
      nature="produit_fini"
      href="/stocks/produits"
      titre="Stock produits finis"
      description="Le stock disponible (physique moins réservé) plafonne vos offres immédiates. Les réservations sont faites à la validation des commandes."
      filtres={await searchParams}
    />
  )
}
