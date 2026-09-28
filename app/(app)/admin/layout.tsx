import { exigerAdmin } from '@/lib/admin'

// Espace d'administration : réservé à l'administrateur de la plateforme.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await exigerAdmin()
  return children
}
