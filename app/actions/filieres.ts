'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { COOKIE_FILIERE, estFiliereFiltre, type FiliereCode, type FiliereFiltre } from '@/lib/filieres'
import { getContexte } from '@/lib/session'

export async function changerFiliereActive(filiere: FiliereFiltre) {
  if (!estFiliereFiltre(filiere)) return

  // Sécurité et verrouillage : si l'entreprise est restreinte à certaines filières,
  // l'utilisateur ne peut jamais basculer vers une filière tierce ou la vue globale transversale.
  const ctx = await getContexte()
  if (ctx.entrepriseFilieres && ctx.entrepriseFilieres.length > 0) {
    if (filiere === 'toutes' || !ctx.entrepriseFilieres.includes(filiere as FiliereCode)) {
      return
    }
  }

  const cookieStore = await cookies()
  if (filiere === 'toutes') {
    cookieStore.delete(COOKIE_FILIERE)
  } else {
    cookieStore.set(COOKIE_FILIERE, filiere, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 an
      sameSite: 'lax',
    })
  }

  revalidatePath('/')
  revalidatePath('/marche')
  revalidatePath('/commandes')
  revalidatePath('/offres')
  revalidatePath('/supervision/approbations')
  revalidatePath('/supervision/capacites')
  revalidatePath('/supervision/litiges')
  revalidatePath('/admin/produits')
}
