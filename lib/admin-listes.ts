import { createClient } from '@/utils/supabase/server'
import type { RoleBase, TypeEntreprise } from '@/lib/roles'

/** Entreprises et profils proposés dans les formulaires d'utilisateur. */
export async function optionsUtilisateur() {
  const supabase = await createClient()
  const [{ data: entreprises }, { data: profils }] = await Promise.all([
    supabase.from('entreprises').select('id, denomination, type').order('denomination').returns<{ id: string; denomination: string; type: TypeEntreprise }[]>(),
    supabase.from('profils').select('id, libelle, role_base').eq('actif', true).order('libelle').returns<{ id: string; libelle: string; role_base: RoleBase }[]>(),
  ])
  return { entreprises: entreprises ?? [], profils: profils ?? [] }
}
