import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EcranAuth } from '@/components/EcranAuth'
import { demoActive } from '@/lib/demo'
import { FormulaireAuth } from '@/components/FormulaireAuth'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/app/auth/actions'

export const metadata: Metadata = { title: 'Connexion' }

const ERREURS: Record<string, string> = {
  compte: 'Ce compte est désactivé ou n’est pas encore configuré. Contactez l’administrateur de la plateforme.',
  entreprise: 'Votre entreprise est suspendue. Contactez l’administrateur de la plateforme.',
  lien: 'Ce lien est invalide ou a expiré. Demandez un nouveau lien.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams
  return (
    <EcranAuth titre="Connexion" sousTitre="Accédez à votre espace PCAS.">
      {demoActive() && (
        <Link
          href="/demo"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary-soft p-3 text-sm font-medium text-foreground hover:border-primary"
        >
          Découvrir la démonstration : entrer en un clic avec un producteur, un client, une banque ou le superviseur
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </Link>
      )}
      {erreur && ERREURS[erreur] && (
        <p className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">{ERREURS[erreur]}</p>
      )}
      <FormulaireAuth action={signIn} libelle="Se connecter">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link href="/mot-de-passe-oublie" className="text-xs font-medium text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <Input id="password" name="password" type="password" required autoComplete="current-password" className="h-11" />
        </div>
      </FormulaireAuth>
      <p className="mt-6 text-sm text-foreground-muted">
        Pas encore de compte ?{' '}
        <Link href="/demande-acces" className="font-medium text-primary hover:underline">
          Demander un accès
        </Link>
        {' · '}
        <Link href="/guide" className="font-medium text-primary hover:underline">
          Guide d’utilisation
        </Link>
      </p>
    </EcranAuth>
  )
}
