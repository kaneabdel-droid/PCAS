// PCAS — Organisation par filières agricoles : Céréale, Maraîchage, Fruitier.
// Chaque filière dispose de sa propre identité visuelle, de son périmètre de supervision dédié,
// tout en offrant au SuperAdmin la possibilité d'activer/désactiver les filières et de basculer
// instantanément entre une filière spécifique et la vue globale consolidée.

export type FiliereCode = 'cereale' | 'maraichage' | 'fruitier'
export type FiliereFiltre = FiliereCode | 'toutes'

export type FiliereInfo = {
  code: FiliereCode
  nom: string
  nomCourt: string
  description: string
  exemples: string
  categories: string[]
  exemplesCultures: string[]
  theme: {
    accentColor: string
    badgeClass: string
    activeBtnClass: string
    tagClass: string
    borderAccent: string
    borderLeftClass: string
    bgSoft: string
    gradient: string
    gradientBar: string
    cardHover: string
    cardTopStripe: string
    bannerBg: string
    bannerBorder: string
    emblemBg: string
    emblemHalo: string
    halo: string
    icone: string // Wheat, Carrot, Apple
  }
}

export const FILIERES_CODES: FiliereCode[] = ['cereale', 'maraichage', 'fruitier']

export const FILIERES: Record<FiliereCode, FiliereInfo> = {
  cereale: {
    code: 'cereale',
    nom: 'Céréales & Grains',
    nomCourt: 'Céréales',
    description: 'Riz paddy et blanchi, maïs, mil souna, sorgho, blé, fonio…',
    exemples: 'Riz de la Vallée, Maïs doux, Mil, Sorgho',
    exemplesCultures: ['Riz de la Vallée', 'Maïs doux', 'Mil souna', 'Sorgho', 'Blé', 'Fonio'],
    categories: ['Céréales'],
    theme: {
      accentColor: '#D97706',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800',
      activeBtnClass: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-600/30 hover:from-amber-600 hover:to-amber-700',
      tagClass: 'text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-800',
      borderAccent: 'border-amber-500',
      borderLeftClass: 'border-l-4 border-l-amber-500',
      bgSoft: 'bg-amber-50/70 dark:bg-amber-950/30',
      gradient: 'from-amber-600 via-yellow-600 to-amber-700',
      gradientBar: 'from-amber-500 via-yellow-500 to-amber-600',
      cardHover: 'hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10',
      cardTopStripe: 'bg-gradient-to-r from-amber-500 to-yellow-500',
      bannerBg: 'bg-gradient-to-r from-amber-50 via-amber-100/50 to-yellow-50 dark:from-amber-950/60 dark:via-amber-900/40 dark:to-yellow-950/40',
      bannerBorder: 'border-amber-300/80 dark:border-amber-800',
      emblemBg: 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-md shadow-amber-500/30',
      emblemHalo: 'ring-4 ring-amber-500/20',
      halo: 'ring-amber-500/20',
      icone: 'Wheat',
    },
  },
  maraichage: {
    code: 'maraichage',
    nom: 'Maraîchage & Légumes',
    nomCourt: 'Maraîchage',
    description: 'Oignon, tomate, piment, pomme de terre, carotte, chou, gombo, aubergine…',
    exemples: 'Oignon Galmi, Tomate fraîche, Pomme de terre, Piment',
    exemplesCultures: ['Oignon Galmi', 'Tomate fraîche', 'Pomme de terre', 'Piment', 'Carotte', 'Chou'],
    categories: ['Légumes', 'Tubercules', 'Autres'],
    theme: {
      accentColor: '#059669',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800',
      activeBtnClass: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30 hover:from-emerald-700 hover:to-teal-700',
      tagClass: 'text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800',
      borderAccent: 'border-emerald-500',
      borderLeftClass: 'border-l-4 border-l-emerald-500',
      bgSoft: 'bg-emerald-50/70 dark:bg-emerald-950/30',
      gradient: 'from-emerald-600 via-teal-600 to-green-700',
      gradientBar: 'from-emerald-600 via-teal-500 to-emerald-400',
      cardHover: 'hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10',
      cardTopStripe: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      bannerBg: 'bg-gradient-to-r from-emerald-50 via-teal-50/50 to-green-50 dark:from-emerald-950/60 dark:via-teal-900/40 dark:to-green-950/40',
      bannerBorder: 'border-emerald-300/80 dark:border-emerald-800',
      emblemBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/30',
      emblemHalo: 'ring-4 ring-emerald-500/20',
      halo: 'ring-emerald-500/20',
      icone: 'Carrot',
    },
  },
  fruitier: {
    code: 'fruitier',
    nom: 'Arboriculture & Fruits',
    nomCourt: 'Fruits',
    description: 'Mangue Kent/Keitt, agrumes, banane, papaye, pastèque, anacarde…',
    exemples: 'Mangue de Casamance, Banane de Tamba, Agrumes, Pastèque',
    exemplesCultures: ['Mangue de Casamance', 'Banane de Tamba', 'Agrumes du Niayes', 'Papaye', 'Pastèque'],
    categories: ['Fruits', 'Fruits à coque'],
    theme: {
      accentColor: '#E11D48',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800',
      activeBtnClass: 'bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-md shadow-rose-600/30 hover:from-rose-700 hover:to-orange-700',
      tagClass: 'text-rose-800 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/50 dark:border-rose-800',
      borderAccent: 'border-rose-500',
      borderLeftClass: 'border-l-4 border-l-rose-500',
      bgSoft: 'bg-rose-50/70 dark:bg-rose-950/30',
      gradient: 'from-rose-600 via-orange-600 to-rose-700',
      gradientBar: 'from-rose-600 via-pink-500 to-orange-500',
      cardHover: 'hover:border-rose-400 hover:shadow-lg hover:shadow-rose-500/10',
      cardTopStripe: 'bg-gradient-to-r from-rose-500 to-orange-500',
      bannerBg: 'bg-gradient-to-r from-rose-50 via-orange-50/50 to-pink-50 dark:from-rose-950/60 dark:via-orange-900/40 dark:to-pink-950/40',
      bannerBorder: 'border-rose-300/80 dark:border-rose-800',
      emblemBg: 'bg-gradient-to-br from-rose-600 to-orange-600 text-white shadow-md shadow-rose-500/30',
      emblemHalo: 'ring-4 ring-rose-500/20',
      halo: 'ring-rose-500/20',
      icone: 'Apple',
    },
  },
}

export const VUE_TOUTES_FILIERES = {
  code: 'toutes' as const,
  nom: 'Toutes les filières',
  nomCourt: 'Vue globale',
  description: 'Supervision consolidée et place de marché transversale',
  exemplesCultures: ['Céréales', 'Maraîchage', 'Arboriculture'],
  theme: {
    accentColor: '#2E6E3E',
    badgeClass: 'bg-primary-soft text-primary border-primary/20',
    activeBtnClass: 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary-hover',
    tagClass: 'text-foreground bg-surface-muted border-surface-border',
    borderAccent: 'border-primary',
    borderLeftClass: 'border-l-4 border-l-primary',
    bgSoft: 'bg-surface-muted',
    gradient: 'from-primary to-accent',
    gradientBar: 'from-primary via-emerald-600 to-accent',
    cardHover: 'hover:border-primary/40 hover:shadow-lg',
    cardTopStripe: 'bg-gradient-to-r from-primary to-accent',
    bannerBg: 'bg-surface-muted',
    bannerBorder: 'border-surface-border',
    emblemBg: 'bg-primary text-primary-foreground shadow-md shadow-primary/25',
    emblemHalo: 'ring-4 ring-primary/20',
    halo: 'ring-primary/20',
    icone: 'Layers',
  },
}

export const COOKIE_FILIERE = 'pcas_filiere'

export function estFiliereCode(val: unknown): val is FiliereCode {
  return typeof val === 'string' && val in FILIERES
}

export function estFiliereFiltre(val: unknown): val is FiliereFiltre {
  return val === 'toutes' || estFiliereCode(val)
}

/** Déduit la filière par défaut depuis la catégorie de produit */
export function filiereDeCategorie(categorie?: string | null): FiliereCode {
  if (!categorie) return 'cereale'
  if (categorie === 'Céréales') return 'cereale'
  if (['Légumes', 'Tubercules', 'Autres'].includes(categorie)) return 'maraichage'
  if (['Fruits', 'Fruits à coque'].includes(categorie)) return 'fruitier'
  return 'cereale'
}

/** Détermine la filière effective d'un produit (explicite ou dérivée) */
export function determinerFiliere(produit?: { filiere?: string | null; categorie?: string | null } | null): FiliereCode {
  if (!produit) return 'cereale'
  if (estFiliereCode(produit.filiere)) return produit.filiere
  return filiereDeCategorie(produit.categorie)
}

/** Résout la filière active selon l'utilisateur, son entreprise, les filières activées par l'admin et le cookie */
export function resoudreFiliereActive(
  cookieVal: string | undefined,
  filieresActivesPlateforme: FiliereCode[],
  userFiliere?: FiliereCode | null,
  entrepriseFilieres?: FiliereCode[] | null
): FiliereFiltre {
  // 1. Si l'utilisateur est un superviseur dédié à une filière spécifique, il est strictement verrouillé dessus
  if (userFiliere && filieresActivesPlateforme.includes(userFiliere)) {
    return userFiliere
  }

  // 2. Si l'utilisateur appartient à une entreprise dont les filières sont définies :
  // L'entreprise est dirigée exclusivement dans sa ou ses filières d'appartenance, et verrouillée sur le reste.
  if (entrepriseFilieres && entrepriseFilieres.length > 0) {
    const autorisees = entrepriseFilieres.filter((f) => filieresActivesPlateforme.includes(f))
    if (autorisees.length === 1 && autorisees[0]) {
      return autorisees[0]
    }
    if (autorisees.length > 1) {
      if (cookieVal && estFiliereCode(cookieVal) && autorisees.includes(cookieVal)) {
        return cookieVal
      }
      return autorisees[0]!
    }
  }

  // 3. Si une seule filière est activée sur la plateforme par le SuperAdmin, la plateforme entière s'y consacre
  if (filieresActivesPlateforme.length === 1 && filieresActivesPlateforme[0]) {
    return filieresActivesPlateforme[0]
  }

  // 4. Si le cookie indique une filière valide parmi celles activées
  if (cookieVal && estFiliereCode(cookieVal) && filieresActivesPlateforme.includes(cookieVal)) {
    return cookieVal
  }

  // 5. Par défaut pour les administrateurs et superviseurs globaux : vue consolidée
  return 'toutes'
}
