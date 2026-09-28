// Pont vers l'application mobile (coque Capacitor qui charge PCAS en ligne). Capacitor injecte son pont
// (window.Capacitor) dans la page : les modules natifs sont appelés par leur nom, sans dépendance dans le site web.
// Dans un navigateur ordinaire, ces fonctions ne font rien et le site garde son comportement web.

type Plugin = Record<string, (...args: unknown[]) => Promise<unknown>> & {
  addListener?: (evenement: string, rappel: (donnees: unknown) => void) => Promise<unknown>
}

type Capacitor = {
  isNativePlatform?: () => boolean
  getPlatform?: () => 'android' | 'ios' | 'web'
  Plugins?: Record<string, Plugin | undefined>
}

function capacitor(): Capacitor | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Capacitor?: Capacitor }).Capacitor ?? null
}

export function estApplicationNative() {
  return Boolean(capacitor()?.isNativePlatform?.())
}

export function plateformeNative(): 'android' | 'ios' | null {
  const p = capacitor()?.getPlatform?.()
  return p === 'android' || p === 'ios' ? p : null
}

export function pluginNatif(nom: string): Plugin | null {
  if (!estApplicationNative()) return null
  return capacitor()?.Plugins?.[nom] ?? null
}

/**
 * Enregistre un PDF : téléchargement dans le navigateur ; dans l'application mobile (où les téléchargements de la vue web
 * ne fonctionnent pas), écriture dans le cache puis feuille de partage (enregistrer, envoyer par WhatsApp, imprimer…).
 */
export async function enregistrerPdf(doc: { save: (nom: string) => void; output: (type: 'datauristring') => string }, nomFichier: string) {
  const fichiers = pluginNatif('Filesystem')
  const partage = pluginNatif('Share')
  if (!fichiers || !partage) {
    doc.save(nomFichier)
    return
  }
  const donnees = doc.output('datauristring').split(',')[1]
  const resultat = (await fichiers.writeFile({ path: nomFichier, data: donnees, directory: 'CACHE' })) as { uri: string }
  await partage.share({ title: nomFichier, files: [resultat.uri] })
}
