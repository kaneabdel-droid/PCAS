'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { refusDroit } from '@/lib/droits'
import { messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { MOTIFS_SAISIE, type Nature } from '@/lib/stocks'

const HREF: Record<Nature, string> = { matiere_premiere: '/stocks/matieres', produit_fini: '/stocks/produits' }

function rafraichir() {
  revalidatePath('/stocks/matieres')
  revalidatePath('/stocks/produits')
  revalidatePath('/offres')
}

async function natureProduit(produitId: string): Promise<Nature | null> {
  const supabase = await createClient()
  const { data } = await supabase.from('produits').select('nature').eq('id', produitId).maybeSingle()
  return (data?.nature as Nature | undefined) ?? null
}

/** Entrée ou sortie manuelle de stock (récolte, achat, production, perte, don…). */
export async function enregistrerMouvement(fd: FormData): Promise<Resultat> {
  const type = requis(fd, 'type')
  if (type !== 'entree' && type !== 'sortie') return { error: 'Type de mouvement inconnu.' }
  const produitId = requis(fd, 'produit_id')
  const nature = await natureProduit(produitId)
  if (!nature) return { error: 'Choisissez un produit.' }
  const refus = await refusDroit(HREF[nature], ['producteur'])
  if (refus) return { error: refus }

  const motif = requis(fd, 'motif')
  if (!(MOTIFS_SAISIE[type][nature] as readonly string[]).includes(motif)) return { error: 'Motif inconnu.' }
  const quantite = nombre(fd, 'quantite')
  if (!quantite || quantite <= 0) return { error: 'La quantité doit être supérieure à zéro.' }
  const date = texte(fd, 'date_mouvement')
  if (date && date > new Date().toISOString().slice(0, 10)) return { error: 'La date ne peut pas être dans le futur.' }

  const supabase = await createClient()
  const { error } = await supabase.from('mouvements_stock').insert({
    site_id: requis(fd, 'site_id'),
    produit_id: produitId,
    type,
    motif,
    quantite,
    date_mouvement: date ?? undefined,
    commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  rafraichir()
  return { success: type === 'entree' ? 'Entrée enregistrée.' : 'Sortie enregistrée.' }
}

/** Inventaire : la quantité comptée devient le stock physique (l'écart est tracé). */
export async function enregistrerInventaire(fd: FormData): Promise<Resultat> {
  const produitId = requis(fd, 'produit_id')
  const nature = await natureProduit(produitId)
  if (!nature) return { error: 'Choisissez un produit.' }
  const refus = await refusDroit(HREF[nature], ['producteur'], 'modifier')
  if (refus) return { error: refus }
  const comptee = nombre(fd, 'quantite_comptee')
  if (comptee === null || comptee < 0) return { error: 'Indiquez la quantité comptée (zéro ou plus).' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('inventorier', {
    p_site: requis(fd, 'site_id'),
    p_produit: produitId,
    p_quantite_comptee: comptee,
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Inventaire impossible.') }
  rafraichir()
  const ecart = Number(data ?? 0)
  return {
    success:
      ecart === 0
        ? 'Inventaire conforme : aucun écart.'
        : `Inventaire enregistré : écart de ${ecart > 0 ? '+' : ''}${ecart.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}.`,
  }
}

/** Transformation de matière première en produit fini (sortie et entrée dans la même opération). */
export async function enregistrerTransformation(fd: FormData): Promise<Resultat> {
  const refus = await refusDroit('/stocks/matieres', ['producteur'])
  if (refus) return { error: refus }
  const quantiteMatiere = nombre(fd, 'quantite_matiere')
  const quantiteProduit = nombre(fd, 'quantite_produit')
  if (!quantiteMatiere || quantiteMatiere <= 0 || !quantiteProduit || quantiteProduit <= 0) {
    return { error: 'Indiquez la quantité transformée et la quantité obtenue.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('transformer', {
    p_site: requis(fd, 'site_id'),
    p_matiere: requis(fd, 'matiere_id'),
    p_quantite_matiere: quantiteMatiere,
    p_produit: requis(fd, 'produit_id'),
    p_quantite_produit: quantiteProduit,
    p_date: texte(fd, 'date_mouvement'),
    p_commentaire: texte(fd, 'commentaire'),
  })
  if (error) return { error: messageErreur(error, 'Transformation impossible.') }
  rafraichir()
  return { success: 'Transformation enregistrée : stock de matière première et de produit fini mis à jour.' }
}
