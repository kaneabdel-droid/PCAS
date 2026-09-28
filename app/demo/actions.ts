'use server'

import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { demoActive, estCompteDemo } from '@/lib/demo'

// Connexion en un clic à un compte de démonstration, même mécanisme que SIGGIE et D-QUINCA : lien de connexion à usage
// unique généré côté serveur (clé service-role) puis vérifié aussitôt. Aucun mot de passe n'est stocké ni transmis au
// visiteur, et chaque clic ouvre sa propre session sans déconnecter les autres visiteurs du même compte.
// Liste blanche : seules les adresses du fichier des comptes de démonstration sont acceptées.
export async function connexionDemo(fd: FormData) {
  if (!demoActive()) notFound()
  const email = String(fd.get('email') ?? '').toLowerCase()
  if (!estCompteDemo(email)) redirect('/decouvrir-pcas?erreur=1#demo')

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token) {
    console.error('Lien de démonstration impossible', error?.message)
    redirect('/decouvrir-pcas?erreur=1#demo')
  }

  const supabase = await createClient()
  await supabase.auth.signOut()
  const { error: erreurVerification } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (erreurVerification) {
    console.error('Connexion de démonstration impossible', erreurVerification.message)
    redirect('/decouvrir-pcas?erreur=1#demo')
  }
  redirect('/')
}
