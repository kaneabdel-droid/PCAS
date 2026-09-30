// Mesure Lighthouse mobile des pages publiques de PCAS, exécutée par Google (API PageSpeed Insights) : le résultat ne
// dépend pas de la connexion du poste qui lance le script.
//
//   npm run lighthouse                      → /login et /decouvrir-pcas
//   npm run lighthouse -- /guide /verifier  → pages choisies
//
// Clé gratuite obligatoire (le quota sans clé est partagé et épuisé en permanence) : console.cloud.google.com ›
// API et services › activer « PageSpeed Insights API » › Identifiants › Créer une clé API → PAGESPEED_API_KEY dans .env.local.
// Les pages connectées se mesurent dans Chrome › DevTools › Lighthouse › Mobile, connecté avec un compte de démonstration.
const CLE = process.env.PAGESPEED_API_KEY
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pcas.dembasolution.com').replace(/\/$/, '')
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/login', '/decouvrir-pcas']
if (!CLE) {
  console.error('PAGESPEED_API_KEY manquant dans .env.local (voir l’en-tête du script).')
  process.exit(1)
}

let echec = false
for (const page of pages) {
  const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  url.searchParams.set('url', SITE + page)
  url.searchParams.set('strategy', 'mobile')
  url.searchParams.set('key', CLE)
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) url.searchParams.append('category', c)
  const r = await (await fetch(url, { signal: AbortSignal.timeout(180_000) })).json()
  if (r.error) {
    console.log(`${page} : erreur ${r.error.message}`)
    echec = true
    continue
  }
  const { categories: c, audits: a } = r.lighthouseResult
  const notes = Object.values(c).map((v) => `${v.title} ${Math.round(v.score * 100)}`)
  console.log(`\n${page} — ${notes.join(' · ')}`)
  console.log(`  FCP ${a['first-contentful-paint'].displayValue} · LCP ${a['largest-contentful-paint'].displayValue} · TBT ${a['total-blocking-time'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · poids ${a['total-byte-weight'].displayValue}`)
  for (const [cle, audit] of Object.entries(a)) {
    if (audit.score !== null && audit.score < 0.9 && !['informative', 'notApplicable', 'manual'].includes(audit.scoreDisplayMode)) {
      console.log(`  ✗ ${audit.title}${audit.displayValue ? ` (${audit.displayValue})` : ''} [${cle}]`)
    }
  }
  if (Object.values(c).some((v) => v.score < 0.9)) echec = true
}
process.exitCode = echec ? 1 : 0
