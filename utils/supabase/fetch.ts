/**
 * fetch des clients Supabase côté serveur : délai maximal et une nouvelle tentative sur les échecs réseau des lectures.
 * Sans cela, une requête qui ne répond pas laisse la page charger indéfiniment ; avec un délai, elle échoue vite (ou est
 * retentée) au lieu de bloquer l'utilisateur. Les écritures ne sont jamais rejouées automatiquement (risque de doublon).
 */
const DELAI_MS = 15_000

export const fetchAvecDelai: typeof fetch = async (entree, init) => {
  const methode = (init?.method ?? (entree instanceof Request ? entree.method : 'GET')).toUpperCase()
  const lecture = methode === 'GET' || methode === 'HEAD'
  const essai = () => {
    const delai = AbortSignal.timeout(DELAI_MS)
    const signal = init?.signal ? AbortSignal.any([init.signal, delai]) : delai
    return fetch(entree, { ...init, signal })
  }
  try {
    return await essai()
  } catch (erreur) {
    if (!lecture || init?.signal?.aborted) throw erreur
    return await essai()
  }
}
