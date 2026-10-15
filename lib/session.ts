import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { estRoleBase, type RoleBase, type TypeEntreprise } from '@/lib/roles'
import type { Matrice } from '@/lib/permissions'
import { COOKIE_FILIERE, estFiliereCode, resoudreFiliereActive, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'

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
  filiere: FiliereCode | null
  filiereActive: FiliereFiltre
  filieresActivesPlateforme: FiliereCode[]
}

type LigneUtilisateur = {
  nom_complet: string
  role_base: string
  actif: boolean
  entreprise_id: string | null
  filiere?: string | null
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

  const [{ data }, { data: parametres }, cookieStore] = await Promise.all([
    supabase
      .from('utilisateurs')
      .select(
        'nom_complet, role_base, actif, entreprise_id, filiere, entreprises(denomination, type, statut), profils(libelle, role_base, matrice_permissions, actif)'
      )
      .eq('id', sub)
      .maybeSingle<LigneUtilisateur>(),
    supabase.from('parametres_plateforme').select('filieres_actives').single(),
    cookies(),
  ])

  // Compte sans ligne utilisateur, désactivé, ou entreprise suspendue : aucun accès (la base refuse déjà tout via mon_role()).
  // Déconnexion forcée avant le retour à l'écran de connexion (voir app/auth/deconnexion/route.ts).
  if (!data || !data.actif || !estRoleBase(data.role_base)) redirect('/auth/deconnexion?erreur=compte')
  if (data.entreprise_id && data.entreprises?.statut !== 'actif') redirect('/auth/deconnexion?erreur=entreprise')

  const profil = data.profils?.actif ? data.profils : null
  const filieresActives: FiliereCode[] = Array.isArray(parametres?.filieres_actives) && parametres.filieres_actives.length > 0
    ? (parametres.filieres_actives as FiliereCode[])
    : ['cereale', 'maraichage', 'fruitier']
  const userFiliere: FiliereCode | null = estFiliereCode(data.filiere) ? data.filiere : null
  const cookieVal = cookieStore.get(COOKIE_FILIERE)?.value
  const filiereActive = resoudreFiliereActive(cookieVal, filieresActives, userFiliere)

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
    filiere: userFiliere,
    filiereActive,
    filieresActivesPlateforme: filieresActives,
  }
})

