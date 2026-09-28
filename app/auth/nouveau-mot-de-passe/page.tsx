import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { EcranAuth } from '@/components/EcranAuth'
import { FormulaireAuth } from '@/components/FormulaireAuth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { definirMotDePasse } from '@/app/auth/actions'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

// Atteinte après le lien d'invitation ou de réinitialisation (/auth/confirm a ouvert la session).
export default async function NouveauMotDePassePage() {
  const supabase = await createClient()
  const { data: jeton } = await supabase.auth.getClaims()
  if (!jeton?.claims?.sub) redirect('/login?erreur=lien')

  return (
    <EcranAuth titre="Choisissez votre mot de passe" sousTitre="Au moins 10 caractères.">
      <FormulaireAuth action={definirMotDePasse} libelle="Enregistrer et continuer">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmation">Confirmation</Label>
          <Input id="confirmation" name="confirmation" type="password" required minLength={10} autoComplete="new-password" className="h-11" />
        </div>
      </FormulaireAuth>
    </EcranAuth>
  )
}
