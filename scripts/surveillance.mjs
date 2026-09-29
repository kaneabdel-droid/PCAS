// Surveillance UptimeRobot de PCAS (API v2) : crée les sondes si elles n'existent pas, sans doublon si on relance.
//
//   npm run surveillance
//
// Prérequis : compte UptimeRobot (offre gratuite suffisante : 50 sondes, contrôle toutes les 5 minutes) et
// UPTIMEROBOT_API_KEY dans .env.local (Integrations & API › API › « Main API key »). Les alertes partent vers tous les
// contacts d'alerte du compte (l'email d'inscription par défaut).
//
// Sondes :
//   1. /api/sante contient "statut":"ok" : site ET base de données joignables (une panne Supabase est détectée) ;
//   2. /login répond : le site est servi (distingue une panne Vercel d'une panne de la base).
const CLE = process.env.UPTIMEROBOT_API_KEY
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pcas.dembasolution.com').replace(/\/$/, '')
if (!CLE) {
  console.error('UPTIMEROBOT_API_KEY manquant dans .env.local (UptimeRobot › Integrations & API › Main API key).')
  process.exit(1)
}

async function api(methode, parametres = {}) {
  const reponse = await fetch(`https://api.uptimerobot.com/v2/${methode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({ api_key: CLE, format: 'json', ...parametres }),
  })
  const corps = await reponse.json()
  if (corps.stat !== 'ok') throw new Error(`${methode} : ${JSON.stringify(corps.error ?? corps)}`)
  return corps
}

const { alert_contacts: contacts = [] } = await api('getAlertContacts')
const alertes = contacts.map((c) => `${c.id}_0_0`).join('-')
console.log(`Contacts d'alerte : ${contacts.map((c) => c.value).join(', ') || 'aucun (ajoutez-en un dans UptimeRobot)'}`)

const { monitors: existantes = [] } = await api('getMonitors', { search: new URL(SITE).hostname })
const SONDES = [
  { friendly_name: 'PCAS — santé (site + base)', url: `${SITE}/api/sante`, type: '2', keyword_type: '2', keyword_case_type: '0', keyword_value: '"statut":"ok"' },
  { friendly_name: 'PCAS — site', url: `${SITE}/login`, type: '1' },
]
for (const sonde of SONDES) {
  const deja = existantes.find((m) => m.url === sonde.url)
  if (deja) {
    console.log(`= ${sonde.friendly_name} : existe déjà (${deja.status === 2 ? 'en ligne' : `statut ${deja.status}`})`)
    continue
  }
  await api('newMonitor', { ...sonde, interval: '300', timeout: '30', ...(alertes ? { alert_contacts: alertes } : {}) })
  console.log(`+ ${sonde.friendly_name} : créée (contrôle toutes les 5 minutes)`)
}
