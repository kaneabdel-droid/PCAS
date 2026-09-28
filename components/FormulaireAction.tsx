'use client'

import { useRef, useState, useTransition } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Resultat } from '@/lib/formulaire'

/**
 * Formulaire relié à une action serveur qui renvoie { error } ou { success } (convention du projet).
 * Affiche le message, désactive le bouton pendant l'envoi et vide le formulaire après succès si demandé.
 */
export function FormulaireAction({
  action,
  libelle,
  enCoursLibelle = 'Enregistrement…',
  variante,
  reinitialiser = false,
  confirmation,
  className,
  boutonClassName,
  children,
}: {
  action: (formData: FormData) => Promise<Resultat | void>
  libelle: string
  enCoursLibelle?: string
  variante?: ButtonProps['variant']
  reinitialiser?: boolean
  /** Question posée avant l'envoi (actions irréversibles). */
  confirmation?: string
  className?: string
  boutonClassName?: string
  children?: React.ReactNode
}) {
  const formulaire = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; texte: string } | null>(null)
  const [enCours, startTransition] = useTransition()

  function envoyer(formData: FormData) {
    if (confirmation && !window.confirm(confirmation)) return
    setMessage(null)
    startTransition(async () => {
      const res = await action(formData)
      if (res?.error) setMessage({ type: 'error', texte: res.error })
      else {
        if (res?.success) setMessage({ type: 'success', texte: res.success })
        if (reinitialiser) formulaire.current?.reset()
      }
    })
  }

  return (
    <form ref={formulaire} action={envoyer} className={cn('space-y-4', className)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variante} disabled={enCours} className={boutonClassName}>
          {enCours ? enCoursLibelle : libelle}
        </Button>
        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={cn('text-sm', message.type === 'error' ? 'text-danger' : 'text-success')}>
            {message.texte}
          </p>
        )}
      </div>
    </form>
  )
}
