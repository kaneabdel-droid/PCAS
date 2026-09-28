import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

// Retour des liens envoyés par email (invitation d'un nouvel utilisateur, réinitialisation du mot de passe).
// Les modèles d'email Supabase doivent pointer ici : {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
// (ou type=recovery), avec &next=/auth/nouveau-mot-de-passe — voir README.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const suite = searchParams.get('next') ?? '/'
  // Redirection interne uniquement (pas d'URL externe injectée dans le lien).
  const destination = suite.startsWith('/') && !suite.startsWith('//') ? suite : '/'

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(destination, request.url))
  }

  return NextResponse.redirect(new URL('/login?erreur=lien', request.url))
}
