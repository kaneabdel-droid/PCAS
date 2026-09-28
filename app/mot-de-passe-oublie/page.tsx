import type { Metadata } from 'next'
import Link from 'next/link'
import { EcranAuth } from '@/components/EcranAuth'
import { FormulaireAuth } from '@/components/FormulaireAuth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { demanderReinitialisation } from '@/app/auth/actions'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function MotDePasseOubliePage() {
  return (
    <EcranAuth titre="Mot de passe oublié" sousTitre="Recevez par email un lien pour choisir un nouveau mot de passe.">
      <FormulaireAuth action={demanderReinitialisation} libelle="Envoyer le lien">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-11" />
        </div>
      </FormulaireAuth>
      <p className="mt-6 text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </EcranAuth>
  )
}
