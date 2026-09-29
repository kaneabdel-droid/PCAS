// Sauvegarde logique de PCAS : toutes les tables du schéma public et la liste des comptes, en JSON.
//
//   npm run sauvegarde            → sauvegardes/AAAA-MM-JJ_HHMMSS/<table>.json (dossier ignoré par Git)
//
// Complément, pas remplacement, des sauvegardes de Supabase : l'offre gratuite n'en a pas de restaurable ; avec l'offre
// Pro (sauvegarde quotidienne, Point-in-Time Recovery en option) ce script sert d'archive hors Supabase. Les fichiers
// contiennent des données personnelles et financières : à conserver chiffrés, hors du poste de travail si possible.
// Les fichiers du Storage (logos, photos) ne sont pas copiés : ils se retéléchargent depuis leurs URL publiques.
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SUPABASE || !CLE_SERVICE) {
  console.error('Variables Supabase manquantes dans .env.local')
  process.exit(1)
}
const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

// Ordre des dépendances (utile pour une restauration table par table).
const TABLES = [
  'parametres_plateforme', 'produits', 'transformations', 'profils', 'entreprises', 'utilisateurs', 'entreprise_comptes_bancaires',
  'modeles_contrat', 'acceptations_contrat', 'demandes_acces', 'sites_production', 'capacites_production', 'stocks',
  'mouvements_stock', 'offres', 'declarations_production', 'paniers', 'besoins_achat', 'propositions_besoin',
  'sequences_numerotation', 'commandes', 'lignes_commande', 'echeancier_commande', 'commande_evenements', 'bons_paiement',
  'bons_livraison', 'bl_lignes', 'bons_reception', 'br_lignes', 'factures', 'lignes_facture',
  'factures_definitives_provisoires', 'echeances', 'documents', 'notifications', 'appareils', 'journal_audit',
]

async function tout(table) {
  let lignes = []
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await service.from(table).select('*').range(debut, debut + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    lignes = lignes.concat(data)
    if (data.length < 1000) return lignes
  }
}

const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
const dossier = new URL(`../sauvegardes/${horodatage}/`, import.meta.url)
mkdirSync(dossier, { recursive: true })

let total = 0
for (const table of TABLES) {
  const lignes = await tout(table)
  writeFileSync(new URL(`${table}.json`, dossier), JSON.stringify(lignes))
  total += lignes.length
  console.log(`  ${table.padEnd(34)} ${lignes.length}`)
}
const comptes = []
for (let page = 1; ; page++) {
  const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw new Error(`comptes : ${error.message}`)
  comptes.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at })))
  if (data.users.length < 1000) break
}
writeFileSync(new URL('comptes_auth.json', dossier), JSON.stringify(comptes))
console.log(`\nSauvegarde terminée : ${TABLES.length} tables, ${total} lignes, ${comptes.length} comptes → sauvegardes/${horodatage}/`)
