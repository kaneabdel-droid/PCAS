'use server'

import { createClient } from '@/utils/supabase/server'
import { requis, texte, type Resultat } from '@/lib/formulaire'
import { LIBELLES_TYPES_ENTREPRISE } from '@/lib/roles'
import { REGIONS } from '@/lib/referentiels'

/** Dépôt d'une demande d'accès depuis la page publique (sans compte). */
export async function deposerDemande(fd: FormData): Promise<Resultat> {
  // Champ piège invisible pour les humains : un robot qui le remplit reçoit une réponse normale, sans enregistrement.
  if (texte(fd, 'site_internet')) return { success: 'Merci, votre demande a bien été envoyée.' }

  const type = requis(fd, 'type_entreprise')
  const denomination = requis(fd, 'denomination')
  const contact = requis(fd, 'contact_nom')
  const telephone = requis(fd, 'telephone')
  const email = requis(fd, 'email').toLowerCase()
  const region = texte(fd, 'region')
  if (!(type in LIBELLES_TYPES_ENTREPRISE)) return { error: 'Indiquez si vous êtes producteur, client ou banque.' }
  if (denomination.length < 2 || contact.length < 2) return { error: 'La dénomination et le nom du contact sont obligatoires.' }
  if (telephone.length < 6) return { error: 'Numéro de téléphone invalide.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Adresse email invalide.' }
  if (region && !(REGIONS as readonly string[]).includes(region)) return { error: 'Région inconnue.' }

  const supabase = await createClient()
  const { error } = await supabase.from('demandes_acces').insert({
    type_entreprise: type,
    denomination: denomination.slice(0, 200),
    contact_nom: contact.slice(0, 120),
    telephone: telephone.slice(0, 30),
    email: email.slice(0, 200),
    region,
    message: texte(fd, 'message')?.slice(0, 2000) ?? null,
  })
  if (error) return { error: 'Envoi impossible pour le moment. Réessayez plus tard.' }
  return { success: 'Merci, votre demande a bien été envoyée. L’équipe PCAS vous contactera pour ouvrir votre compte.' }
}
