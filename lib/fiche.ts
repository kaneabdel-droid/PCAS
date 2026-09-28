// Lecture et validation des champs de la fiche entreprise (création par l'administrateur et modification).
import { requis, texte } from '@/lib/formulaire'
import { FORMES_JURIDIQUES, REGIONS, TYPES_IDENTIFIANT } from '@/lib/referentiels'

/** Champs de la fiche communs à la création (administrateur) et à la modification. */
export function lireFiche(fd: FormData): { valeurs: Record<string, string | null> } | { error: string } {
  const denomination = requis(fd, 'denomination')
  if (denomination.length < 2) return { error: 'La dénomination est obligatoire.' }
  const region = texte(fd, 'region')
  if (region && !(REGIONS as readonly string[]).includes(region)) return { error: 'Région inconnue.' }
  const forme = texte(fd, 'forme_juridique')
  if (forme && !FORMES_JURIDIQUES.includes(forme)) return { error: 'Forme juridique inconnue.' }
  const typeIdentifiant = requis(fd, 'type_identifiant') || 'NINEA'
  if (!TYPES_IDENTIFIANT.includes(typeIdentifiant)) return { error: 'Type d’identifiant inconnu.' }
  const email = texte(fd, 'email')
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse email invalide.' }
  return {
    valeurs: {
      denomination,
      sigle: texte(fd, 'sigle'),
      forme_juridique: forme,
      adresse: texte(fd, 'adresse'),
      region,
      departement: texte(fd, 'departement'),
      commune: texte(fd, 'commune'),
      telephone: texte(fd, 'telephone'),
      email,
      site_web: texte(fd, 'site_web'),
      type_identifiant: typeIdentifiant,
      identifiant_fiscal: texte(fd, 'identifiant_fiscal'),
      rccm: texte(fd, 'rccm'),
      representant_legal: texte(fd, 'representant_legal'),
    },
  }
}

