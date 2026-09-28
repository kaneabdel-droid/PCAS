// Montants en toutes lettres (orthographe traditionnelle), pour les factures et bons : « cent vingt-cinq mille francs CFA ».

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
]
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

/** 0 à 99. `final` : le nombre termine l'expression (accord de « quatre-vingts »). */
function deuxChiffres(n: number, final: boolean): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  let u = n % 10
  if (d === 7 || d === 9) u += 10 // soixante-dix…, quatre-vingt-dix…
  const base = DIZAINES[d]
  if (u === 0) return d === 8 && final ? 'quatre-vingts' : base
  if ((u === 1 || u === 11) && d !== 8 && d !== 9) return `${base} et ${UNITES[u]}`
  return `${base}-${UNITES[u]}`
}

/** 0 à 999. */
function troisChiffres(n: number, final: boolean): string {
  const c = Math.floor(n / 100)
  const reste = n % 100
  if (c === 0) return deuxChiffres(reste, final)
  const centaine = c === 1 ? 'cent' : `${UNITES[c]} cent${reste === 0 && final ? 's' : ''}`
  return reste === 0 ? centaine : `${centaine} ${deuxChiffres(reste, final)}`
}

export function nombreEnLettres(valeur: number): string {
  let n = Math.floor(Math.abs(valeur))
  if (n === 0) return 'zéro'
  const parties: string[] = []
  const echelles: [number, string, string][] = [
    [1_000_000_000, 'milliard', 'milliards'],
    [1_000_000, 'million', 'millions'],
  ]
  for (const [taille, singulier, pluriel] of echelles) {
    const q = Math.floor(n / taille)
    if (q > 0) {
      // Devant un nom (million, milliard), « cents » et « quatre-vingts » s'accordent.
      parties.push(`${troisChiffres(q, true)} ${q > 1 ? pluriel : singulier}`)
      n %= taille
    }
  }
  const milliers = Math.floor(n / 1000)
  if (milliers > 0) {
    // « mille » est invariable et ne fait pas accorder ce qui le précède.
    parties.push(milliers === 1 ? 'mille' : `${troisChiffres(milliers, false)} mille`)
    n %= 1000
  }
  if (n > 0) parties.push(troisChiffres(n, true))
  return (valeur < 0 ? 'moins ' : '') + parties.join(' ')
}

/** « Cent vingt-cinq mille francs CFA » */
export function montantEnLettres(montant: number): string {
  const n = Math.abs(Math.round(montant))
  // « deux millions de francs », mais « deux millions cent francs »
  const de = n >= 1_000_000 && n % 1_000_000 === 0 ? ' de' : ''
  const texte = `${nombreEnLettres(Math.round(montant))}${de} franc${n > 1 ? 's' : ''} CFA`
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}
