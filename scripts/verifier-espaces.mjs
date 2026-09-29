// Vérifie que la démonstration et les données réelles sont étanches (migration 13_espace_demo).
//
//   npm run verifier-espaces
//
// Crée temporairement, dans l'espace RÉEL, un producteur et un client fictifs (adresses @reel.test, jamais emailées) avec
// une offre publiée, puis se connecte avec les comptes de démonstration (superviseur, administrateur, client, producteur)
// et vérifie qu'ils ne voient rien de l'espace réel, ni par les tables ni par les fonctions de la base, et inversement.
// Aucune commande ni aucun besoin réel n'est créé (la numérotation réelle reste intacte). Tout est supprimé à la fin.
// Prérequis : la démonstration existe (npm run demo).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) {
  console.error('Variables Supabase manquantes dans .env.local')
  process.exit(1)
}
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL_SUPABASE, CLE_SERVICE, options)
const suffixe = randomBytes(4).toString('hex')
const MOT_DE_PASSE = `Verif-${randomBytes(12).toString('base64url')}`

const resultats = []
function verifier(libelle, condition, detail = '') {
  resultats.push(Boolean(condition))
  console.log(`${condition ? '✓' : '✗'} ${libelle}${!condition && detail ? ` — ${detail}` : ''}`)
}
function exiger(resultat, libelle) {
  if (resultat.error) throw new Error(`${libelle} : ${resultat.error.message}`)
  return resultat.data
}

/** Session d'un compte de démonstration, par lien à usage unique (comme la page /decouvrir-pcas). */
async function sessionDemo(email) {
  const { data, error } = await service.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`Lien ${email} : ${error.message} (la démonstration existe-t-elle ? npm run demo)`)
  const client = createClient(URL_SUPABASE, CLE_ANON, options)
  exiger(await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' }), `Connexion ${email}`)
  return client
}

const crees = { entreprises: [], utilisateurs: [] }

async function compteReel(cle, entrepriseId, role) {
  const email = `verif-espace-${cle}-${suffixe}@reel.test`
  const { user } = exiger(await service.auth.admin.createUser({ email, password: MOT_DE_PASSE, email_confirm: true }), email)
  crees.utilisateurs.push(user.id)
  exiger(await service.from('utilisateurs').insert({ id: user.id, email, nom_complet: `Vérification ${cle}`, role_base: role, entreprise_id: entrepriseId, signataire: true, actif: true }), `Fiche ${email}`)
  const client = createClient(URL_SUPABASE, CLE_ANON, options)
  exiger(await client.auth.signInWithPassword({ email, password: MOT_DE_PASSE }), `Connexion ${email}`)
  return client
}

async function nettoyer() {
  await service.from('notifications').delete().eq('titre', `Demande d'accès : Vérification demande ${suffixe}`)
  await service.from('demandes_acces').delete().eq('email', `verif-espace-demande-${suffixe}@reel.test`)
  const e = crees.entreprises
  if (!e.length && !crees.utilisateurs.length) return
  for (const [table, colonne] of [
    ['offres', 'producteur_id'],
    ['mouvements_stock', 'entreprise_id'],
    ['stocks', 'entreprise_id'],
    ['sites_production', 'entreprise_id'],
    ['acceptations_contrat', 'entreprise_id'],
  ]) await service.from(table).delete().in(colonne, e)
  await service.from('notifications').delete().in('destinataire_id', crees.utilisateurs)
  await service.from('utilisateurs').delete().in('id', crees.utilisateurs)
  await service.from('entreprises').delete().in('id', e)
  await service.from('journal_audit').delete().in('entreprise_id', e)
  for (const id of crees.utilisateurs) await service.auth.admin.deleteUser(id)
}

async function principal() {
  console.log(`\nÉtanchéité démonstration / réel — ${URL_SUPABASE}\n`)

  // --- Espace réel temporaire -------------------------------------------------
  const nouvelle = async (type, nom) => {
    const id = exiger(await service.from('entreprises').insert({ type, denomination: `${nom} ${suffixe}`, region: 'Dakar', email: `${type}-${suffixe}@reel.test` }).select('id, demo').single(), nom)
    crees.entreprises.push(id.id)
    return id
  }
  const producteur = await nouvelle('producteur', 'Vérification Producteur réel')
  const client = await nouvelle('client', 'Vérification Client réel')
  verifier('Entreprises créées dans l’espace réel', producteur.demo === false && client.demo === false)
  const cProd = await compteReel('producteur', producteur.id, 'producteur')
  const cClient = await compteReel('client', client.id, 'client')

  for (const [c, type] of [[cProd, 'producteur'], [cClient, 'client']]) {
    const { data: modele } = await c.from('modeles_contrat').select('id').eq('type', type).eq('statut', 'en_vigueur').single()
    exiger(await c.rpc('accepter_contrat', { p_modele: modele.id, p_nom_signataire: 'Vérification', p_fonction_signataire: 'Gérant', p_adresse_ip: null, p_agent_utilisateur: 'verifier-espaces' }), 'Contrat')
  }
  const { data: produit } = await service.from('produits').select('id').eq('nom', 'Tomate').single()
  const site = exiger(await cProd.from('sites_production').insert({ entreprise_id: producteur.id, nom: 'Site vérification', region: 'Dakar' }).select('id').single(), 'Site')
  exiger(await cProd.from('capacites_production').insert({ site_id: site.id, produit_id: produit.id, capacite_jour: 10 }), 'Capacité')
  exiger(await cProd.from('mouvements_stock').insert({ site_id: site.id, produit_id: produit.id, type: 'entree', motif: 'recolte', quantite: 50, commentaire: 'Vérification' }), 'Stock')
  const offre = exiger(await cProd.from('offres').insert({ producteur_id: producteur.id, site_id: site.id, produit_id: produit.id, prix_unitaire: 5000, quantite_offerte: 40, statut: 'publiee' }).select('id').single(), 'Offre')

  // --- Les comptes de démonstration ne voient rien du réel ---------------------
  const demo = {
    superviseur: await sessionDemo('demo.superviseur@pcas.test'),
    admin: await sessionDemo('demo.admin@pcas.test'),
    client: await sessionDemo('demo.capvert@pcas.test'),
    producteur: await sessionDemo('demo.mboro@pcas.test'),
  }
  for (const [nom, c] of Object.entries(demo)) {
    const { data: e } = await c.from('entreprises').select('id').in('id', [producteur.id, client.id])
    verifier(`Démo ${nom} : entreprises réelles invisibles`, (e ?? []).length === 0)
    const { data: u } = await c.from('utilisateurs').select('id').in('id', crees.utilisateurs)
    verifier(`Démo ${nom} : utilisateurs réels invisibles`, (u ?? []).length === 0)
    const { data: o } = await c.from('offres').select('id').eq('id', offre.id)
    verifier(`Démo ${nom} : offre réelle invisible (table)`, (o ?? []).length === 0)
    const { data: st } = await c.from('stocks').select('entreprise_id').eq('entreprise_id', producteur.id)
    verifier(`Démo ${nom} : stock réel invisible`, (st ?? []).length === 0)
  }
  for (const nom of ['superviseur', 'admin', 'client']) {
    const { data: marche } = await demo[nom].rpc('marche_offres')
    verifier(`Démo ${nom} : offre réelle absente du marché`, !(marche ?? []).some((m) => m.id === offre.id))
    const { data: prods } = await demo[nom].rpc('producteurs_publics')
    verifier(`Démo ${nom} : producteur réel absent de l’annuaire`, !(prods ?? []).some((p) => p.id === producteur.id))
  }
  const { data: analyse } = await demo.superviseur.rpc('analyse_capacite', { p_producteur: producteur.id, p_produit: produit.id, p_date: null })
  verifier('Démo superviseur : analyse de capacité d’un producteur réel refusée', (analyse ?? []).length === 0)
  const { data: capacite } = await demo.superviseur.rpc('capacite_periode', { p_entreprise: producteur.id, p_produit: produit.id, p_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) })
  verifier('Démo superviseur : capacité de production d’un producteur réel masquée', capacite === null)
  const { data: alternatifs } = await demo.superviseur.rpc('producteurs_alternatifs', { p_produit: produit.id, p_date: null, p_exclure_commande: null })
  verifier('Démo superviseur : producteur réel absent des alternatives', !(alternatifs ?? []).some((a) => a.producteur_id === producteur.id))
  const { data: enRegle } = await demo.superviseur.rpc('contrat_en_regle', { p_entreprise: producteur.id })
  verifier('Démo superviseur : situation contractuelle d’une entreprise réelle masquée', enRegle === null)
  const { data: journal } = await demo.admin.from('journal_audit').select('id').in('entreprise_id', crees.entreprises)
  verifier('Démo administrateur : journal d’audit réel invisible', (journal ?? []).length === 0)

  const melange = await demo.client.rpc('creer_commande', {
    p_producteur: producteur.id,
    p_lignes: [{ offre_id: offre.id, quantite: 5 }],
    p_mode_paiement: 'virement',
    p_banque: null,
    p_adresse: 'Dakar',
    p_region: 'Dakar',
    p_contact: 'Vérification',
    p_date_souhaitee: new Date().toISOString().slice(0, 10),
    p_echeancier: [{ pourcentage: 100, delai_jours: 0 }],
    p_commentaire: null,
  })
  verifier('Démo client : commande chez un producteur réel refusée', Boolean(melange.error))
  const panier = await demo.client.from('paniers').insert({ offre_id: offre.id, quantite: 5 })
  verifier('Démo client : offre réelle impossible à mettre au panier', Boolean(panier.error))
  const catalogue = await demo.admin.from('produits').update({ description: 'modifié par la démo' }).eq('id', produit.id).select('id')
  verifier('Démo administrateur : catalogue commun non modifiable', Boolean(catalogue.error) || (catalogue.data ?? []).length === 0)
  const forcer = await demo.admin.from('entreprises').update({ demo: false }).eq('demo', true).select('id')
  verifier('Démo administrateur : impossible de sortir une entreprise de la démonstration', Boolean(forcer.error) || (forcer.data ?? []).length === 0)

  // --- Et le réel ne voit rien de la démonstration ------------------------------
  const { data: marcheReel } = await cClient.rpc('marche_offres')
  const { data: offresDemo } = await service.from('offres').select('id, entreprises!inner(demo)').eq('entreprises.demo', true)
  const idsDemo = new Set((offresDemo ?? []).map((o) => o.id))
  verifier('Client réel : aucune offre de démonstration sur le marché', (marcheReel ?? []).length > 0 && !(marcheReel ?? []).some((m) => idsDemo.has(m.id)))
  const { data: entreprisesReel } = await cClient.from('entreprises').select('id, demo')
  verifier('Client réel : aucune entreprise de démonstration visible', !(entreprisesReel ?? []).some((e) => e.demo))

  // --- Numérotation séparée ----------------------------------------------------
  const { data: numeros } = await service.from('commandes').select('numero, entreprises!commandes_client_id_fkey!inner(demo)').eq('entreprises.demo', true)
  verifier('Commandes de démonstration numérotées DEMO-', (numeros ?? []).length > 0 && numeros.every((c) => c.numero.startsWith('DEMO-')), (numeros ?? []).find((c) => !c.numero.startsWith('DEMO-'))?.numero)

  // --- Formulaire public « Demander un accès » (visiteur non connecté) ---------
  const visiteur = createClient(URL_SUPABASE, CLE_ANON, options)
  const erreurs = []
  for (let i = 0; i < 4; i++) {
    const { error } = await visiteur.from('demandes_acces').insert({
      type_entreprise: 'client',
      denomination: `Vérification demande ${suffixe}`,
      contact_nom: 'Vérification',
      telephone: '770000000',
      email: `verif-espace-demande-${suffixe}@reel.test`,
    })
    erreurs.push(error)
  }
  verifier('Visiteur : demande d’accès acceptée', !erreurs[0], erreurs[0]?.message)
  verifier('Visiteur : 4e demande en 24 h refusée (limite de débit)', !erreurs[1] && !erreurs[2] && Boolean(erreurs[3]), erreurs.map((e) => e?.message ?? 'ok').join(' | '))
  const { data: demande } = await service.from('demandes_acces').select('demo').eq('email', `verif-espace-demande-${suffixe}@reel.test`).limit(1).maybeSingle()
  verifier('Visiteur : demande rangée dans l’espace réel', demande?.demo === false)

  const echecs = resultats.filter((r) => !r).length
  console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications réussies.`)
  process.exitCode = echecs ? 1 : 0
}

principal()
  .catch((erreur) => {
    console.error(`\n✗ Vérification interrompue : ${erreur.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await nettoyer()
    console.log('Données de vérification supprimées.')
  })
