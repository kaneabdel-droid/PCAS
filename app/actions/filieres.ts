'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { COOKIE_FILIERE, estFiliereFiltre, type FiliereFiltre } from '@/lib/filieres'

export async function changerFiliereActive(filiere: FiliereFiltre) {
  if (!estFiliereFiltre(filiere)) return

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
