import { redirect } from 'next/navigation'

// Ancienne adresse de la démonstration : les comptes sont sur la page de présentation du produit.
export default function DemoPage() {
  redirect('/decouvrir-pcas#demo')
}
