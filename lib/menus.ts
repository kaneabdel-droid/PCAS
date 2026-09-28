// Registre unique des menus : source commune à la barre latérale (AppShell) et, au lot 1, à l'écran des profils
// (matrice de permissions). `href` sert de clé dans la matrice : ne pas le changer sans migrer les profils enregistrés.
// `roles` est le plafond technique de chaque écran ; un profil personnalisé ne peut que le restreindre.
// `bientot` : écran prévu dans un lot ultérieur, affiché grisé et non cliquable tant qu'il n'existe pas.

import type { RoleBase } from '@/lib/roles'

export type MenuItem = {
  href: string
  label: string
  roles: RoleBase[]
  bientot?: boolean
}

export type GroupeMenu = {
  titre: string
  items: MenuItem[]
}

const TOUS: RoleBase[] = ['administrateur', 'superviseur', 'producteur', 'client', 'financier']
const PLATEFORME: RoleBase[] = ['administrateur', 'superviseur']

export const MENUS: GroupeMenu[] = [
  {
    titre: 'Pilotage',
    items: [
      { href: '/', label: 'Tableau de bord', roles: TOUS },
      { href: '/verifier', label: 'Vérifier un document', roles: TOUS },
    ],
  },
  {
    titre: 'Place de marché',
    items: [
      { href: '/marche', label: 'Offres des producteurs', roles: ['client', ...PLATEFORME] },
      { href: '/panier', label: 'Panier', roles: ['client'] },
      { href: '/commandes', label: 'Commandes', roles: ['client', 'producteur', ...PLATEFORME] },
      { href: '/besoins', label: 'Besoins d’achat', roles: ['client', 'producteur', ...PLATEFORME] },
    ],
  },
  {
    titre: 'Production',
    items: [
      { href: '/offres', label: 'Mes offres', roles: ['producteur'] },
      { href: '/stocks/produits', label: 'Stock produits finis', roles: ['producteur', ...PLATEFORME] },
      { href: '/stocks/matieres', label: 'Stock matière première', roles: ['producteur', ...PLATEFORME] },
      { href: '/sites', label: 'Sites de production', roles: ['producteur', ...PLATEFORME] },
    ],
  },
  {
    titre: 'Supervision',
    items: [
      { href: '/supervision/approbations', label: 'Approbations', roles: PLATEFORME },
      { href: '/supervision/capacites', label: 'Capacités des producteurs', roles: PLATEFORME },
      { href: '/supervision/litiges', label: 'Litiges de réception', roles: PLATEFORME },
    ],
  },
  {
    titre: 'Livraison et paiement',
    items: [
      { href: '/bons-paiement', label: 'Bons de paiement', roles: ['financier', 'client', ...PLATEFORME] },
      { href: '/livraisons', label: 'Livraisons et réceptions', roles: ['producteur', 'client', ...PLATEFORME] },
      { href: '/factures', label: 'Factures', roles: TOUS },
      { href: '/echeances', label: 'Échéancier', roles: TOUS },
    ],
  },
  {
    titre: 'États',
    items: [{ href: '/etats', label: 'Impressions et états', roles: TOUS }],
  },
  {
    titre: 'Mon entreprise',
    items: [
      { href: '/entreprise', label: 'Fiche entreprise', roles: ['producteur', 'client', 'financier'] },
      { href: '/contrat', label: 'Contrat d’engagement', roles: ['producteur', 'client'] },
    ],
  },
  {
    titre: 'Administration',
    items: [
      { href: '/admin/entreprises', label: 'Entreprises', roles: ['administrateur'] },
      { href: '/admin/utilisateurs', label: 'Utilisateurs', roles: ['administrateur'] },
      { href: '/admin/demandes', label: 'Demandes d’accès', roles: ['administrateur'] },
      { href: '/admin/profils', label: 'Profils', roles: ['administrateur'] },
      { href: '/admin/produits', label: 'Catalogue produits', roles: ['administrateur'] },
      { href: '/admin/contrats', label: 'Contrats d’engagement', roles: ['administrateur'] },
      { href: '/admin/journal', label: 'Journal d’audit', roles: ['administrateur'] },
      { href: '/admin/parametres', label: 'Paramètres', roles: ['administrateur'] },
    ],
  },
]
