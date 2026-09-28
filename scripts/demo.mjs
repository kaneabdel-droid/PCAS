// Démonstration de PCAS : tous les acteurs et tous les cas du circuit, sur des données réalistes (produits, prix, régions
// et volumes du Sénégal) mais des entreprises fictives. À exécuter UNIQUEMENT sur le projet Supabase de démonstration.
//
//   npm run demo
//
// Chaque exécution efface d'abord les données des entreprises de démonstration (et de l'ancienne recette), puis
// reconstruit tout : la démonstration repart toujours du même état, avec des dates relatives au jour d'exécution.
//
// Garde-fou : refusé si DEMO_ACTIVE=non (démonstration coupée sur ce projet).
// Chaque étape passe par les fonctions de la base avec le compte de l'acteur concerné, comme dans l'application.
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const DEMO = JSON.parse(readFileSync(new URL('../lib/demo-comptes.json', import.meta.url), 'utf8'))
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
// Mot de passe aléatoire à chaque exécution, jamais affiché : les visiteurs entrent par /decouvrir-pcas (lien à usage unique).
const MOT_DE_PASSE = `Demo-${randomBytes(18).toString('base64url')}`

if (process.env.DEMO_ACTIVE === 'non') {
  console.error('Refusé : la démonstration est coupée sur ce projet (DEMO_ACTIVE=non).')
  process.exit(1)
}
if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) {
  console.error('Variables manquantes : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL_SUPABASE, CLE_SERVICE, options)

let etapes = 0
function exiger(resultat, libelle) {
  if (resultat.error) throw new Error(`${libelle} : ${resultat.error.message}`)
  etapes += 1
  return resultat.data
}
const jour = (decalage = 0) => new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10)
const log = (texte) => console.log(`  ${texte}`)

// ---------------------------------------------------------------------------
// Réinitialisation (entreprises de démonstration et de recette uniquement)
// ---------------------------------------------------------------------------

async function reinitialiser() {
  // Espace de démonstration (indicateur posé par ce script), plus les entreprises de l'ancienne recette.
  const { data: demo } = await service.from('entreprises').select('id').eq('demo', true)
  const { data: recette } = await service.from('entreprises').select('id').in('denomination', DEMO.anciennes_entreprises_recette)
  const ids = [...new Set([...(demo ?? []), ...(recette ?? [])].map((e) => e.id))]
  const { data: utilisateurs } = await service.from('utilisateurs').select('id').like('email', '%@pcas.test')
  const uids = (utilisateurs ?? []).map((u) => u.id)
  if (!ids.length && !uids.length) return

  const liste = (x) => (x.length ? x : ['00000000-0000-0000-0000-000000000000'])
  const { data: autres } = await service.from('utilisateurs').select('email').in('entreprise_id', liste(ids)).not('email', 'like', '%@pcas.test')
  if (autres?.length) throw new Error(`Des comptes réels sont rattachés aux entreprises de démonstration (${autres.map((u) => u.email).join(', ')}) : rien n'est supprimé.`)
  const { data: commandes } = await service.from('commandes').select('id').or(`client_id.in.(${liste(ids).join(',')}),producteur_id.in.(${liste(ids).join(',')})`)
  const cids = liste((commandes ?? []).map((c) => c.id))
  const { data: factures } = await service.from('factures').select('id, nature').in('commande_id', cids)
  const definitives = liste((factures ?? []).filter((f) => f.nature === 'definitive').map((f) => f.id))
  const provisoires = liste((factures ?? []).filter((f) => f.nature === 'provisoire').map((f) => f.id))
  const { data: bls } = await service.from('bons_livraison').select('id').in('commande_id', cids)
  const blids = liste((bls ?? []).map((b) => b.id))

  const suppressions = [
    ['notifications', (q) => q.in('destinataire_id', liste(uids))],
    ['documents', (q) => q.in('commande_id', cids)],
    ['factures', (q) => q.in('id', definitives)],
    ['factures', (q) => q.in('id', provisoires)],
    ['bons_reception', (q) => q.in('commande_id', cids)],
    ['bons_livraison', (q) => q.in('id', blids)],
    ['commandes', (q) => q.in('id', cids)],
    ['propositions_besoin', (q) => q.in('producteur_id', liste(ids))],
    ['besoins_achat', (q) => q.in('client_id', liste(ids))],
    ['declarations_production', (q) => q.in('entreprise_id', liste(ids))],
    ['offres', (q) => q.in('producteur_id', liste(ids))],
    ['mouvements_stock', (q) => q.in('entreprise_id', liste(ids))],
    ['stocks', (q) => q.in('entreprise_id', liste(ids))],
    ['sites_production', (q) => q.in('entreprise_id', liste(ids))],
    ['acceptations_contrat', (q) => q.in('entreprise_id', liste(ids))],
    ['utilisateurs', (q) => q.in('id', liste(uids))],
    ['entreprises', (q) => q.in('id', liste(ids))],
    ['profils', (q) => q.eq('code', 'commercial_producteur')],
    ['demandes_acces', (q) => q.like('email', '%@pcas.test')],
    ['journal_audit', (q) => q.in('entreprise_id', liste(ids))],
    ['sequences_numerotation', (q) => q.like('type', '%-DEMO')],
  ]
  for (const [table, filtre] of suppressions) exiger(await filtre(service.from(table).delete()), `Suppression ${table}`)
  for (const uid of uids) await service.auth.admin.deleteUser(uid)
  console.log(`Réinitialisation : ${ids.length} entreprise(s), ${uids.length} compte(s), ${cids.length} commande(s) supprimés.`)
}

// ---------------------------------------------------------------------------
// Entreprises, comptes, contrats
// ---------------------------------------------------------------------------

async function creerEntreprises() {
  const ids = {}
  for (const [cle, e] of Object.entries(DEMO.entreprises)) {
    const { data: existante } = await service.from('entreprises').select('id').eq('denomination', e.denomination).maybeSingle()
    if (existante) throw new Error(`« ${e.denomination} » existe déjà : relancez avec --reinitialiser.`)
    ids[cle] = exiger(await service.from('entreprises').insert({ ...e, pays: 'SN', type_identifiant: 'NINEA', demo: true }).select('id').single(), e.denomination).id
  }
  const comptes = [
    ['walo', 'CBAO Groupe Attijariwafa bank', 'Coopérative des Riziculteurs du Walo', 'SN012 01240 00000000010 12'],
    ['mboro', 'Banque Agricole', 'GIE Maraîchers de Mboro', 'SN179 01001 00000000020 23'],
    ['bignona', 'Crédit Mutuel du Sénégal', 'Union des Arboriculteurs de Bignona', 'SN140 01001 00000000030 34'],
    ['goudomp', 'Ecobank Sénégal', 'Coopérative Anacarde de Goudomp', 'SN094 01001 00000000040 45'],
  ]
  for (const [cle, banque, intitule, numero] of comptes) {
    exiger(await service.from('entreprise_comptes_bancaires').insert({ entreprise_id: ids[cle], banque, intitule, numero_compte: numero, principal: true }), 'Compte bancaire')
  }
  return ids
}

async function creerComptes(ids) {
  const profil = exiger(
    await service
      .from('profils')
      .upsert({
        code: 'commercial_producteur',
        demo: true,
        libelle: 'Commercial producteur',
        role_base: 'producteur',
        matrice_permissions: { '/echeances': { modifier: false }, '/offres': { modifier: false }, '/stocks/matieres': { ecrire: false, modifier: false } },
      }, { onConflict: 'code' })
      .select('id')
      .single(),
    'Profil commercial'
  )
  const clients = {}
  const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 })
  for (const c of DEMO.comptes) {
    let compte = liste?.users?.find((u) => u.email === c.email)
    if (compte) await service.auth.admin.updateUserById(compte.id, { password: MOT_DE_PASSE })
    else compte = exiger(await service.auth.admin.createUser({ email: c.email, password: MOT_DE_PASSE, email_confirm: true }), c.email).user
    exiger(
      await service.from('utilisateurs').upsert({
        id: compte.id,
        email: c.email,
        nom_complet: c.nom,
        fonction: c.fonction,
        telephone: '+221 77 000 00 00',
        role_base: c.role,
        entreprise_id: c.entreprise ? ids[c.entreprise] : null,
        profil_id: c.profil ? profil.id : null,
        signataire: (c.role === 'producteur' || c.role === 'client') && !c.profil,
        actif: true,
        demo: true,
      }),
      `Fiche ${c.email}`
    )
    const client = createClient(URL_SUPABASE, CLE_ANON, options)
    exiger(await client.auth.signInWithPassword({ email: c.email, password: MOT_DE_PASSE }), `Connexion ${c.email}`)
    clients[c.cle] = client
  }
  return clients
}

async function accepterContrats(c) {
  // Épicerie Centrale de Kaolack n'accepte pas : elle illustre un client dont les actions sont bloquées.
  for (const cle of ['walo', 'mboro', 'bignona', 'goudomp', 'capvert', 'petitecote', 'sahel']) {
    const type = DEMO.entreprises[cle].type
    const { data: modele } = await c[cle].from('modeles_contrat').select('id').eq('type', type).eq('statut', 'en_vigueur').single()
    const compte = DEMO.comptes.find((x) => x.cle === cle)
    exiger(await c[cle].rpc('accepter_contrat', { p_modele: modele.id, p_nom_signataire: compte.nom, p_fonction_signataire: compte.fonction, p_adresse_ip: null, p_agent_utilisateur: 'démonstration' }), `Contrat ${cle}`)
  }
}

// ---------------------------------------------------------------------------
// Production : sites, capacités, stocks, transformations, offres
// ---------------------------------------------------------------------------

const produits = {}
async function produit(nom) {
  if (!produits[nom]) produits[nom] = exiger(await service.from('produits').select('id').eq('nom', nom).single(), nom).id
  return produits[nom]
}

async function site(client, entrepriseId, valeurs, capacites) {
  const s = exiger(await client.from('sites_production').insert({ entreprise_id: entrepriseId, ...valeurs }).select('id').single(), `Site ${valeurs.nom}`)
  for (const [nom, capacite] of capacites) {
    exiger(await client.from('capacites_production').insert({ site_id: s.id, produit_id: await produit(nom), capacite_jour: capacite }), 'Capacité')
  }
  return s.id
}

async function mouvement(client, siteId, nom, type, motif, quantite, commentaire, joursAvant = 0) {
  exiger(
    await client.from('mouvements_stock').insert({ site_id: siteId, produit_id: await produit(nom), type, motif, quantite, commentaire, date_mouvement: jour(-joursAvant) }),
    `Mouvement ${nom}`
  )
}

async function offre(client, entrepriseId, siteId, nom, valeurs, statut = 'publiee') {
  return exiger(
    await client.from('offres').insert({ producteur_id: entrepriseId, site_id: siteId, produit_id: await produit(nom), statut, ...valeurs }).select('id').single(),
    `Offre ${nom}`
  ).id
}

async function production(c, ids) {
  const o = {}

  // Riz : paddy (matière première) transformé en riz blanchi ; oignon de la vallée
  const walo = await site(c.walo, ids.walo, { nom: 'Rizerie de Ross-Béthio', region: 'Saint-Louis', departement: 'Dagana', commune: 'Ross-Béthio', localite: 'Thiagar', superficie_ha: 420, jours_ouvres_semaine: 6 }, [
    ['Riz local blanchi', 120],
    ['Oignon', 60],
  ])
  await mouvement(c.walo, walo, 'Riz paddy', 'entree', 'recolte', 320, 'Récolte campagne sèche chaude', 40)
  exiger(await c.walo.rpc('transformer', { p_site: walo, p_matiere: await produit('Riz paddy'), p_quantite_matiere: 200, p_produit: await produit('Riz local blanchi'), p_quantite_produit: 2600, p_date: jour(-30), p_commentaire: 'Décorticage lot 1' }), 'Transformation paddy')
  await mouvement(c.walo, walo, 'Oignon', 'entree', 'recolte', 900, 'Récolte oignon violet de Galmi', 20)
  await mouvement(c.walo, walo, 'Riz local blanchi', 'sortie', 'perte', 12, 'Sacs abîmés à l’entrepôt', 10)
  o.riz = await offre(c.walo, ids.walo, walo, 'Riz local blanchi', { prix_unitaire: 17500, quantite_offerte: 2000, quantite_min_commande: 20, variete: 'Sahel 108', qualite: 'Brisures ≤ 10 %', conditionnement: 'Sacs de 50 kg', description: 'Riz de la vallée du fleuve Sénégal, décortiqué dans notre rizerie.' })
  o.oignonWalo = await offre(c.walo, ids.walo, walo, 'Oignon', { prix_unitaire: 9200, quantite_offerte: 500, quantite_min_commande: 10, variete: 'Violet de Galmi', calibre: '50-70 mm', conditionnement: 'Sacs filets de 25 kg' })
  await offre(c.walo, ids.walo, walo, 'Riz local blanchi', { prix_unitaire: 16800, quantite_offerte: 200, variete: 'Sahel 134', qualite: 'Brisures 25 %' }, 'brouillon')

  // Maraîchage des Niayes
  const mboro = await site(c.mboro, ids.mboro, { nom: 'Périmètre maraîcher de Mboro', region: 'Thiès', departement: 'Tivaouane', commune: 'Mboro', superficie_ha: 85, jours_ouvres_semaine: 6 }, [
    ['Oignon', 90],
    ['Pomme de terre', 60],
    ['Carotte', 40],
  ])
  await mouvement(c.mboro, mboro, 'Oignon', 'entree', 'recolte', 1800, 'Récolte oignon', 25)
  await mouvement(c.mboro, mboro, 'Pomme de terre', 'entree', 'recolte', 1200, 'Récolte pomme de terre', 18)
  await mouvement(c.mboro, mboro, 'Carotte', 'entree', 'recolte', 450, 'Récolte carotte', 8)
  exiger(await c.mboro.rpc('inventorier', { p_site: mboro, p_produit: await produit('Carotte'), p_quantite_comptee: 440, p_commentaire: 'Inventaire mensuel' }), 'Inventaire')
  o.oignon = await offre(c.mboro, ids.mboro, mboro, 'Oignon', { prix_unitaire: 9000, quantite_offerte: 1500, quantite_min_commande: 20, variete: 'Violet de Galmi', calibre: '50-70 mm', conditionnement: 'Sacs filets de 25 kg' })
  o.pdt = await offre(c.mboro, ids.mboro, mboro, 'Pomme de terre', { prix_unitaire: 11500, quantite_offerte: 1000, quantite_min_commande: 10, variete: 'Spunta', calibre: '45-65 mm', conditionnement: 'Sacs de 25 kg' })
  o.carotte = await offre(c.mboro, ids.mboro, mboro, 'Carotte', { prix_unitaire: 8500, quantite_offerte: 400, variete: 'Nantaise', conditionnement: 'Sacs de 25 kg' })

  // Fruits de Casamance : offres à date (saison des mangues, des oranges)
  const bignona = await site(c.bignona, ids.bignona, { nom: 'Vergers de Bignona', region: 'Ziguinchor', departement: 'Bignona', commune: 'Bignona', superficie_ha: 260, jours_ouvres_semaine: 6 }, [
    ['Mangue', 150],
    ['Orange', 30],
    ['Madd', 20],
  ])
  await mouvement(c.bignona, bignona, 'Mangue', 'entree', 'recolte', 650, 'Cueillette mangue Kent', 6)
  await mouvement(c.bignona, bignona, 'Madd', 'entree', 'recolte', 320, 'Cueillette madd', 4)
  o.mangue = await offre(c.bignona, ids.bignona, bignona, 'Mangue', { prix_unitaire: 6000, quantite_offerte: 600, quantite_min_commande: 20, variete: 'Kent', calibre: '400-550 g', conditionnement: 'Caisses de 10 kg' })
  o.mangueDate = await offre(c.bignona, ids.bignona, bignona, 'Mangue', { prix_unitaire: 5500, quantite_offerte: 3000, quantite_min_commande: 50, date_disponibilite: jour(45), variete: 'Kent', conditionnement: 'Caisses de 10 kg', description: 'Pleine saison : réservez dès maintenant.' })
  o.orange = await offre(c.bignona, ids.bignona, bignona, 'Orange', { prix_unitaire: 7000, quantite_offerte: 1000, date_disponibilite: jour(120), variete: 'Valencia', conditionnement: 'Caisses de 15 kg' })
  o.madd = await offre(c.bignona, ids.bignona, bignona, 'Madd', { prix_unitaire: 1500, quantite_offerte: 300, quantite_min_commande: 10, conditionnement: 'Sacs de 10 kg' })
  const suspendue = await offre(c.bignona, ids.bignona, bignona, 'Madd', { prix_unitaire: 1400, quantite_offerte: 10, conditionnement: 'Vrac' })
  exiger(await c.bignona.from('offres').update({ statut: 'suspendue' }).eq('id', suspendue), 'Suspension')

  // Anacarde : noix brute (matière première) transformée en amande
  const goudomp = await site(c.goudomp, ids.goudomp, { nom: 'Unité de transformation de Goudomp', region: 'Sédhiou', departement: 'Goudomp', commune: 'Goudomp', superficie_ha: 140, jours_ouvres_semaine: 5 }, [['Amande de cajou', 60]])
  await mouvement(c.goudomp, goudomp, 'Noix de cajou brute', 'entree', 'achat', 8000, 'Collecte auprès des membres', 35)
  exiger(await c.goudomp.rpc('transformer', { p_site: goudomp, p_matiere: await produit('Noix de cajou brute'), p_quantite_matiere: 6000, p_produit: await produit('Amande de cajou'), p_quantite_produit: 1320, p_date: jour(-20), p_commentaire: 'Décorticage et dépelliculage' }), 'Transformation cajou')
  o.amande = await offre(c.goudomp, ids.goudomp, goudomp, 'Amande de cajou', { prix_unitaire: 4800, quantite_offerte: 1200, quantite_min_commande: 50, calibre: 'W320', qualite: 'Blanche entière', conditionnement: 'Cartons sous vide de 22,68 kg' })

  log('Production : 4 producteurs, 4 sites, stocks et transformations, 12 offres (immédiates, à date, brouillon, suspendue)')
  return o
}

// ---------------------------------------------------------------------------
// Circuit de commande
// ---------------------------------------------------------------------------

const ECHEANCIERS = {
  moitie: [
    { pourcentage: 50, delai_jours: 0 },
    { pourcentage: 50, delai_jours: 30 },
  ],
  comptant: [{ pourcentage: 100, delai_jours: 0 }],
  trenteJours: [{ pourcentage: 100, delai_jours: 30 }],
}

async function circuit(c, ids, o) {
  const adresses = {
    capvert: ['Zone industrielle, route de Rufisque, Dakar', 'Dakar', 'Magasin central — 33 000 20 11'],
    petitecote: ['Route de la Somone, Saly Portudal', 'Thiès', 'Économat — 33 000 20 12'],
    sahel: ['Port autonome de Dakar, môle 3', 'Dakar', 'Quai export — 33 000 20 13'],
  }
  const commandes = {}
  const commander = async (nom, client, producteur, offreId, quantite, { mode = 'virement', banque = null, echeancier = 'moitie', souhaitee = 7 } = {}) => {
    const [adresse, region, contact] = adresses[client]
    commandes[nom] = exiger(
      await c[client].rpc('creer_commande', {
        p_producteur: ids[producteur],
        p_lignes: [{ offre_id: offreId, quantite }],
        p_mode_paiement: mode,
        p_banque: banque ? ids[banque] : null,
        p_adresse: adresse,
        p_region: region,
        p_contact: contact,
        p_date_souhaitee: jour(souhaitee),
        p_echeancier: ECHEANCIERS[echeancier],
        p_commentaire: null,
      }),
      `Commande ${nom}`
    )
    return commandes[nom]
  }
  const approuver = async (id, dans = 7, commentaire = null) => exiger(await c.superviseur.rpc('approuver_commande', { p_commande: id, p_date_convenue: jour(dans), p_commentaire: commentaire }), 'Approbation')
  const valider = async (prod, id, groupee = false) => exiger(await c[prod].rpc('valider_commande', { p_commande: id, p_facturation_groupee: groupee, p_commentaire: null }), 'Validation')
  const livrer = async (prod, id, quantite = null) => {
    const { data: lignes } = await c[prod].from('lignes_commande').select('id, quantite, quantite_livree').eq('commande_id', id)
    const l = lignes[0]
    return exiger(
      await c[prod].rpc('emettre_bl', {
        p_commande: id,
        p_lignes: [{ ligne_id: l.id, quantite: quantite ?? Number(l.quantite) - Number(l.quantite_livree) }],
        p_date: jour(0),
        p_transporteur: 'Transports Diallo & Fils',
        p_immatriculation: 'DK-2458-BF',
        p_chauffeur: 'Mamadou Diallo',
        p_commentaire: null,
      }),
      'Bon de livraison'
    )
  }
  const receptionner = async (client, bl, manque = 0, motif = null, commentaire = 'Marchandise conforme') => {
    const { data: br } = await c[client].from('bons_reception').select('id').eq('bl_id', bl).single()
    const { data: ligne } = await c[client].from('bl_lignes').select('id, quantite').eq('bl_id', bl).single()
    exiger(
      await c[client].rpc('valider_reception', { p_br: br.id, p_lignes: [{ bl_ligne_id: ligne.id, quantite_recue: Number(ligne.quantite) - manque, motif }], p_commentaire: commentaire }),
      'Réception'
    )
  }
  const payer = async (prod, commande, nombre = 99, mode = 'virement') => {
    const { data: factures } = await c[prod].from('factures').select('id').eq('commande_id', commande).eq('nature', 'definitive')
    const { data: echeances } = await c[prod].from('echeances').select('id').in('facture_id', factures.map((f) => f.id)).order('rang').limit(nombre)
    for (const e of echeances) exiger(await c[prod].rpc('marquer_echeance_payee', { p_echeance: e.id, p_date: jour(0), p_mode: mode, p_reference: `VIR-${e.id.slice(0, 6).toUpperCase()}` }), 'Paiement')
  }
  const bonDe = async (commande) => (await service.from('bons_paiement').select('id').eq('commande_id', commande).single()).data.id

  // 1. Soumise (à approuver)
  await commander('soumise', 'petitecote', 'mboro', o.carotte, 100)
  // 2. En attente
  await commander('attente', 'sahel', 'goudomp', o.amande, 300, { echeancier: 'trenteJours' })
  exiger(await c.superviseur.rpc('mettre_en_attente', { p_commande: commandes.attente, p_motif: 'Analyse qualité export demandée (taux d’humidité) avant approbation.' }), 'Attente')
  // 3. Refusée
  await commander('refusee', 'capvert', 'mboro', o.pdt, 50)
  exiger(await c.superviseur.rpc('refuser_commande', { p_commande: commandes.refusee, p_motif: 'Doublon d’une commande déjà en cours pour la même livraison.' }), 'Refus')
  // 4. Annulée par le client
  await commander('annulee', 'petitecote', 'bignona', o.madd, 50)
  exiger(await c.petitecote.rpc('annuler_commande', { p_commande: commandes.annulee, p_motif: 'Menu modifié.' }), 'Annulation')
  // 5. Approuvée, à valider par le producteur
  await commander('aValider', 'capvert', 'walo', o.riz, 150)
  await approuver(commandes.aValider, 6)
  // 6. Bon de paiement en attente de la banque
  await commander('attenteBanque', 'sahel', 'bignona', o.mangue, 200, { mode: 'bon_banque', banque: 'bda' })
  await approuver(commandes.attenteBanque, 5)
  // 7. Bon de paiement refusé par la banque
  await commander('refuseeBanque', 'petitecote', 'mboro', o.oignon, 80, { mode: 'bon_banque', banque: 'mecf' })
  await approuver(commandes.refuseeBanque, 5)
  exiger(await c.mecf.rpc('decider_bon_paiement', { p_bon: await bonDe(commandes.refuseeBanque), p_decision: 'refuse', p_reference: null, p_commentaire: 'Plafond d’engagement du client atteint pour ce trimestre.' }), 'Refus banque')
  // 8. Refusée par le producteur (retour au superviseur)
  await commander('refuseeProducteur', 'capvert', 'bignona', o.orange, 100, { souhaitee: 125 })
  await approuver(commandes.refuseeProducteur, 125)
  exiger(await c.bignona.rpc('refuser_par_producteur', { p_commande: commandes.refuseeProducteur, p_motif: 'Calibre demandé indisponible sur la prochaine récolte.' }), 'Refus producteur')
  // 9. Validée (bon bancaire approuvé), à livrer
  await commander('validee', 'sahel', 'walo', o.riz, 400, { mode: 'bon_banque', banque: 'bda' })
  await approuver(commandes.validee, 4)
  exiger(await c.bda.rpc('decider_bon_paiement', { p_bon: await bonDe(commandes.validee), p_decision: 'approuve', p_reference: 'BAD/ENG/2026/0451', p_commentaire: null }), 'Accord banque')
  await valider('walo', commandes.validee)
  // 10. Livrée partiellement (réception à confirmer)
  await commander('partielle', 'capvert', 'mboro', o.oignon, 300)
  await approuver(commandes.partielle, 3)
  await valider('mboro', commandes.partielle)
  await livrer('mboro', commandes.partielle, 200)
  // 11. Livrée : réception à confirmer par le client
  await commander('livree', 'petitecote', 'mboro', o.pdt, 120)
  await approuver(commandes.livree, 3)
  await valider('mboro', commandes.livree)
  await livrer('mboro', commandes.livree)
  // 12. En litige
  await commander('litige', 'capvert', 'bignona', o.mangue, 150)
  await approuver(commandes.litige, 3)
  await valider('bignona', commandes.litige)
  const blLitige = await livrer('bignona', commandes.litige)
  const { data: brLitige } = await c.capvert.from('bons_reception').select('id').eq('bl_id', blLitige).single()
  exiger(await c.capvert.rpc('contester_reception', { p_br: brLitige.id, p_motif: 'Une vingtaine de caisses arrivées trop mûres (transport de nuit sans ventilation).' }), 'Contestation')
  // 13. Litige arbitré par le superviseur
  await commander('arbitre', 'sahel', 'goudomp', o.amande, 200)
  await approuver(commandes.arbitre, 4)
  await valider('goudomp', commandes.arbitre)
  const blArbitre = await livrer('goudomp', commandes.arbitre)
  const { data: brArbitre } = await c.sahel.from('bons_reception').select('id').eq('bl_id', blArbitre).single()
  exiger(await c.sahel.rpc('contester_reception', { p_br: brArbitre.id, p_motif: 'Taux de brisures supérieur à la spécification W320 sur plusieurs cartons.' }), 'Contestation')
  const { data: ligneArbitre } = await c.superviseur.from('bl_lignes').select('id').eq('bl_id', blArbitre).single()
  exiger(await c.superviseur.rpc('arbitrer_litige', { p_br: brArbitre.id, p_lignes: [{ bl_ligne_id: ligneArbitre.id, quantite_recue: 190, motif: '10 kg déclassés après contrôle contradictoire' }], p_commentaire: 'Contrôle contradictoire du 12 : 10 kg hors spécification retirés de la facture.' }), 'Arbitrage')
  // 14. Réceptionnée avec écart, facture à payer
  await commander('ecart', 'petitecote', 'walo', o.riz, 100)
  await approuver(commandes.ecart, 3)
  await valider('walo', commandes.ecart)
  await receptionner('petitecote', await livrer('walo', commandes.ecart), 3, '3 sacs percés pendant le déchargement', 'Réception avec réserves')
  // 15. Partiellement payée
  await commander('partiellementPayee', 'capvert', 'walo', o.riz, 250)
  await approuver(commandes.partiellementPayee, 2)
  await valider('walo', commandes.partiellementPayee)
  await receptionner('capvert', await livrer('walo', commandes.partiellementPayee))
  await payer('walo', commandes.partiellementPayee, 1)
  // 16. Soldée
  await commander('soldee', 'sahel', 'mboro', o.oignon, 400, { echeancier: 'comptant' })
  await approuver(commandes.soldee, 2)
  await valider('mboro', commandes.soldee)
  await receptionner('sahel', await livrer('mboro', commandes.soldee))
  await payer('mboro', commandes.soldee)
  // 17. Réception tacite
  await commander('tacite', 'capvert', 'bignona', o.madd, 80)
  await approuver(commandes.tacite, 2)
  await valider('bignona', commandes.tacite)
  const blTacite = await livrer('bignona', commandes.tacite)
  await service.from('bons_reception').update({ date_limite: new Date(Date.now() - 3600000).toISOString() }).eq('bl_id', blTacite)
  exiger(await service.rpc('receptions_tacites'), 'Réception tacite')
  // 18. Répartie entre deux producteurs
  await commander('repartie', 'petitecote', 'mboro', o.oignon, 600)
  const { data: ligneRep } = await c.superviseur.from('lignes_commande').select('id').eq('commande_id', commandes.repartie).single()
  exiger(
    await c.superviseur.rpc('repartir_commande', {
      p_commande: commandes.repartie,
      p_affectations: [
        { ligne_id: ligneRep.id, offre_id: null, quantite: 350 },
        { ligne_id: ligneRep.id, offre_id: o.oignonWalo, quantite: 250 },
      ],
      p_commentaire: 'Volume réparti : stock insuffisant chez un seul producteur à la date demandée.',
    }),
    'Répartition'
  )
  // 19. Réorientée vers un autre producteur
  await commander('reorientee', 'sahel', 'walo', o.oignonWalo, 150)
  const { data: ligneReo } = await c.superviseur.from('lignes_commande').select('id').eq('commande_id', commandes.reorientee).single()
  exiger(
    await c.superviseur.rpc('repartir_commande', {
      p_commande: commandes.reorientee,
      p_affectations: [{ ligne_id: ligneReo.id, offre_id: o.oignon, quantite: 150 }],
      p_commentaire: 'Producteur plus proche du port pour l’export.',
    }),
    'Réorientation'
  )
  // 20. Facturation regroupée (deux livraisons, une facture définitive)
  await commander('groupee', 'sahel', 'mboro', o.pdt, 300)
  await approuver(commandes.groupee, 5)
  await valider('mboro', commandes.groupee, true)
  await receptionner('sahel', await livrer('mboro', commandes.groupee, 150))
  await receptionner('sahel', await livrer('mboro', commandes.groupee, 150))
  // 21. Échéance en retard
  await commander('retard', 'petitecote', 'walo', o.riz, 60, { echeancier: 'trenteJours' })
  await approuver(commandes.retard, 2)
  await valider('walo', commandes.retard)
  await receptionner('petitecote', await livrer('walo', commandes.retard))
  const { data: factureRetard } = await service.from('factures').select('id').eq('commande_id', commandes.retard).eq('nature', 'definitive').single()
  await service.from('echeances').update({ date_echeance: jour(-8) }).eq('facture_id', factureRetard.id)
  exiger(await service.rpc('echeances_en_retard'), 'Retards')
  // 22. Commande ferme sur offre à date, production partiellement déclarée
  await commander('aDate', 'petitecote', 'bignona', o.mangueDate, 500, { souhaitee: 46 })
  await approuver(commandes.aDate, 46)
  await valider('bignona', commandes.aDate)
  exiger(await c.bignona.rpc('declarer_production', { p_offre: o.mangueDate, p_quantite: 180, p_date: jour(0), p_commentaire: 'Premières cueillettes précoces' }), 'Déclaration de production')

  log(`Circuit : ${Object.keys(commandes).length} commandes couvrant tous les statuts, bons de paiement, livraisons, réceptions, litiges, factures et paiements`)
  return commandes
}

// ---------------------------------------------------------------------------
// Besoins d'achat et propositions
// ---------------------------------------------------------------------------

async function besoins(c, ids, o) {
  const creer = async (client, valeurs) => exiger(await c[client].from('besoins_achat').insert(valeurs).select('id').single(), 'Besoin').id
  const proposer = async (prod, besoin, siteNom, valeurs) => {
    const { data: s } = await c[prod].from('sites_production').select('id').eq('nom', siteNom).single()
    return exiger(await c[prod].from('propositions_besoin').insert({ besoin_id: besoin, site_id: s.id, ...valeurs }).select('id').single(), 'Proposition').id
  }

  // Besoin ouvert avec deux propositions en concurrence
  const b1 = await creer('sahel', { produit_id: await produit('Amande de cajou'), quantite: 1000, prix_cible: 4600, date_souhaitee: jour(30), region_livraison: 'Dakar', lieu_livraison: 'Port de Dakar', commentaire: 'Calibre W320 ou W240, certificat phytosanitaire requis.' })
  await proposer('goudomp', b1, 'Unité de transformation de Goudomp', { quantite: 600, prix_unitaire: 4750, date_disponibilite: jour(20), commentaire: '600 kg W320 disponibles, le reste après la prochaine collecte.' })
  // Besoin adressé à un producteur précis
  await creer('petitecote', { produit_id: await produit('Mangue'), quantite: 300, date_souhaitee: jour(15), region_livraison: 'Thiès', lieu_livraison: 'Saly', producteur_souhaite_id: ids.bignona, commentaire: 'Mangues Kent pour la saison touristique.' })
  // Besoin converti en commande (proposition retenue)
  const b3 = await creer('capvert', { produit_id: await produit('Pomme de terre'), quantite: 500, prix_cible: 11000, date_souhaitee: jour(10), region_livraison: 'Dakar', lieu_livraison: 'Hann' })
  const p3 = await proposer('mboro', b3, 'Périmètre maraîcher de Mboro', { quantite: 500, prix_unitaire: 11000, commentaire: 'Spunta calibre 45-65, livraison sous 5 jours.' })
  exiger(
    await c.capvert.rpc('retenir_proposition', {
      p_proposition: p3,
      p_quantite: 500,
      p_mode_paiement: 'virement',
      p_banque: null,
      p_adresse: 'Zone industrielle, route de Rufisque, Dakar',
      p_region: 'Dakar',
      p_contact: 'Magasin central — 33 000 20 11',
      p_date_souhaitee: jour(10),
      p_echeancier: ECHEANCIERS.moitie,
      p_commentaire: 'Commande issue de notre besoin d’achat.',
    }),
    'Proposition retenue'
  )
  // Besoin clos
  const b4 = await creer('sahel', { produit_id: await produit('Orange'), quantite: 200, date_souhaitee: jour(60), region_livraison: 'Dakar' })
  exiger(await c.sahel.from('besoins_achat').update({ statut: 'clos' }).eq('id', b4), 'Besoin clos')

  // Panier en cours chez un client
  exiger(await c.petitecote.from('paniers').upsert({ offre_id: o.carotte, quantite: 60 }), 'Panier')

  log('Besoins d’achat : ouvert avec proposition, adressé à un producteur, converti en commande, clos ; un panier en cours')
}

// ---------------------------------------------------------------------------
// Dates réalistes et divers
// ---------------------------------------------------------------------------

async function vieillir(commandes) {
  // Les commandes s'étalent sur les dernières semaines (ordre du scénario : les plus avancées sont les plus anciennes).
  const age = { soldee: 34, partiellementPayee: 30, retard: 45, groupee: 20, arbitre: 18, ecart: 16, litige: 12, tacite: 11, partielle: 9, livree: 8, validee: 7, aDate: 6, refuseeProducteur: 6, refuseeBanque: 5, attenteBanque: 4, aValider: 3, refusee: 3, annulee: 2, attente: 2, repartie: 1, reorientee: 1, soumise: 0 }
  for (const [nom, jours] of Object.entries(age)) {
    if (!commandes[nom] || !jours) continue
    await service.from('commandes').update({ soumise_le: new Date(Date.now() - jours * 86400000).toISOString() }).eq('id', commandes[nom])
  }
}

async function principal() {
  console.log(`\nDémonstration PCAS — ${URL_SUPABASE}\n`)
  await reinitialiser()

  const ids = await creerEntreprises()
  const c = await creerComptes(ids)
  log(`${Object.keys(ids).length} entreprises, ${DEMO.comptes.length} comptes (dont un profil restreint)`)
  await accepterContrats(c)
  log('Contrats d’engagement acceptés (sauf Épicerie Centrale de Kaolack, pour illustrer le blocage)')
  const offres = await production(c, ids)
  const commandes = await circuit(c, ids, offres)
  await besoins(c, ids, offres)
  await vieillir(commandes)
  await service.from('demandes_acces').insert({
    demo: true,
    type_entreprise: 'producteur',
    denomination: 'GIE des Femmes Transformatrices de Fatick',
    contact_nom: 'Ndèye Diouf',
    telephone: '+221 77 000 40 01',
    email: 'gie.fatick@pcas.test',
    region: 'Fatick',
    message: 'Nous transformons des céréales locales et souhaitons proposer nos produits sur PCAS.',
  })
  log('Une demande d’accès en attente pour l’administrateur')

  console.log(`\nDémonstration prête (${etapes} opérations). Connexion en un clic sur /decouvrir-pcas.`)
}

principal().catch((erreur) => {
  console.error(`\n✗ Démonstration interrompue : ${erreur.message}`)
  process.exitCode = 1
})
