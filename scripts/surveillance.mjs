// Surveillance UptimeRobot de PCAS (API v3) : crée la sonde si elle n'existe pas, sinon affiche son état.
//
//   npm run surveillance
//
// Prérequis : UPTIMEROBOT_API_KEY dans .env.local (Integrations & API › « Main API key »). L'API v3 accepte la
// création de sondes avec l'offre gratuite (l'ancienne API v2 la refuse : « not allowed to use some settings »).
//
// Sonde : /api/sante en HTTP(s), toutes les 5 minutes. Elle répond 503 dès que la base est injoignable, et seules les
// réponses 2xx comptent comme « en ligne » (sans suivre les redirections) : une panne du site (Vercel), de la base
// (Supabase) ou une redirection inattendue vers /login déclenchent toutes une alerte vers les contacts du compte.
const CLE = process.env.UPTIMEROBOT_API_KEY
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pcas.dembasolution.com').replace(/\/$/, '')
if (!CLE) {
  console.error('UPTIMEROBOT_API_KEY manquant dans .env.local (UptimeRobot › Integrations & API › Main API key).')
  process.exit(1)
}

async function api(chemin, options = {}) {
  const reponse = await fetch(`https://api.uptimerobot.com/v3/${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' },
  })
  const corps = await reponse.json().catch(() => null)
  if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status} ${JSON.stringify(corps)}`)
  return corps
}

const SONDE = {
  type: 'HTTP',
  friendlyName: 'PCAS — santé (site + base)',
  url: `${SITE}/api/sante`,
  interval: 300,
  timeout: 30,
  gracePeriod: 30,
  followRedirections: false,
  successHttpResponseCodes: ['2xx'],
  httpMethodType: 'GET',
}

const contacts = await api('user/alert-contacts')
const { data: sondes = [] } = await api('monitors')
const existante = sondes.find((m) => m.url === SONDE.url)
if (existante) {
  const alertes = existante.assignedAlertContacts.map((a) => contacts.find((c) => c.id === a.alertContactId)?.value ?? a.alertContactId)
  console.log(`= ${existante.friendlyName} : ${existante.status}, toutes les ${existante.interval / 60} min, alertes → ${alertes.join(', ') || 'AUCUNE'}`)
} else {
  const creee = await api('monitors', {
    method: 'POST',
    body: JSON.stringify({ ...SONDE, assignedAlertContacts: contacts.map((c) => ({ alertContactId: c.id, threshold: 0, recurrence: 0 })) }),
  })
  console.log(`+ ${creee.friendlyName} : créée (n° ${creee.id}), alertes → ${contacts.map((c) => c.value).join(', ') || 'AUCUNE'}`)
}
