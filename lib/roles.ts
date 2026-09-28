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
