// Surveillance UptimeRobot de PCAS (API v2) : vérifie les sondes et les crée si l'offre du compte le permet.
//
//   npm run surveillance
//
// Prérequis : UPTIMEROBOT_API_KEY dans .env.local (Integrations & API › « Main API key »).
//
// Sonde essentielle : /api/sante en HTTP(s). Elle répond 503 dès que la base est injoignable : une sonde HTTP simple
// détecte donc aussi bien une panne du site (Vercel) qu'une panne de la base (Supabase). Contrôle toutes les 5 minutes,
// alerte vers les contacts du compte (l'email d'inscription par défaut).
//
// L'offre gratuite d'UptimeRobot refuse la création de sondes par l'API (« not allowed to use some settings with your
// current plan ») : le script indique alors comment la créer à la main (2 minutes), puis la vérifie au passage suivant.
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
  return reponse.json()
}

const STATUTS = { 0: 'en pause', 1: 'pas encore contrôlée', 2: 'en ligne', 8: 'semble en panne', 9: 'EN PANNE' }
const SONDES = [
  { friendly_name: 'PCAS — santé (site + base)', url: `${SITE}/api/sante`, type: '1' },
  { friendly_name: 'PCAS — site', url: `${SITE}/login`, type: '1' },
]

const { alert_contacts: contacts = [] } = await api('getAlertContacts')
const { monitors: existantes = [] } = await api('getMonitors', { alert_contacts: '1' })
let manquantes = 0
for (const sonde of SONDES) {
  const deja = existantes.find((m) => m.url === sonde.url)
  if (deja) {
    const alertes = (deja.alert_contacts ?? []).map((c) => c.value).join(', ') || 'AUCUN contact d’alerte'
    console.log(`= ${sonde.friendly_name} : ${STATUTS[deja.status] ?? deja.status}, toutes les ${deja.interval / 60} min, alertes → ${alertes}`)
    continue
  }
  const r = await api('newMonitor', { ...sonde, interval: '300', ...(contacts.length ? { alert_contacts: contacts.map((c) => `${c.id}_0_0`).join('-') } : {}) })
  if (r.stat === 'ok') {
    console.log(`+ ${sonde.friendly_name} : créée (toutes les 5 minutes)`)
  } else {
    manquantes++
    console.log(`✗ ${sonde.friendly_name} : création refusée par l'API (${r.error?.message ?? 'erreur'})`)
  }
  await new Promise((attente) => setTimeout(attente, 11000)) // limite de débit de l'API gratuite
}

if (manquantes) {
  console.log(`
À créer dans le tableau de bord UptimeRobot (+ New Monitor), pour chaque sonde manquante :
  Monitor Type : HTTP(s) · URL : ${SONDES[0].url} (puis ${SONDES[1].url}) · Monitoring interval : 5 minutes
  How will we notify you? : ${contacts.map((c) => c.value).join(', ') || 'votre email'} · Create Monitor
Puis relancez npm run surveillance pour vérifier.`)
  process.exitCode = 1
}
