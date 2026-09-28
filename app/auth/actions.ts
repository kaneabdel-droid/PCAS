'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

type Resultat = { error?: string; success?: string }

export async function signIn(formData: FormData): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (error) return { error: 'Email ou mot de passe incorrect.' }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/** Envoie le lien de réinitialisation. Même réponse que l'adresse existe ou non (pas de divulgation des comptes). */
export async function demanderReinitialisation(formData: FormData): Promise<Resultat> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) return { error: 'Indiquez votre adresse email.' }
  const supabase = await createClient()
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm?next=/auth/nouveau-mot-de-passe`,
  })
  return { success: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient de lui être envoyé.' }
}

/** Définition du mot de passe : première connexion après invitation, ou réinitialisation. */
export async function definirMotDePasse(formData: FormData): Promise<Resultat> {
  const motDePasse = String(formData.get('password') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  if (motDePasse.length < 10) return { error: 'Le mot de passe doit contenir au moins 10 caractères.' }
  if (motDePasse !== confirmation) return { error: 'Les deux mots de passe ne correspondent pas.' }

  const supabase = await createClient()
  const { data: jeton } = await supabase.auth.getClaims()
  if (!jeton?.claims?.sub) return { error: 'Lien expiré. Demandez un nouveau lien de réinitialisation.' }

  const { error } = await supabase.auth.updateUser({ password: motDePasse })
  if (error) return { error: 'Enregistrement du mot de passe impossible. Réessayez.' }
  redirect('/')
}
