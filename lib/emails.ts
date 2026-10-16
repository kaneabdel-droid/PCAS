import type { SupabaseClient } from '@supabase/supabase-js'

// Envoi par email des notifications (tâche planifiée), via l'API de Resend.
// Variables : RESEND_API_KEY et EMAIL_EXPEDITEUR (ex. « PCAS <notifications@dembasolution.com> », domaine vérifié chez Resend).
// Sans clé configurée, rien n'est envoyé : les notifications restent visibles dans l'application.

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function gabarit(titre: string, message: string | null, lien: string | null, libelleBouton = 'Ouvrir dans PCAS') {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  const lienComplet = lien ? (/^https?:\/\//i.test(lien) ? lien : `${site}${lien}`) : null
  const bouton = lienComplet
    ? `<p style="margin:24px 0"><a href="${echapper(lienComplet)}" style="background:#2E6E3E;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${echapper(libelleBouton)}</a></p>`
    : ''
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F3F2EC;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#13201A">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:700;color:#2E6E3E;font-size:18px;margin:0 0 16px">PCAS</p>
<div style="background:#fff;border:1px solid #E1DDD1;border-radius:12px;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${echapper(titre)}</h1>
${message ? `<div style="margin:0;line-height:1.6;color:#2D3748;white-space:pre-line">${echapper(message)}</div>` : ''}
${bouton}
</div>
<p style="font-size:12px;color:#5A665F;margin-top:16px">Plateforme de Commercialisation Agricole du Sénégal — un produit DembaSolution. Message automatique, merci de ne pas y répondre.</p>
</div></body></html>`
}

/** Envoie un email d'invitation avec lien d'activation de compte via Resend. */
export async function envoyerEmailInvitation({
  email,
  nomComplet,
  roleLibelle,
  lienActivation,
}: {
  email: string
  nomComplet: string
  roleLibelle?: string
  lienActivation: string
}): Promise<{ ok: boolean; error?: string }> {
  const cle = process.env.RESEND_API_KEY
  const expediteur = process.env.EMAIL_EXPEDITEUR
  if (!cle || !expediteur) {
    return { ok: false, error: 'Service d’envoi d’emails non configuré (RESEND_API_KEY ou EMAIL_EXPEDITEUR manquant).' }
  }

  // Domaine réservé .test (comptes de démonstration / tests) : jamais envoyé
  if (email.toLowerCase().endsWith('.test')) {
    return { ok: true }
  }

  const titre = 'Bienvenue sur PCAS — Activation de votre compte'
  const message = `Bonjour ${nomComplet},\n\nUn compte d’accès vous a été créé sur la Plateforme de Commercialisation Agricole du Sénégal (PCAS)${roleLibelle ? ` avec le rôle de « ${roleLibelle} »` : ''}.\n\nPour activer votre compte et définir votre mot de passe, cliquez sur le bouton ci-dessous :`

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: expediteur,
        to: [email],
        subject: titre,
        html: gabarit(titre, message, lienActivation, 'Activer mon compte et définir mon mot de passe'),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!reponse.ok) {
      const err = await reponse.text()
      console.error('Erreur envoi email invitation Resend :', reponse.status, err)
      return { ok: false, error: `Erreur d’envoi d’email (${reponse.status})` }
    }
    return { ok: true }
  } catch (erreur) {
    console.error('Exception envoi email invitation :', erreur)
    return { ok: false, error: erreur instanceof Error ? erreur.message : 'Erreur réseau lors de l’envoi' }
  }
}

/** Envoie un email de réinitialisation du mot de passe via Resend. */
export async function envoyerEmailReinitialisation({
  email,
  nomComplet,
  lienReinitialisation,
}: {
  email: string
  nomComplet?: string
  lienReinitialisation: string
}): Promise<{ ok: boolean; error?: string }> {
  const cle = process.env.RESEND_API_KEY
  const expediteur = process.env.EMAIL_EXPEDITEUR
  if (!cle || !expediteur) {
    return { ok: false, error: 'Service d’envoi d’emails non configuré (RESEND_API_KEY ou EMAIL_EXPEDITEUR manquant).' }
  }

  if (email.toLowerCase().endsWith('.test')) {
    return { ok: true }
  }

  const titre = 'Réinitialisation de votre mot de passe PCAS'
  const message = `Bonjour${nomComplet ? ` ${nomComplet}` : ''},\n\nUne demande de réinitialisation de votre mot de passe a été effectuée sur la Plateforme de Commercialisation Agricole du Sénégal (PCAS).\n\nCliquez sur le bouton ci-dessous pour choisir votre nouveau mot de passe :`

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: expediteur,
        to: [email],
        subject: titre,
        html: gabarit(titre, message, lienReinitialisation, 'Définir un nouveau mot de passe'),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!reponse.ok) {
      const err = await reponse.text()
      console.error('Erreur envoi email réinitialisation Resend :', reponse.status, err)
      return { ok: false, error: `Erreur d’envoi d’email (${reponse.status})` }
    }
    return { ok: true }
  } catch (erreur) {
    console.error('Exception envoi email réinitialisation :', erreur)
    return { ok: false, error: erreur instanceof Error ? erreur.message : 'Erreur réseau lors de l’envoi' }
  }
}


/** Envoie les notifications pas encore envoyées (au plus `limite` par passage). Renvoie le nombre d'emails envoyés. */
export async function envoyerNotificationsParEmail(supabase: SupabaseClient, limite = 200) {
  const cle = process.env.RESEND_API_KEY
  const expediteur = process.env.EMAIL_EXPEDITEUR
  if (!cle || !expediteur) return 0

  const { data } = await supabase
    .from('notifications')
    .select('id, email, titre, message, lien')
    .is('email_envoye_le', null)
    .not('email', 'is', null)
    .order('created_at')
    .limit(limite)
  let envoyes = 0
  for (const n of data ?? []) {
    // Domaine réservé .test (comptes de démonstration) : jamais envoyé, pour ne pas nuire à la réputation du domaine d'envoi.
    if (n.email.toLowerCase().endsWith('.test')) {
      await supabase.from('notifications').update({ email_envoye_le: new Date().toISOString() }).eq('id', n.id)
      continue
    }
    try {
      const reponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: expediteur, to: [n.email], subject: n.titre, html: gabarit(n.titre, n.message, n.lien) }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!reponse.ok) {
        console.error('Envoi email impossible', n.id, reponse.status)
        continue
      }
      await supabase.from('notifications').update({ email_envoye_le: new Date().toISOString() }).eq('id', n.id)
      envoyes += 1
    } catch (erreur) {
      console.error('Envoi email impossible', n.id, erreur)
    }
  }
  return envoyes
}
