// Lecture des champs d'un FormData dans les actions serveur.

export type Resultat = { error?: string; success?: string }

/** Texte nettoyé, ou null s'il est vide. */
export function texte(fd: FormData, cle: string): string | null {
  const v = String(fd.get(cle) ?? '').trim()
  return v === '' ? null : v
}

/** Texte obligatoire : chaîne vide si absent (à contrôler par l'appelant). */
export function requis(fd: FormData, cle: string): string {
  return String(fd.get(cle) ?? '').trim()
}

/** Nombre (virgule ou point décimal accepté), ou null si vide ou invalide. */
export function nombre(fd: FormData, cle: string): number | null {
  const brut = String(fd.get(cle) ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (brut === '') return null
  const n = Number(brut)
  return Number.isFinite(n) ? n : null
}

export function coche(fd: FormData, cle: string): boolean {
  const v = fd.get(cle)
  return v === 'on' || v === 'true' || v === '1'
}

/** Traduit les erreurs techniques les plus courantes en message compréhensible. */
export function messageErreur(erreur: { message: string; code?: string } | null | undefined, defaut: string): string {
  if (!erreur) return defaut
  if (erreur.code === '23505') return 'Cet élément existe déjà (doublon).'
  if (erreur.code === '23503') return 'Opération impossible : cet élément est utilisé ailleurs.'
  if (erreur.code === '42501' || /row-level security/i.test(erreur.message)) return 'Vous n’avez pas les droits pour cette opération.'
  // Les messages levés par nos fonctions et triggers PostgreSQL (raise exception) sont déjà rédigés pour l'utilisateur.
  if (erreur.code === 'P0001') return erreur.message
  return defaut
}
