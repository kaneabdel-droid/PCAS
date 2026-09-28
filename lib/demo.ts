import DEMO from '@/lib/demo-comptes.json'
import type { RoleBase } from '@/lib/roles'

// Démonstration : connexion en un clic aux comptes fictifs créés par `npm run demo`.
// Active uniquement sur le déploiement de démonstration (DEMO_ACTIVE=oui et DEMO_MOT_DE_PASSE), jamais en production :
// les comptes superviseur et administrateur voient toutes les données de la plateforme.

export type CompteDemo = {
  cle: string
  email: string
  nom: string
  fonction: string
  role: RoleBase
  entreprise: string | null
  entrepriseNom: string | null
  description: string
}

export const MESSAGE_DEMO = 'Opération désactivée sur la démonstration (elle enverrait un email ou bloquerait les autres visiteurs).'

export function demoActive(): boolean {
  return process.env.DEMO_ACTIVE === 'oui' && (process.env.DEMO_MOT_DE_PASSE ?? '').length >= 10
}

const ENTREPRISES = DEMO.entreprises as Record<string, { denomination: string }>

export const COMPTES_DEMO: CompteDemo[] = DEMO.comptes.map((c) => ({
  cle: c.cle,
  email: c.email,
  nom: c.nom,
  fonction: c.fonction,
  role: c.role as RoleBase,
  entreprise: c.entreprise,
  entrepriseNom: c.entreprise ? ENTREPRISES[c.entreprise].denomination : null,
  description: c.description,
}))

export function estCompteDemo(email: string | null | undefined): boolean {
  return Boolean(email) && COMPTES_DEMO.some((c) => c.email === email!.toLowerCase())
}
