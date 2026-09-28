import type { CapacitorConfig } from '@capacitor/cli'

// L'application mobile charge PCAS en ligne (toujours connecté) ; www/ ne contient que l'écran affiché quand le serveur
// est injoignable au lancement. Les modules natifs (push, scanner, partage de fichiers) sont appelés par le site via le
// pont Capacitor (voir lib/natif.ts du site).
const config: CapacitorConfig = {
  appId: 'com.dembasolution.pcas',
  appName: 'PCAS',
  webDir: 'www',
  server: {
    url: 'https://pcas.dembasolution.com',
    cleartext: false,
    errorPath: 'hors-ligne.html',
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#163A27',
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: '#163A27',
      style: 'DARK',
    },
  },
}

export default config
