// Recette de bout en bout de PCAS sur un projet Supabase (de développement ou de démonstration, jamais la production
// réelle) : crée un jeu de démonstration fictif puis déroule tout le circuit en se connectant avec chaque utilisateur,
// pour que les règles d'accès (RLS) et les fonctions de la base soient testées comme en conditions réelles.
//
//   npm run recette
//
// Lit NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY dans .env.local.
// Mot de passe des comptes de démonstration : RECETTE_MOT_DE_PASSE (sinon généré et affiché à la fin).
// Les données créées restent en place et servent de démonstration (entreprises suffixées « (démo) »).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SUPABASE || !CLE_ANON || !CLE_SERVICE) {
  console.error('Variables Supabase manquantes dans .env.local')
  process.exit(1)
}
const MOT_DE_PASSE = process.env.RECETTE_MOT_DE_PASSE || `Demo-${randomBytes(6).toString('base64url')}`
const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
const anonyme = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

const resultats = []
function verifier(libelle, condition, detail = '') {
  resultats.push({ libelle, ok: Boolean(condition) })
  console.log(`${condition ? '✓' : '✗'} ${libelle}${!condition && detail ? ` — ${detail}` : ''}`)
}
function exiger(resultat, libelle) {
  if (resultat.error) throw new Error(`${libelle} : ${resultat.error.message}`)
  return resultat.data
}
const jour = (decalage = 0) => new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10)

// ---------------------------------------------------------------------------
// Jeu de démonstration (fictif)
// ---------------------------------------------------------------------------

const ENTREPRISES = {
  delta: { type: 'producteur', denomination: 'Coopérative Rizicole du Delta (démo)', region: 'Saint-Louis', commune: 'Dagana', identifiant_fiscal: 'DEMO-0001' },
  niayes: { type: 'producteur', denomination: 'GIE Maraîchers des Niayes (démo)', region: 'Thiès', commune: 'Mboro', identifiant_fiscal: 'DEMO-0002' },
  client: { type: 'client', denomination: 'Société de Distribution Alimentaire de Dakar (démo)', region: 'Dakar', commune: 'Dakar', identifiant_fiscal: 'DEMO-0003', adresse: 'Zone industrielle' },
  banque: { type: 'banque', denomination: 'Banque de démonstration PCAS', region: 'Dakar', commune: 'Dakar', identifiant_fiscal: 'DEMO-0004' },
}

const UTILISATEURS = {
  superviseur: { email: 'demo.superviseur@pcas.test', nom: 'Superviseur Démo', role: 'superviseur', entreprise: null },
  delta: { email: 'demo.delta@pcas.test', nom: 'Awa Diop (démo)', role: 'producteur', entreprise: 'delta' },
  niayes: { email: 'demo.niayes@pcas.test', nom: 'Moussa Ndiaye (démo)', role: 'producteur', entreprise: 'niayes' },
  client: { email: 'demo.client@pcas.test', nom: 'Fatou Sarr (démo)', role: 'client', entreprise: 'client' },
  banque: { email: 'demo.banque@pcas.test', nom: 'Ibrahima Fall (démo)', role: 'financier', entreprise: 'banque' },
}

async function entreprise(cle) {
  const e = ENTREPRISES[cle]
  const { data: existante } = await service.from('entreprises').select('id').eq('denomination', e.denomination).maybeSingle()
  if (existante) return existante.id
  return exiger(await service.from('entreprises').insert({ ...e, demo: true }).select('id').single(), `Création ${e.denomination}`).id
}

async function utilisateur(cle, idsEntreprises) {
  const u = UTILISATEURS[cle]
  const { data: liste } = await service.auth.admin.listUsers({ perPage: 1000 })
  let compte = liste?.users?.find((x) => x.email === u.email)
  if (compte) {
    await service.auth.admin.updateUserById(compte.id, { password: MOT_DE_PASSE })
  } else {
    compte = exiger(await service.auth.admin.createUser({ email: u.email, password: MOT_DE_PASSE, email_confirm: true }), `Compte ${u.email}`).user
  }
  exiger(
    await service.from('utilisateurs').upsert({
      id: compte.id,
      email: u.email,
      nom_complet: u.nom,
      role_base: u.role,
      entreprise_id: u.entreprise ? idsEntreprises[u.entreprise] : null,
      signataire: u.role === 'producteur' || u.role === 'client',
      actif: true,
      demo: true,
    }),
    `Fiche ${u.email}`
  )
  const client = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  exiger(await client.auth.signInWithPassword({ email: u.email, password: MOT_DE_PASSE }), `Connexion ${u.email}`)
  return client
}

async function produit(nom) {
  return exiger(await service.from('produits').select('id').eq('nom', nom).single(), `Produit ${nom}`).id
}

async function principal() {
  console.log(`\nRecette PCAS — ${URL_SUPABASE}\n`)

  // --- Mise en place ---------------------------------------------------------
  const ids = {}
  for (const cle of Object.keys(ENTREPRISES)) ids[cle] = await entreprise(cle)
  const c = {}
  for (const cle of Object.keys(UTILISATEURS)) c[cle] = await utilisateur(cle, ids)
  verifier('Jeu de démonstration : 4 entreprises et 5 utilisateurs connectés', Object.keys(c).length === 5)

  const riz = await produit('Riz local blanchi')
  const oignon = await produit('Oignon')

  // Contrats d'engagement
  for (const cle of ['delta', 'niayes', 'client']) {
    const type = ENTREPRISES[cle].type
    const { data: modele } = await c[cle].from('modeles_contrat').select('id').eq('type', type).eq('statut', 'en_vigueur').maybeSingle()
    if (modele) await c[cle].rpc('accepter_contrat', { p_modele: modele.id, p_nom_signataire: UTILISATEURS[cle].nom, p_fonction_signataire: 'Gérant', p_adresse_ip: null, p_agent_utilisateur: 'recette' })
    const { data: enRegle } = await c[cle].rpc('contrat_en_regle', { p_entreprise: ids[cle] })
    verifier(`Contrat d'engagement accepté (${ENTREPRISES[cle].denomination})`, enRegle === true)
  }

  // Sites, capacités, stock, offres (producteurs)
  async function preparerProducteur(cle, produitId, stock, prix) {
    const client = c[cle]
    let { data: site } = await client.from('sites_production').select('id').limit(1).maybeSingle()
    if (!site) site = exiger(await client.from('sites_production').insert({ entreprise_id: ids[cle], nom: 'Site principal', region: ENTREPRISES[cle].region }).select('id').single(), 'Site')
    await client.from('capacites_production').upsert({ site_id: site.id, produit_id: produitId, capacite_jour: 100 }, { onConflict: 'site_id,produit_id' })
    // Ré-exécution : les offres d'un passage précédent sont suspendues et le disponible ramené exactement à `stock`.
    await client.from('offres').update({ statut: 'suspendue' }).eq('statut', 'publiee')
    const { data: actuel } = await client.from('stocks').select('quantite_disponible').eq('site_id', site.id).eq('produit_id', produitId).maybeSingle()
    const ecart = stock - Number(actuel?.quantite_disponible ?? 0)
    if (ecart !== 0) {
      exiger(
        await client.from('mouvements_stock').insert({ site_id: site.id, produit_id: produitId, type: ecart > 0 ? 'entree' : 'sortie', motif: ecart > 0 ? 'production' : 'autre', quantite: Math.abs(ecart), commentaire: 'Recette : stock de départ' }),
        'Stock de départ'
      )
    }
    const offre = exiger(
      await client.from('offres').insert({ producteur_id: ids[cle], site_id: site.id, produit_id: produitId, prix_unitaire: prix, quantite_offerte: stock, statut: 'publiee', calibre: 'Démonstration' }).select('id').single(),
      'Offre'
    )
    return { site: site.id, offre: offre.id }
  }
  const pDelta = await preparerProducteur('delta', riz, 500, 17500)
  const pNiayes = await preparerProducteur('niayes', oignon, 300, 9000)
  verifier('Offres publiées (riz 500 sacs, oignon 300 sacs)', Boolean(pDelta.offre && pNiayes.offre))

  const trop = await c.delta.from('offres').insert({ producteur_id: ids.delta, site_id: pDelta.site, produit_id: riz, prix_unitaire: 17000, quantite_offerte: 10, statut: 'publiee' })
  verifier('Refus d’une offre immédiate supérieure au stock disponible', Boolean(trop.error))

  // --- Règles d'accès --------------------------------------------------------
  const stocksClient = await c.client.from('stocks').select('*')
  verifier('Le client ne voit aucun stock (ni matière première ni produit fini)', (stocksClient.data ?? []).length === 0)
  const offresClient = await c.client.from('offres').select('id').in('id', [pDelta.offre, pNiayes.offre])
  verifier('Le client voit les offres publiées', (offresClient.data ?? []).length === 2)
  const offresAnonymes = await anonyme.from('offres').select('id')
  verifier('Un visiteur non connecté ne voit aucune offre', (offresAnonymes.data ?? []).length === 0)
  const entreprisesProducteur = await c.delta.from('entreprises').select('id')
  verifier('Un producteur ne voit que sa propre fiche entreprise', (entreprisesProducteur.data ?? []).length === 1)
  const journal = await c.client.from('journal_audit').select('id').limit(1)
  verifier('Le journal d’audit est invisible pour un client', (journal.data ?? []).length === 0)

  // --- Commandes -------------------------------------------------------------
  const conditions = (mode, banque = null) => ({
    p_mode_paiement: mode,
    p_banque: banque,
    p_adresse: 'Zone industrielle, Dakar',
    p_region: 'Dakar',
    p_contact: 'Réception — 77 000 00 00',
    p_date_souhaitee: jour(3),
    p_echeancier: [
      { pourcentage: 50, delai_jours: 0 },
      { pourcentage: 50, delai_jours: 30 },
    ],
    p_commentaire: 'Commande de recette',
  })
  const commander = async (producteur, offre, quantite, mode = 'virement', banque = null) =>
    exiger(await c.client.rpc('creer_commande', { p_producteur: producteur, p_lignes: [{ offre_id: offre, quantite }], ...conditions(mode, banque) }), 'Commande')

  const c1 = await commander(ids.delta, pDelta.offre, 100)
  const c2 = await commander(ids.niayes, pNiayes.offre, 50, 'bon_banque', ids.banque)
  verifier('Commandes émises par le client', Boolean(c1 && c2))

  const avantApprobation = await c.delta.from('commandes').select('id').eq('id', c1)
  verifier('Le producteur ne voit pas une commande avant l’approbation', (avantApprobation.data ?? []).length === 0)

  exiger(await c.superviseur.rpc('approuver_commande', { p_commande: c1, p_date_convenue: jour(3), p_commentaire: null }), 'Approbation C1')
  exiger(await c.superviseur.rpc('approuver_commande', { p_commande: c2, p_date_convenue: jour(3), p_commentaire: null }), 'Approbation C2')
  const { data: st2 } = await service.from('commandes').select('statut').eq('id', c2).single()
  verifier('Paiement par bon : la commande attend la banque', st2.statut === 'attente_banque')

  const validationPrematuree = await c.niayes.rpc('valider_commande', { p_commande: c2, p_facturation_groupee: false, p_commentaire: null })
  verifier('Le producteur ne peut pas valider avant l’accord de la banque', Boolean(validationPrematuree.error))

  const { data: bon } = await c.banque.from('bons_paiement').select('id').eq('commande_id', c2).single()
  exiger(await c.banque.rpc('decider_bon_paiement', { p_bon: bon.id, p_decision: 'approuve', p_reference: 'REF-RECETTE-001', p_commentaire: null }), 'Bon de paiement')

  exiger(await c.delta.rpc('valider_commande', { p_commande: c1, p_facturation_groupee: false, p_commentaire: null }), 'Validation C1')
  exiger(await c.niayes.rpc('valider_commande', { p_commande: c2, p_facturation_groupee: false, p_commentaire: null }), 'Validation C2')
  const { data: stockRiz } = await service.from('stocks').select('quantite_disponible').eq('site_id', pDelta.site).eq('produit_id', riz).single()
  verifier('Validation : 100 sacs réservés (disponible 400)', Number(stockRiz.quantite_disponible) === 400)

  // --- Concurrence : deux validations simultanées sur le même stock ----------
  const c3 = await commander(ids.delta, pDelta.offre, 250)
  const c4 = await commander(ids.delta, pDelta.offre, 150)
  for (const id of [c3, c4]) exiger(await c.superviseur.rpc('approuver_commande', { p_commande: id, p_date_convenue: jour(3), p_commentaire: null }), 'Approbation')
  // Le disponible est ramené à 350 : les deux commandes (250 + 150) ne peuvent pas passer ensemble.
  const { data: dispo } = await service.from('stocks').select('quantite_disponible').eq('site_id', pDelta.site).eq('produit_id', riz).single()
  exiger(await c.delta.from('mouvements_stock').insert({ site_id: pDelta.site, produit_id: riz, type: 'sortie', motif: 'perte', quantite: Number(dispo.quantite_disponible) - 350, commentaire: 'Recette : concurrence' }), 'Sortie')
  const deuxValidations = await Promise.all([
    c.delta.rpc('valider_commande', { p_commande: c3, p_facturation_groupee: false, p_commentaire: null }),
    c.delta.rpc('valider_commande', { p_commande: c4, p_facturation_groupee: false, p_commentaire: null }),
  ])
  const reussies = deuxValidations.filter((r) => !r.error).length
  verifier('Concurrence : deux validations simultanées sur le même stock, une seule réussit', reussies === 1, `${reussies} réussie(s)`)
  const { data: stockApres } = await service.from('stocks').select('quantite_physique, quantite_reservee').eq('site_id', pDelta.site).eq('produit_id', riz).single()
  verifier('Le stock n’est jamais négatif (réservé ≤ physique)', Number(stockApres.quantite_reservee) <= Number(stockApres.quantite_physique))

  // --- Livraison, réception avec écart, facture, paiement --------------------
  const { data: ligne1 } = await c.delta.from('lignes_commande').select('id').eq('commande_id', c1).single()
  const bl1 = exiger(await c.delta.rpc('emettre_bl', { p_commande: c1, p_lignes: [{ ligne_id: ligne1.id, quantite: 100 }], p_date: jour(0), p_transporteur: 'Transports Démo', p_immatriculation: 'DK-0000-A', p_chauffeur: null, p_commentaire: null }), 'BL C1')
  const { data: fp } = await c.client.from('factures').select('nature, statut').eq('bl_id', bl1).single()
  verifier('Bon de livraison + facture provisoire', fp?.nature === 'provisoire' && fp?.statut === 'provisoire')

  const { data: br1 } = await c.client.from('bons_reception').select('id').eq('bl_id', bl1).single()
  const { data: blLigne } = await c.client.from('bl_lignes').select('id').eq('bl_id', bl1).single()
  exiger(await c.client.rpc('valider_reception', { p_br: br1.id, p_lignes: [{ bl_ligne_id: blLigne.id, quantite_recue: 98, motif: '2 sacs déchirés' }], p_commentaire: 'Recette' }), 'Réception C1')
  const { data: fd } = await c.client.from('factures').select('id, montant_total').eq('commande_id', c1).eq('nature', 'definitive').single()
  verifier('Facture définitive sur les quantités reçues (98 × 17 500 = 1 715 000)', Number(fd?.montant_total) === 1715000)
  const { data: ech } = await c.client.from('echeances').select('id, montant').eq('facture_id', fd.id).order('rang')
  verifier('Deux échéances de 50 % (857 500 chacune)', ech?.length === 2 && ech.every((e) => Number(e.montant) === 857500))

  const paiementClient = await c.client.rpc('marquer_echeance_payee', { p_echeance: ech[0].id, p_date: jour(0), p_mode: 'virement', p_reference: 'X' })
  verifier('Le client ne peut pas cocher « payé »', Boolean(paiementClient.error))
  for (const e of ech) exiger(await c.delta.rpc('marquer_echeance_payee', { p_echeance: e.id, p_date: jour(0), p_mode: 'virement', p_reference: `VIR-${e.id.slice(0, 6)}` }), 'Paiement')
  const { data: s1 } = await service.from('commandes').select('statut').eq('id', c1).single()
  verifier('Toutes les échéances payées : commande soldée', s1.statut === 'soldee', s1.statut)

  // --- Réception tacite (C2) -------------------------------------------------
  const { data: ligne2 } = await c.niayes.from('lignes_commande').select('id').eq('commande_id', c2).single()
  const bl2 = exiger(await c.niayes.rpc('emettre_bl', { p_commande: c2, p_lignes: [{ ligne_id: ligne2.id, quantite: 50 }], p_date: jour(0), p_transporteur: null, p_immatriculation: null, p_chauffeur: null, p_commentaire: null }), 'BL C2')
  await service.from('bons_reception').update({ date_limite: new Date(Date.now() - 60000).toISOString() }).eq('bl_id', bl2)
  exiger(await service.rpc('receptions_tacites'), 'Réceptions tacites')
  const { data: br2 } = await service.from('bons_reception').select('statut').eq('bl_id', bl2).single()
  verifier('Réception tacite après le délai', br2.statut === 'tacite')

  // --- Litige et arbitrage (C3 ou C4, celle qui a été validée) ---------------
  const validee = deuxValidations[0].error ? c4 : c3
  const { data: ligne3 } = await c.delta.from('lignes_commande').select('id, quantite').eq('commande_id', validee).single()
  const bl3 = exiger(await c.delta.rpc('emettre_bl', { p_commande: validee, p_lignes: [{ ligne_id: ligne3.id, quantite: Number(ligne3.quantite) }], p_date: jour(0), p_transporteur: null, p_immatriculation: null, p_chauffeur: null, p_commentaire: null }), 'BL litige')
  const { data: br3 } = await c.client.from('bons_reception').select('id').eq('bl_id', bl3).single()
  exiger(await c.client.rpc('contester_reception', { p_br: br3.id, p_motif: 'Recette : humidité excessive constatée sur une partie des sacs' }), 'Contestation')
  const { data: blL3 } = await c.superviseur.from('bl_lignes').select('id').eq('bl_id', bl3).single()
  exiger(await c.superviseur.rpc('arbitrer_litige', { p_br: br3.id, p_lignes: [{ bl_ligne_id: blL3.id, quantite_recue: Number(ligne3.quantite) - 10, motif: 'Arbitrage recette' }], p_commentaire: 'Recette : 10 sacs refusés' }), 'Arbitrage')
  const { data: br3apres } = await service.from('bons_reception').select('statut').eq('id', br3.id).single()
  verifier('Litige arbitré par le superviseur', br3apres.statut === 'arbitre')

  // --- Traçabilité -----------------------------------------------------------
  const { data: doc } = await service.from('documents').select('jeton_public').eq('type', 'commande').eq('document_id', c1).single()
  const verif = exiger(await anonyme.rpc('verifier_document', { p_jeton: doc.jeton_public }), 'Vérification publique')
  verifier('QR : document authentique pour un visiteur, sans montant', verif.trouve && verif.conforme && !verif.detail)
  const verifPartie = exiger(await c.client.rpc('verifier_document', { p_jeton: doc.jeton_public }), 'Vérification client')
  verifier('QR : montant visible pour le client de la commande', Number(verifPartie.detail?.montant) === 1750000)

  const { count: notifs } = await service.from('notifications').select('id', { count: 'exact', head: true }).in('email', Object.values(UTILISATEURS).map((u) => u.email))
  verifier('Notifications créées à chaque étape', (notifs ?? 0) > 10, `${notifs}`)

  // --- Bilan -----------------------------------------------------------------
  const echecs = resultats.filter((r) => !r.ok).length
  console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications réussies.`)
  console.log(`Comptes de démonstration (mot de passe : ${MOT_DE_PASSE}) :`)
  for (const u of Object.values(UTILISATEURS)) console.log(`  ${u.role.padEnd(12)} ${u.email}`)
  process.exitCode = echecs ? 1 : 0
}

principal().catch((erreur) => {
  console.error(`\n✗ Recette interrompue : ${erreur.message}`)
  process.exitCode = 1
})
