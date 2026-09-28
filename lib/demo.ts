import DEMO from '@/lib/demo-comptes.json'
import type { RoleBase } from '@/lib/roles'

// Démonstration : connexion en un clic aux comptes fictifs créés par `npm run demo` (page /decouvrir-pcas).
// Active par défaut, comme pour les autres produits DembaSolution ; DEMO_ACTIVE=non la coupe (page de découverte sans
// connexion, bandeau masqué). Les comptes superviseur et administrateur de démonstration voient toutes les données de la
// base : le jour où de vraies entreprises y travaillent, coupez la démonstration ou séparez les projets Supabase.

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
  return process.env.DEMO_ACTIVE !== 'non'
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

/** Garde-fou des opérations sensibles : refusées pour un compte de démonstration (et pour ce qui les viserait). */
export function refusDemo(email: string | null | undefined): string | null {
  return demoActive() && estCompteDemo(email) ? MESSAGE_DEMO : null
}
