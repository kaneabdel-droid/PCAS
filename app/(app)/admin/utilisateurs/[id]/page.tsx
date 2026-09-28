import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { ChampsUtilisateur } from '@/components/admin/ChampsUtilisateur'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/champ'
import {
  changerEtatUtilisateur,
  modifierUtilisateur,
  renvoyerLien,
  supprimerUtilisateur,
} from '@/app/(app)/admin/utilisateurs/actions'
import { optionsUtilisateur } from '@/lib/admin-listes'
import { LIBELLES_ROLES, type RoleBase } from '@/lib/roles'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const metadata: Metadata = { title: 'Utilisateur' }

type Fiche = {
  id: string
  email: string
  nom_complet: string
  telephone: string | null
  fonction: string | null
  role_base: RoleBase
  profil_id: string | null
  entreprise_id: string | null
  actif: boolean
  signataire: boolean
  created_at: string
  entreprises: { denomination: string } | null
}

export default async function UtilisateurPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: u }, options, ctx] = await Promise.all([
    supabase
      .from('utilisateurs')
      .select('id, email, nom_complet, telephone, fonction, role_base, profil_id, entreprise_id, actif, signataire, created_at, entreprises(denomination)')
      .eq('id', id)
      .maybeSingle<Fiche>(),
    optionsUtilisateur(),
    getContexte(),
  ])
  if (!u) notFound()
  const { data: auth } = await createAdminClient().auth.admin.getUserById(id)
  const derniereConnexion = auth?.user?.last_sign_in_at ?? null
  const soiMeme = id === ctx.userId

  return (
    <>
      <Link href="/admin/utilisateurs" className="mb-4 inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Utilisateurs
      </Link>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{u.nom_complet}</h1>
          <p className="text-sm text-foreground-muted">
            {u.email} · {u.entreprises?.denomination ?? 'Plateforme PCAS'} · créé le {formatDate(u.created_at)} ·{' '}
            {derniereConnexion ? `dernière connexion le ${formatDate(derniereConnexion)}` : 'invitation non encore acceptée'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge ton="primaire">{LIBELLES_ROLES[u.role_base]}</Badge>
          {u.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Désactivé</Badge>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <FormulaireAction action={modifierUtilisateur} libelle="Enregistrer">
            <input type="hidden" name="utilisateur_id" value={u.id} />
            <ChampsUtilisateur entreprises={options.entreprises} profils={options.profils} valeurs={u} emailModifiable={false} />
          </FormulaireAction>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-heading font-semibold">Accès</h2>
            <p className="mb-3 mt-1 text-sm text-foreground-muted">
              {derniereConnexion
                ? 'Envoyer un lien pour choisir un nouveau mot de passe.'
                : 'L’utilisateur ne s’est jamais connecté : renvoyer l’invitation.'}
            </p>
            <FormulaireAction action={renvoyerLien} libelle={derniereConnexion ? 'Envoyer le lien' : 'Renvoyer l’invitation'} variante="outline" enCoursLibelle="Envoi…">
              <input type="hidden" name="utilisateur_id" value={u.id} />
            </FormulaireAction>
          </Card>

          {!soiMeme && (
            <Card>
              <h2 className="font-heading font-semibold">{u.actif ? 'Désactiver le compte' : 'Réactiver le compte'}</h2>
              <p className="mb-3 mt-1 text-sm text-foreground-muted">
                {u.actif ? 'L’utilisateur perd immédiatement l’accès ; son historique est conservé.' : 'L’utilisateur retrouve l’accès.'}
              </p>
              <FormulaireAction
                action={changerEtatUtilisateur}
                libelle={u.actif ? 'Désactiver' : 'Réactiver'}
                variante={u.actif ? 'outline' : 'default'}
                confirmation={u.actif ? `Désactiver le compte de ${u.nom_complet} ?` : undefined}
              >
                <input type="hidden" name="utilisateur_id" value={u.id} />
                <input type="hidden" name="actif" value={u.actif ? 'false' : 'true'} />
              </FormulaireAction>
            </Card>
          )}

          {!soiMeme && (
            <Card className="border-danger/40">
              <h2 className="font-heading font-semibold text-danger">Supprimer le compte</h2>
              <p className="mb-3 mt-1 text-sm text-foreground-muted">Définitif. Préférez la désactivation si l’utilisateur a déjà agi sur la plateforme.</p>
              <FormulaireAction
                action={supprimerUtilisateur}
                libelle="Supprimer"
                variante="danger"
                confirmation={`Supprimer définitivement le compte de ${u.nom_complet} ?`}
              >
                <input type="hidden" name="utilisateur_id" value={u.id} />
              </FormulaireAction>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
