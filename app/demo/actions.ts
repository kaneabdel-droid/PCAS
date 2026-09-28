'use server'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { demoActive, estCompteDemo } from '@/lib/demo'

/** Connexion en un clic à un compte de démonstration (liste blanche du fichier des comptes, jamais une adresse libre). */
export async function connexionDemo(fd: FormData) {
  if (!demoActive()) notFound()
  const email = String(fd.get('email') ?? '').toLowerCase()
  if (!estCompteDemo(email)) redirect('/demo?erreur=1')

  const supabase = await createClient()
  await supabase.auth.signOut()
  const { error } = await supabase.auth.signInWithPassword({ email, password: process.env.DEMO_MOT_DE_PASSE! })
  if (error) redirect('/demo?erreur=1')
  redirect('/')
}
