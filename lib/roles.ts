// Rôles de base (enum role_base en base) et types d'entreprise (enum type_entreprise).

export type RoleBase = 'administrateur' | 'superviseur' | 'producteur' | 'client' | 'financier'
export type TypeEntreprise = 'producteur' | 'client' | 'banque'

export const LIBELLES_ROLES: Record<RoleBase, string> = {
  administrateur: 'Administrateur',
  superviseur: 'Superviseur',
  producteur: 'Producteur',
  client: 'Client',
  financier: 'Financier',
}

export const LIBELLES_TYPES_ENTREPRISE: Record<TypeEntreprise, string> = {
  producteur: 'Producteur',
  client: 'Client',
  banque: 'Banque / institution financière',
}

/** Administrateur et superviseur appartiennent à la plateforme, sans entreprise. */
export const ROLES_PLATEFORME: RoleBase[] = ['administrateur', 'superviseur']

export const estRoleBase = (v: unknown): v is RoleBase =>
  typeof v === 'string' && v in LIBELLES_ROLES

/** Libellé enrichi tenant compte de l'habilitation filière (ex. Administrateur Filière Céréales) */
export function libelleRoleComplet(role: RoleBase, filiere?: string | null): string {
  if (filiere) {
    const noms: Record<string, string> = {
      cereale: 'Céréales & Grains',
      maraichage: 'Maraîchage & Légumes',
      fruitier: 'Arboriculture & Fruits',
    }
    const nomFiliere = noms[filiere] ?? filiere
    if (role === 'administrateur') return `Administrateur Filière (${nomFiliere})`
    if (role === 'superviseur') return `Superviseur Principal (${nomFiliere})`
  }
  if (role === 'administrateur') return 'Administrateur Général (SuperAdmin)'
  if (role === 'superviseur') return 'Superviseur Central'
  return LIBELLES_ROLES[role]
}
