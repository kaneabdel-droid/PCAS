import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Montant en francs CFA : entier, séparateur de milliers, suffixe « FCFA ». */
export function formatMontant(valeur: number | string | null | undefined) {
  return `${formatMontantExport(valeur)} FCFA`
}

/** Date au format français (27/09/2026), identique dans tous les navigateurs, Safari compris. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR')
}

/**
 * Montant pour un export ou un PDF : séparateur de milliers par une espace normale, jamais l'espace insécable que produit
 * `toLocaleString` — jsPDF (police Helvetica standard) ne sait pas l'afficher.
 */
export function formatMontantExport(valeur: number | string | null | undefined): string {
  const n = Math.round(Number(valeur ?? 0))
  const signe = n < 0 ? '-' : ''
  return signe + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Date (AAAA-MM-JJ) dans `jours` jours à partir d'aujourd'hui. */
export function dateDans(jours: number) {
  return new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10)
}

/** Horodatage ISO d'il y a `heures` heures. */
export function ilYa(heures: number) {
  return new Date(Date.now() - heures * 3600000).toISOString()
}
