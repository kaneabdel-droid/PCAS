'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'

type Resultat = { error?: string; success?: string } | void

/** Formulaire des écrans de connexion : envoie l'action serveur et affiche son message d'erreur ou de succès. */
export function FormulaireAuth({
  action,
  libelle,
  children,
}: {
  action: (formData: FormData) => Promise<Resultat>
  libelle: string
  children: React.ReactNode
}) {
  const [message, setMessage] = useState<{ type: 'error' | 'success'; texte: string } | null>(null)
  const [enCours, startTransition] = useTransition()

  function envoyer(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const res = await action(formData)
      if (res?.error) setMessage({ type: 'error', texte: res.error })
      else if (res?.success) setMessage({ type: 'success', texte: res.success })
    })
  }

  return (
    <form action={envoyer} className="space-y-4">
      {children}
      {message && (
        <p role="alert" className={message.type === 'error' ? 'text-sm text-danger' : 'text-sm text-success'}>
          {message.texte}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={enCours}>
        {enCours ? 'Patientez…' : libelle}
      </Button>
    </form>
  )
}
