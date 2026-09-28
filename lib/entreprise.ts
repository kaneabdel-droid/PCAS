import { createClient } from '@/utils/supabase/server'
import type { RoleBase, TypeEntreprise } from '@/lib/roles'

export type Entreprise = {
  id: string
  type: TypeEntreprise
  denomination: string
  sigle: string | null
  forme_juridique: string | null
  adresse: string | null
  region: string | null
  departement: string | null
  commune: string | null
  pays: string
  telephone: string | null
  email: string | null
  site_web: string | null
  type_identifiant: string
  identifiant_fiscal: string | null
  rccm: string | null
  representant_legal: string | null
  logo_path: string | null
  statut: 'actif' | 'suspendu'
  created_at: string
}

export type CompteBancaire = {
  id: string
  banque: string
  intitule: string
  numero_compte: string
  code_swift: string | null
  principal: boolean
}

export type Capacite = { id: string; produit_id: string; capacite_jour: number; produits: { nom: string; unite: string } | null }

export type Site = {
  id: string
  nom: string
  region: string | null
  departement: string | null
  commune: string | null
  localite: string | null
  latitude: number | null
  longitude: number | null
  superficie_ha: number | null
  jours_ouvres_semaine: number
  actif: boolean
  capacites_production: Capacite[]
}

export type UtilisateurEntreprise = {
  id: string
  email: string
  nom_complet: string
  telephone: string | null
  fonction: string | null
  role_base: RoleBase
  actif: boolean
  signataire: boolean
}

export type Acceptation = {
  id: string
  nom_signataire: string
  fonction_signataire: string
  accepte_le: string
  jeton_public: string
  modeles_contrat: { version: string; titre: string; statut: string } | null
}

/** Fiche complète d'une entreprise (la RLS limite ce qu'on peut lire : sa propre entreprise, ou tout pour la plateforme). */
export async function chargerEntreprise(id: string) {
  const supabase = await createClient()
  const [entreprise, comptes, sites, utilisateurs, acceptations] = await Promise.all([
    supabase.from('entreprises').select('*').eq('id', id).maybeSingle<Entreprise>(),
    supabase
      .from('entreprise_comptes_bancaires')
      .select('id, banque, intitule, numero_compte, code_swift, principal')
      .eq('entreprise_id', id)
      .order('principal', { ascending: false })
      .order('created_at')
      .returns<CompteBancaire[]>(),
    supabase
      .from('sites_production')
      .select('id, nom, region, departement, commune, localite, latitude, longitude, superficie_ha, jours_ouvres_semaine, actif, capacites_production(id, produit_id, capacite_jour, produits(nom, unite))')
      .eq('entreprise_id', id)
      .order('nom')
      .returns<Site[]>(),
    supabase
      .from('utilisateurs')
      .select('id, email, nom_complet, telephone, fonction, role_base, actif, signataire')
      .eq('entreprise_id', id)
      .order('nom_complet')
      .returns<UtilisateurEntreprise[]>(),
    supabase
      .from('acceptations_contrat')
      .select('id, nom_signataire, fonction_signataire, accepte_le, jeton_public, modeles_contrat(version, titre, statut)')
      .eq('entreprise_id', id)
      .order('accepte_le', { ascending: false })
      .returns<Acceptation[]>(),
  ])
  if (!entreprise.data) return null
  return {
    entreprise: entreprise.data,
    comptes: comptes.data ?? [],
    sites: sites.data ?? [],
    utilisateurs: utilisateurs.data ?? [],
    acceptations: acceptations.data ?? [],
  }
}

export type DonneesEntreprise = NonNullable<Awaited<ReturnType<typeof chargerEntreprise>>>

/** Produits finis actifs (pour les capacités de production). */
export async function produitsFinis() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('produits')
    .select('id, nom, unite')
    .eq('nature', 'produit_fini')
    .eq('actif', true)
    .order('nom')
  return data ?? []
}
