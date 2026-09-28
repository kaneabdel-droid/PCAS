import { createClient } from '@/utils/supabase/server'
import type { Entreprise } from '@/lib/entreprise'

export type ModeleContrat = {
  id: string
  type: 'producteur' | 'client'
  version: string
  titre: string
  contenu: string
  statut: 'brouillon' | 'en_vigueur' | 'archive'
  empreinte_sha256: string | null
  publie_le: string | null
  created_at: string
}

/** Valeurs des marqueurs {{…}} d'un contrat, tirées de la fiche entreprise et du signataire. */
export function valeursContrat(
  entreprise: Pick<Entreprise, 'denomination' | 'type_identifiant' | 'identifiant_fiscal' | 'rccm' | 'adresse' | 'commune' | 'region'>,
  signataire?: { nom: string | null; fonction: string | null }
) {
  return {
    denomination: entreprise.denomination,
    type_identifiant: entreprise.type_identifiant,
    identifiant_fiscal: entreprise.identifiant_fiscal,
    rccm: entreprise.rccm,
    adresse: [entreprise.adresse, entreprise.commune, entreprise.region].filter(Boolean).join(', ') || null,
    signataire: signataire?.nom ?? null,
    fonction: signataire?.fonction ?? null,
  }
}

/** Version en vigueur du contrat pour un type d'entreprise (producteur ou client). */
export async function contratEnVigueur(type: 'producteur' | 'client') {
  const supabase = await createClient()
  const { data } = await supabase
    .from('modeles_contrat')
    .select('*')
    .eq('type', type)
    .eq('statut', 'en_vigueur')
    .maybeSingle<ModeleContrat>()
  return data
}
