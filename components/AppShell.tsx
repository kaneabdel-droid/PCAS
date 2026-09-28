'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  Factory,
  FileSignature,
  FileText,
  Gauge,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Printer,
  ScrollText,
  Settings,
  Scale,
  ScanLine,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Sprout,
  Store,
  Truck,
  Users,
  Wheat,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/auth/actions'
import { Cloche } from '@/components/Cloche'
import { Embleme } from '@/components/Logo'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { MENUS, type MenuItem } from '@/lib/menus'
import { permissionMenu, type Matrice } from '@/lib/permissions'
import type { RoleBase } from '@/lib/roles'

// Icônes par href : tenues à part du registre lib/menus.ts, qui reste sans dépendance d'affichage.
const ICONES: Record<string, typeof LayoutDashboard> = {
  '/': LayoutDashboard,
  '/marche': Store,
  '/panier': ShoppingCart,
  '/commandes': ClipboardList,
  '/besoins': Megaphone,
  '/offres': ShoppingBasket,
  '/stocks/produits': Package,
  '/stocks/matieres': Wheat,
  '/sites': Factory,
  '/supervision/approbations': BadgeCheck,
  '/supervision/capacites': Gauge,
  '/supervision/litiges': Scale,
  '/bons-paiement': Landmark,
  '/livraisons': Truck,
  '/factures': FileText,
  '/echeances': CalendarClock,
  '/etats': Printer,
  '/entreprise': Building2,
  '/admin/entreprises': Building2,
  '/admin/utilisateurs': Users,
  '/admin/profils': ShieldCheck,
  '/admin/produits': Sprout,
  '/admin/contrats': FileSignature,
  '/admin/journal': ScrollText,
  '/admin/demandes': Inbox,
  '/verifier': ScanLine,
  '/admin/parametres': Settings,
  '/contrat': FileSignature,
}

// Raccourcis de la barre basse sur mobile (les premiers accessibles au rôle, puis « Menu »).
const RACCOURCIS_MOBILE = ['/', '/commandes', '/factures', '/marche', '/offres']

function estActif(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join('')
}

export function AppShell({
  utilisateur,
  role,
  roleLibelle,
  entreprise,
  permissions,
  utilisateurId,
  nonLues,
  children,
}: {
  utilisateur: string
  role: RoleBase
  roleLibelle: string
  entreprise: string
  permissions: Matrice
  utilisateurId: string
  nonLues: number
  children: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const pathname = usePathname()

  // Tiroir mobile : fermeture par la touche Échap.
  useEffect(() => {
    if (!ouvert) return
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false)
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert])

  // Plafond du rôle, puis restriction éventuelle du profil personnalisé.
  const visible = (item: MenuItem) => item.roles.includes(role) && permissionMenu(permissions, item.href, 'lire')
  const groupes = MENUS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0)
  const accessibles = groupes.flatMap((g) => g.items).filter((i) => !i.bientot)
  const raccourcis = RACCOURCIS_MOBILE.map((href) => accessibles.find((i) => i.href === href))
    .filter((i): i is MenuItem => Boolean(i))
    .slice(0, 3)

  const entete = (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <Embleme />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-base font-bold leading-tight text-sidebar-foreground">PCAS</p>
        <p className="truncate text-xs text-sidebar-muted">{entreprise}</p>
      </div>
      <Cloche key={nonLues} utilisateurId={utilisateurId} nonLues={nonLues} className="hidden lg:inline-flex" />
    </div>
  )

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
      {groupes.map((groupe) => (
        <div key={groupe.titre}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            {groupe.titre}
          </p>
          <ul className="space-y-0.5">
            {groupe.items.map((item) => {
              const Icone = ICONES[item.href] ?? LayoutDashboard
              if (item.bientot) {
                return (
                  <li key={item.href}>
                    <span
                      className="flex cursor-default items-center gap-3 rounded-md px-3 py-1.5 text-sm text-sidebar-muted/60"
                      title="Disponible prochainement"
                    >
                      <Icone className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="rounded bg-sidebar-hover px-1.5 py-0.5 text-[10px] font-medium">Bientôt</span>
                    </span>
                  </li>
                )
              }
              const actif = estActif(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOuvert(false)}
                    aria-current={actif ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors',
                      actif
                        ? 'bg-sidebar-actif font-semibold text-sidebar-actif-foreground'
                        : 'text-sidebar-foreground/90 hover:bg-sidebar-hover hover:text-sidebar-foreground'
                    )}
                  >
                    <Icone className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const pied = (
    <div className="space-y-3 border-t border-sidebar-border p-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {initiales(utilisateur)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{utilisateur}</p>
          <p className="truncate text-xs text-sidebar-muted">{roleLibelle}</p>
        </div>
      </div>
      <ThemeSwitcher />
      <Link
        href="/guide"
        onClick={() => setOuvert(false)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/90 hover:bg-sidebar-hover hover:text-sidebar-foreground"
      >
        <BookOpen className="h-4 w-4" aria-hidden /> Guide d’utilisation
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/90 hover:bg-sidebar-hover hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
        </button>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-1">
      {/* Bureau : barre latérale fixe */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {entete}
        {nav}
        {pied}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile et tablette : barre supérieure */}
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-sidebar px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <Embleme className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold leading-tight text-sidebar-foreground">PCAS</p>
            <p className="truncate text-xs text-sidebar-muted">{entreprise}</p>
          </div>
          <Cloche key={nonLues} utilisateurId={utilisateurId} nonLues={nonLues} />
        </header>

        {ouvert && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              aria-label="Fermer le menu"
              className="absolute inset-0 bg-black/50"
              onClick={() => setOuvert(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-2xl">
              <div className="relative">
                {entete}
                <button
                  type="button"
                  onClick={() => setOuvert(false)}
                  aria-label="Fermer le menu"
                  className="absolute right-3 top-4 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
              {pied}
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">{children}</main>

        {/* Mobile : barre de navigation basse */}
        <nav
          className="pb-securite fixed inset-x-0 bottom-0 z-30 border-t border-surface-border bg-surface/95 backdrop-blur lg:hidden"
          aria-label="Navigation rapide"
        >
          <ul className="flex">
            {raccourcis.map((item) => {
              const Icone = item.href === '/' ? Home : (ICONES[item.href] ?? LayoutDashboard)
              const actif = estActif(pathname, item.href)
              return (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={actif ? 'page' : undefined}
                    className={cn(
                      'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                      actif ? 'text-primary' : 'text-foreground-muted'
                    )}
                  >
                    <Icone className="h-5 w-5" aria-hidden />
                    {item.href === '/' ? 'Accueil' : item.label}
                  </Link>
                </li>
              )
            })}
            <li className="flex-1">
              <button
                type="button"
                onClick={() => setOuvert(true)}
                className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-foreground-muted"
              >
                <Menu className="h-5 w-5" aria-hidden />
                Menu
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
