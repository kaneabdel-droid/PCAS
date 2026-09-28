// Création du premier administrateur de la plateforme (une seule fois, après les migrations).
// Les comptes suivants sont créés depuis l'espace administrateur de l'application.
//
//   npm run creer-admin -- admin@exemple.com "Prénom Nom" "MotDePasseSolide"
//
// Lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local.
import { createClient } from '@supabase/supabase-js'

// Arrêt par process.exitCode (et non process.exit) : sous Windows, quitter brutalement pendant que des connexions réseau
// se ferment provoque « Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ».
function echec(message) {
  console.error(message)
  process.exitCode = 1
}

async function principal() {
  const [email, nomComplet, motDePasse] = process.argv.slice(2)
  if (!email || !nomComplet || !motDePasse) {
    return echec('Usage : npm run creer-admin -- <email> "<nom complet>" "<mot de passe>"')
  }
  if (motDePasse.length < 10) return echec('Le mot de passe doit contenir au moins 10 caractères.')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) {
    return echec('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être renseignés dans .env.local.')
  }

  const supabase = createClient(url, cle, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom_complet: nomComplet },
  })
  if (error) {
    const indice = /invalid api key/i.test(error.message)
      ? ' — la clé SUPABASE_SERVICE_ROLE_KEY ne correspond pas à ce projet (copiez la clé secrète complète depuis Project Settings › API Keys).'
      : ''
    return echec(`Création du compte impossible : ${error.message}${indice}`)
  }

  const { error: erreurLigne } = await supabase.from('utilisateurs').insert({
    id: data.user.id,
    email,
    nom_complet: nomComplet,
    role_base: 'administrateur',
  })
  if (erreurLigne) {
    // Pas de compte d'authentification orphelin : on annule la création.
    await supabase.auth.admin.deleteUser(data.user.id)
    return echec(`Enregistrement de l'administrateur impossible : ${erreurLigne.message}`)
  }

  console.log(`Administrateur créé : ${email}`)
}

await principal()
