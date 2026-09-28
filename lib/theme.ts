// Thèmes de l'interface (classe posée sur <html>). Le choix est mémorisé sur l'appareil ; sans choix,
// le thème suit le réglage clair/sombre du système (macOS, Windows, iOS, Android).

export const THEMES = [
  { cle: 'savane', nom: 'Savane', classe: '' },
  { cle: 'laterite', nom: 'Latérite', classe: 'theme-laterite' },
  { cle: 'nuit', nom: 'Nuit', classe: 'theme-nuit' },
] as const

export type CleTheme = (typeof THEMES)[number]['cle']

export const CLE_STOCKAGE_THEME = 'pcas-theme'

/**
 * Script exécuté avant l'affichage de la page (dans <head>) : applique le thème sans flash de couleur.
 * Les accès au stockage sont protégés (navigation privée, stockage bloqué).
 */
export const SCRIPT_THEME_INITIAL = `(function(){try{var t=null;try{t=localStorage.getItem('${CLE_STOCKAGE_THEME}')}catch(e){}
if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'nuit':'savane'}
var c={laterite:'theme-laterite',nuit:'theme-nuit'}[t];if(c)document.documentElement.classList.add(c)}catch(e){}})();`
