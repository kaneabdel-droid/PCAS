import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { estRoleBase, type RoleBase, type TypeEntreprise } from '@/lib/roles'
import type { Matrice } from '@/lib/permissions'

export type Contexte = {
  userId: string
  email: string | undefined
  nomComplet: string
  role: RoleBase
  profilLibelle: string | null
  permissions: Matrice
  entrepriseId: string | null
  entrepriseNom: string | null
  entrepriseType: TypeEntreprise | null
}

type LigneUtilisateur = {
  nom_complet: string
  role_base: string
  actif: boolean
  entreprise_id: string | null
  entreprises: { denomination: string; type: TypeEntreprise; statut: string } | null
  profils: { libelle: string; role_base: string; matrice_permissions: Matrice; actif: boolean } | null
}

/** Contexte de l'utilisateur connecté (une requête par rendu grâce à cache). */
export const getContexte = cache(async (): Promise<Contexte> => {
  const supabase = await createClient()
  // getClaims vérifie la signature du jeton localement : pas d'aller-retour réseau supplémentaire par page.
  const { data: jeton } = await supabase.auth.getClaims()
  const sub = jeton?.claims?.sub
  if (!sub) redirect('/login')

  const { data } = await supabase
    .from('utilisateurs')
    .select(
      'nom_complet, role_base, actif, entreprise_id, entreprises(denomination, type, statut), profils(libelle, role_base, matrice_permissions, actif)'
    )
    .eq('id', sub)
    .maybeSingle<LigneUtilisateur>()

  // Compte sans ligne utilisateur, désactivé, ou entreprise suspendue : aucun accès (la base refuse déjà tout via mon_role()).
  // Déconnexion forcée avant le retour à l'écran de connexion (voir app/auth/deconnexion/route.ts).
  if (!data || !data.actif || !estRoleBase(data.role_base)) redirect('/auth/deconnexion?erreur=compte')
  if (data.entreprise_id && data.entreprises?.statut !== 'actif') redirect('/auth/deconnexion?erreur=entreprise')

  const profil = data.profils?.actif ? data.profils : null
  return {
    userId: sub,
    email: jeton?.claims?.email as string | undefined,
    nomComplet: data.nom_complet,
    role: data.role_base,
    profilLibelle: profil?.libelle ?? null,
    permissions: profil?.matrice_permissions ?? {},
    entrepriseId: data.entreprise_id,
    entrepriseNom: data.entreprises?.denomination ?? null,
    entrepriseType: data.entreprises?.type ?? null,
  }
})
