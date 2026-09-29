// Audit de sécurité automatisé de PCAS, vu d'un visiteur non connecté (clé publique seulement).
//
//   npm run audit:securite
//
// 1. Lecture anonyme de chaque table du schéma public : 0 ligne attendue.
// 2. Appel anonyme de chaque fonction de la base : refus attendu (sauf verifier_document, prévue pour le QR public,
//    qui ne renvoie rien sans jeton valide).
// 3. En-têtes HTTP de sécurité du site en production.
// Complète supabase/audit/verifications.sql (à exécuter dans l'éditeur SQL) et npm run verifier-espaces.
import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync } from 'node:fs'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SITE = process.env.AUDIT_SITE ?? 'https://pcas.dembasolution.com'
if (!URL_SUPABASE || !CLE_ANON) {
  console.error('Variables Supabase manquantes dans .env.local')
  process.exit(1)
}
const anonyme = createClient(URL_SUPABASE, CLE_ANON, { auth: { persistSession: false, autoRefreshToken: false } })

const resultats = []
function verifier(libelle, condition, detail = '') {
  resultats.push(Boolean(condition))
  if (!condition) console.log(`✗ ${libelle}${detail ? ` — ${detail}` : ''}`)
}

// Tables et fonctions déclarées dans les migrations (dernière définition de chaque fonction).
const dossier = new URL('../supabase/migrations/', import.meta.url)
const sql = readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(new URL(f, dossier), 'utf8')).join('\n')
const tables = [...new Set([...sql.matchAll(/^create table public\.(\w+)/gm)].map((m) => m[1]))]
const fonctions = new Map()
for (const m of sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)\s*returns (\w+)/g)) fonctions.set(m[1], { params: m[2], retour: m[3] })

// 1. Tables
for (const table of tables) {
  const { data, error } = await anonyme.from(table).select('*').limit(1)
  verifier(`Lecture anonyme de ${table}`, error || (data ?? []).length === 0, `${(data ?? []).length} ligne(s) lisible(s)`)
}
console.log(`Tables : ${tables.length} testées`)

// 2. Fonctions (les fonctions de déclencheur ne sont pas appelables par l'API)
const PUBLIQUES = new Set(['verifier_document'])
const valeur = (type) => (type.includes('uuid') ? '00000000-0000-0000-0000-000000000000' : type.includes('jsonb') ? [] : type.includes('date') ? '2026-01-01' : type.includes('int') || type.includes('numeric') ? 1 : type.includes('bool') ? false : type.includes('[]') ? [] : 'x')
let appelees = 0
for (const [nom, { params, retour }] of fonctions) {
  if (retour === 'trigger') continue
  const args = {}
  for (const p of params.split(',').map((x) => x.trim()).filter(Boolean)) {
    const [nomParam, ...type] = p.replace(/ default .*/, '').split(/\s+/)
    args[nomParam] = valeur(type.join(' '))
  }
  const { data, error } = await anonyme.rpc(nom, args)
  appelees++
  if (PUBLIQUES.has(nom)) {
    verifier(`${nom} : rien sans jeton valide`, error || data?.trouve === false, JSON.stringify(data))
  } else {
    const sansEffet = Boolean(error) || data === null || data === false || (Array.isArray(data) && data.length === 0) || data === 0
    verifier(`Appel anonyme de ${nom} refusé ou sans effet`, sansEffet, JSON.stringify(data)?.slice(0, 120))
  }
}
console.log(`Fonctions : ${appelees} appelées`)

// 3. En-têtes HTTP
const reponse = await fetch(`${SITE}/login`)
for (const entete of ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
  verifier(`En-tête ${entete}`, reponse.headers.get(entete), 'absent')
}
verifier('En-tête x-powered-by masqué', !reponse.headers.get('x-powered-by'))
const cron = await fetch(`${SITE}/api/cron/circuit`)
verifier('Tâche planifiée refusée sans secret', cron.status === 401, `statut ${cron.status}`)
const confirmation = await fetch(`${SITE}/auth/confirm?next=/%5Cexemple.com`, { redirect: 'manual' })
verifier('Pas de redirection ouverte', !(confirmation.headers.get('location') ?? '').includes('exemple.com'), confirmation.headers.get('location'))

const echecs = resultats.filter((r) => !r).length
console.log(`\n${resultats.length - echecs}/${resultats.length} contrôles réussis.`)
process.exitCode = echecs ? 1 : 0
