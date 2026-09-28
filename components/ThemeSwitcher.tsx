'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { CLE_STOCKAGE_THEME, THEMES, type CleTheme } from '@/lib/theme'

function appliquer(cle: CleTheme) {
  const racine = document.documentElement
  THEMES.forEach((t) => t.classe && racine.classList.remove(t.classe))
  const classe = THEMES.find((t) => t.cle === cle)?.classe
  if (classe) racine.classList.add(classe)
}

function themeCourant(): CleTheme {
  const racine = document.documentElement
  return THEMES.find((t) => t.classe && racine.classList.contains(t.classe))?.cle ?? 'savane'
}

/** Sélecteur de thème (Savane, Latérite, Nuit), placé dans le pied de la barre latérale. */
// Le thème est appliqué avant l'affichage par le script de <head> : la classe de <html> est la source de vérité,
// observée pour que les deux sélecteurs (barre latérale et tiroir mobile) restent synchronisés.
function abonner(rappel: () => void) {
  const observateur = new MutationObserver(rappel)
  observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observateur.disconnect()
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const actuel = useSyncExternalStore<CleTheme | null>(abonner, themeCourant, () => null)

  function choisir(cle: CleTheme) {
    appliquer(cle)
    try {
      localStorage.setItem(CLE_STOCKAGE_THEME, cle)
    } catch {
      // Stockage indisponible (navigation privée) : le thème s'applique pour la session en cours seulement.
    }
  }

  return (
    <div className={cn('flex gap-1 rounded-lg bg-sidebar-hover p-1', className)} role="group" aria-label="Thème">
      {THEMES.map((t) => (
        <button
          key={t.cle}
          type="button"
          onClick={() => choisir(t.cle)}
          aria-pressed={actuel === t.cle}
          className={cn(
            'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            actuel === t.cle
              ? 'bg-sidebar-actif text-sidebar-actif-foreground'
              : 'text-sidebar-muted hover:text-sidebar-foreground'
          )}
        >
          {t.nom}
        </button>
      ))}
    </div>
  )
}
