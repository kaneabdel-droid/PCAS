// Moteur d'états imprimables : chaque état décrit ses colonnes et charge ses lignes avec le client Supabase de
// l'utilisateur — la RLS limite donc chaque état à ce que l'utilisateur a le droit de voir.

import { createClient } from '@/utils/supabase/server'
import { MODES_PAIEMENT, STATUTS_BESOIN, STATUTS_COMMANDE } from '@/lib/commandes'
import { STATUTS_BON } from '@/lib/bons'
import { MODES_REGLEMENT, STATUTS_ECHEANCE, STATUTS_FACTURE } from '@/lib/execution'
import type { RoleBase } from '@/lib/roles'
import { DISPONIBILITES, MOTIFS, STATUTS_OFFRE, TYPES_MOUVEMENT, formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'

export type TypeColonne = 'texte' | 'date' | 'montant' | 'quantite'
export type ColonneEtat = { libelle: string; type: TypeColonne }
export type Valeur = string | number | null
export type FiltresEtat = { du: string; au: string; regroupement?: string }

export type DefinitionEtat = {
  id: string
  titre: string
  description: string
  roles: RoleBase[]
  periode: string | null // libellé de la date filtrée, null si l'état est instantané
  orientation: 'portrait' | 'paysage'
  regroupements?: { cle: string; libelle: string }[]
  colonnes: (f: FiltresEtat) => ColonneEtat[]
  charger: (f: FiltresEtat) => Promise<Valeur[][]>
}

const PLATEFORME: RoleBase[] = ['administrateur', 'superviseur']
const TOUS: RoleBase[] = ['producteur', 'client', 'financier', ...PLATEFORME]

const fin = (au: string) => `${au}T23:59:59.999Z`

async function nomsProducteurs() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('producteurs_publics').select('id, denomination')
  return new Map(((data ?? []) as { id: string; denomination: string }[]).map((p) => [p.id, p.denomination]))
}

type Entete = { denomination?: string; region?: string }

export const ETATS: DefinitionEtat[] = [
  {
    id: 'commandes',
    titre: 'Commandes',
    description: 'Commandes émises sur la période, avec leur statut et leur montant.',
    roles: ['client', 'producteur', ...PLATEFORME],
    periode: 'Date d’émission',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Numéro', type: 'texte' },
      { libelle: 'Émise le', type: 'date' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Paiement', type: 'texte' },
      { libelle: 'Livraison convenue', type: 'date' },
      { libelle: 'Statut', type: 'texte' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('commandes')
          .select('numero, soumise_le, entete_client, producteur_id, mode_paiement, date_livraison_convenue, statut, montant_total')
          .gte('soumise_le', f.du)
          .lte('soumise_le', fin(f.au))
          .order('soumise_le'),
        nomsProducteurs(),
      ])
      return (data ?? []).map((c) => [
        c.numero,
        c.soumise_le,
        (c.entete_client as Entete).denomination ?? '',
        noms.get(c.producteur_id) ?? '',
        MODES_PAIEMENT[c.mode_paiement],
        c.date_livraison_convenue,
        STATUTS_COMMANDE[c.statut]?.libelle ?? c.statut,
        c.montant_total,
      ])
    },
  },
  {
    id: 'factures',
    titre: 'Factures',
    description: 'Factures provisoires et définitives de la période.',
    roles: TOUS,
    periode: 'Date de facture',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Numéro', type: 'texte' },
      { libelle: 'Nature', type: 'texte' },
      { libelle: 'Date', type: 'date' },
      { libelle: 'Commande', type: 'texte' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Statut', type: 'texte' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('factures')
          .select('numero, nature, date_facture, statut, montant_total, producteur_id, commandes(numero, entete_client)')
          .gte('date_facture', f.du)
          .lte('date_facture', f.au)
          .order('date_facture'),
        nomsProducteurs(),
      ])
      return (data ?? []).map((x) => {
        const c = x.commandes as unknown as { numero: string; entete_client: Entete } | null
        return [
          x.numero,
          x.nature === 'provisoire' ? 'Provisoire' : 'Définitive',
          x.date_facture,
          c?.numero ?? '',
          c?.entete_client.denomination ?? '',
          noms.get(x.producteur_id) ?? '',
          STATUTS_FACTURE[x.statut]?.libelle ?? x.statut,
          x.nature === 'provisoire' ? null : x.montant_total,
        ]
      })
    },
  },
  {
    id: 'echeancier',
    titre: 'Échéancier',
    description: 'Échéances des factures définitives arrivant à terme sur la période.',
    roles: TOUS,
    periode: 'Date d’échéance',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Échéance', type: 'date' },
      { libelle: 'Facture', type: 'texte' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Statut', type: 'texte' },
      { libelle: 'Payée le', type: 'date' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('echeances')
          .select('date_echeance, montant, statut, payee_le, factures(numero, producteur_id, commandes(entete_client))')
          .gte('date_echeance', f.du)
          .lte('date_echeance', f.au)
          .order('date_echeance'),
        nomsProducteurs(),
      ])
      return (data ?? []).map((e) => {
        const fa = e.factures as unknown as { numero: string; producteur_id: string; commandes: { entete_client: Entete } | null } | null
        return [
          e.date_echeance,
          fa?.numero ?? '',
          fa?.commandes?.entete_client.denomination ?? '',
          noms.get(fa?.producteur_id ?? '') ?? '',
          STATUTS_ECHEANCE[e.statut]?.libelle ?? e.statut,
          e.payee_le,
          e.montant,
        ]
      })
    },
  },
  {
    id: 'encaissements',
    titre: 'Paiements reçus',
    description: 'Échéances payées sur la période (confirmées par les producteurs).',
    roles: TOUS,
    periode: 'Date de paiement',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Payée le', type: 'date' },
      { libelle: 'Facture', type: 'texte' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Mode', type: 'texte' },
      { libelle: 'Référence', type: 'texte' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('echeances')
          .select('payee_le, montant, mode_reglement, reference, factures(numero, producteur_id, commandes(entete_client))')
          .eq('statut', 'payee')
          .gte('payee_le', f.du)
          .lte('payee_le', f.au)
          .order('payee_le'),
        nomsProducteurs(),
      ])
      return (data ?? []).map((e) => {
        const fa = e.factures as unknown as { numero: string; producteur_id: string; commandes: { entete_client: Entete } | null } | null
        return [
          e.payee_le,
          fa?.numero ?? '',
          fa?.commandes?.entete_client.denomination ?? '',
          noms.get(fa?.producteur_id ?? '') ?? '',
          MODES_REGLEMENT[e.mode_reglement ?? 'autre'],
          e.reference ?? '',
          e.montant,
        ]
      })
    },
  },
  {
    id: 'livraisons',
    titre: 'Livraisons et écarts de réception',
    description: 'Quantités livrées et reçues par ligne de bon de livraison, avec les écarts.',
    roles: ['producteur', 'client', ...PLATEFORME],
    periode: 'Date de livraison',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Bon de livraison', type: 'texte' },
      { libelle: 'Livré le', type: 'date' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Produit', type: 'texte' },
      { libelle: 'Livré', type: 'quantite' },
      { libelle: 'Reçu', type: 'quantite' },
      { libelle: 'Écart', type: 'quantite' },
      { libelle: 'Motif', type: 'texte' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('bl_lignes')
          .select('quantite, produits(nom, unite), br_lignes(quantite_recue, motif_ecart), bons_livraison!inner(numero, date_livraison, producteur_id, commandes(entete_client))')
          .gte('bons_livraison.date_livraison', f.du)
          .lte('bons_livraison.date_livraison', f.au),
        nomsProducteurs(),
      ])
      return (data ?? [])
        .map((l) => {
          const bl = l.bons_livraison as unknown as { numero: string; date_livraison: string; producteur_id: string; commandes: { entete_client: Entete } | null }
          const p = l.produits as unknown as { nom: string; unite: string } | null
          const r = (l.br_lignes as unknown as { quantite_recue: number; motif_ecart: string | null }[] | null)?.[0]
          return [
            bl.numero,
            bl.date_livraison,
            bl.commandes?.entete_client.denomination ?? '',
            noms.get(bl.producteur_id) ?? '',
            p?.nom ?? '',
            Number(l.quantite),
            r ? Number(r.quantite_recue) : null,
            r ? Number(r.quantite_recue) - Number(l.quantite) : null,
            r?.motif_ecart ?? '',
          ] as Valeur[]
        })
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
    },
  },
  {
    id: 'ventes',
    titre: 'Chiffre d’affaires',
    description: 'Factures définitives de la période (quantités reçues), regroupées au choix.',
    roles: ['producteur', 'client', ...PLATEFORME],
    periode: 'Date de facture',
    orientation: 'portrait',
    regroupements: [
      { cle: 'produit', libelle: 'Par produit' },
      { cle: 'producteur', libelle: 'Par producteur' },
      { cle: 'client', libelle: 'Par client' },
      { cle: 'region', libelle: 'Par région du client' },
    ],
    colonnes: (f) => [
      { libelle: { produit: 'Produit', producteur: 'Producteur', client: 'Client', region: 'Région' }[f.regroupement ?? 'produit'] ?? 'Produit', type: 'texte' },
      ...(f.regroupement === 'produit' || !f.regroupement ? [{ libelle: 'Quantité', type: 'quantite' as const }] : []),
      { libelle: 'Nombre de lignes', type: 'quantite' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase
          .from('lignes_facture')
          .select('quantite, montant, produits(nom, unite), factures!inner(nature, date_facture, producteur_id, commandes(entete_client))')
          .eq('factures.nature', 'definitive')
          .gte('factures.date_facture', f.du)
          .lte('factures.date_facture', f.au),
        nomsProducteurs(),
      ])
      const groupes = new Map<string, { quantite: number; unite: string; lignes: number; montant: number }>()
      for (const l of data ?? []) {
        const fa = l.factures as unknown as { producteur_id: string; commandes: { entete_client: Entete } | null }
        const p = l.produits as unknown as { nom: string; unite: string } | null
        const cle =
          f.regroupement === 'producteur'
            ? (noms.get(fa.producteur_id) ?? '—')
            : f.regroupement === 'client'
              ? (fa.commandes?.entete_client.denomination ?? '—')
              : f.regroupement === 'region'
                ? (fa.commandes?.entete_client.region ?? 'Non précisée')
                : (p?.nom ?? '—')
        const g = groupes.get(cle) ?? { quantite: 0, unite: p?.unite ?? '', lignes: 0, montant: 0 }
        g.quantite += Number(l.quantite)
        g.lignes += 1
        g.montant += Number(l.montant)
        groupes.set(cle, g)
      }
      return [...groupes.entries()]
        .sort((a, b) => b[1].montant - a[1].montant)
        .map(([cle, g]) =>
          f.regroupement === 'produit' || !f.regroupement ? [cle, `${formatQuantite(g.quantite, g.unite)}`, g.lignes, g.montant] : [cle, g.lignes, g.montant]
        )
    },
  },
  {
    id: 'stocks',
    titre: 'État des stocks',
    description: 'Stock physique, réservé et disponible par site et par produit, à ce jour.',
    roles: ['producteur', ...PLATEFORME],
    periode: null,
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Site', type: 'texte' },
      { libelle: 'Produit', type: 'texte' },
      { libelle: 'Nature', type: 'texte' },
      { libelle: 'Physique', type: 'quantite' },
      { libelle: 'Réservé', type: 'quantite' },
      { libelle: 'Disponible', type: 'quantite' },
      { libelle: 'Unité', type: 'texte' },
    ],
    charger: async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('stocks')
        .select('quantite_physique, quantite_reservee, quantite_disponible, sites_production(nom), produits(nom, unite, nature), entreprises(denomination)')
      return (data ?? []).map((s) => {
        const p = s.produits as unknown as { nom: string; unite: string; nature: string } | null
        return [
          (s.entreprises as unknown as { denomination: string } | null)?.denomination ?? '',
          (s.sites_production as unknown as { nom: string } | null)?.nom ?? '',
          p?.nom ?? '',
          p?.nature === 'matiere_premiere' ? 'Matière première' : 'Produit fini',
          Number(s.quantite_physique),
          Number(s.quantite_reservee),
          Number(s.quantite_disponible),
          p?.unite ?? '',
        ]
      })
    },
  },
  {
    id: 'mouvements',
    titre: 'Mouvements de stock',
    description: 'Entrées, sorties, inventaires, réservations et livraisons de la période.',
    roles: ['producteur', ...PLATEFORME],
    periode: 'Date du mouvement',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Date', type: 'date' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Site', type: 'texte' },
      { libelle: 'Produit', type: 'texte' },
      { libelle: 'Type', type: 'texte' },
      { libelle: 'Motif', type: 'texte' },
      { libelle: 'Quantité', type: 'quantite' },
      { libelle: 'Commentaire', type: 'texte' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('mouvements_stock')
        .select('date_mouvement, type, motif, quantite, commentaire, sites_production(nom), produits(nom), entreprises(denomination)')
        .gte('date_mouvement', f.du)
        .lte('date_mouvement', f.au)
        .order('date_mouvement')
        .limit(5000)
      return (data ?? []).map((m) => [
        m.date_mouvement,
        (m.entreprises as unknown as { denomination: string } | null)?.denomination ?? '',
        (m.sites_production as unknown as { nom: string } | null)?.nom ?? '',
        (m.produits as unknown as { nom: string } | null)?.nom ?? '',
        TYPES_MOUVEMENT[m.type],
        MOTIFS[m.motif],
        m.type === 'sortie' || m.type === 'reservation' ? -Number(m.quantite) : Number(m.quantite),
        m.commentaire ?? '',
      ])
    },
  },
  {
    id: 'offres',
    titre: 'Catalogue des offres',
    description: 'Offres des producteurs, avec prix et quantités, à ce jour.',
    roles: ['producteur', ...PLATEFORME],
    periode: null,
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Produit', type: 'texte' },
      { libelle: 'Producteur', type: 'texte' },
      { libelle: 'Disponibilité', type: 'texte' },
      { libelle: 'Disponible le', type: 'date' },
      { libelle: 'Prix unitaire', type: 'montant' },
      { libelle: 'Offert', type: 'quantite' },
      { libelle: 'Réservé', type: 'quantite' },
      { libelle: 'Statut', type: 'texte' },
    ],
    charger: async () => {
      const supabase = await createClient()
      const [{ data }, noms] = await Promise.all([
        supabase.from('offres').select('producteur_id, disponibilite, date_disponibilite, prix_unitaire, quantite_offerte, quantite_reservee, statut, produits(nom)'),
        nomsProducteurs(),
      ])
      return (data ?? []).map((o) => [
        (o.produits as unknown as { nom: string } | null)?.nom ?? '',
        noms.get(o.producteur_id) ?? '',
        DISPONIBILITES[o.disponibilite],
        o.date_disponibilite,
        o.prix_unitaire,
        Number(o.quantite_offerte),
        Number(o.quantite_reservee),
        STATUTS_OFFRE[o.statut]?.libelle ?? o.statut,
      ])
    },
  },
  {
    id: 'besoins',
    titre: 'Besoins d’achat',
    description: 'Besoins d’achat publiés sur la période.',
    roles: ['client', ...PLATEFORME],
    periode: 'Date de publication',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Numéro', type: 'texte' },
      { libelle: 'Publié le', type: 'date' },
      { libelle: 'Produit', type: 'texte' },
      { libelle: 'Quantité', type: 'quantite' },
      { libelle: 'Prix cible', type: 'montant' },
      { libelle: 'Souhaité le', type: 'date' },
      { libelle: 'Région', type: 'texte' },
      { libelle: 'Statut', type: 'texte' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('besoins_achat')
        .select('numero, created_at, quantite, prix_cible, date_souhaitee, region_livraison, statut, produits(nom)')
        .gte('created_at', f.du)
        .lte('created_at', fin(f.au))
        .order('created_at')
      return (data ?? []).map((b) => [
        b.numero,
        b.created_at,
        (b.produits as unknown as { nom: string } | null)?.nom ?? '',
        Number(b.quantite),
        b.prix_cible,
        b.date_souhaitee,
        b.region_livraison ?? '',
        STATUTS_BESOIN[b.statut]?.libelle ?? b.statut,
      ])
    },
  },
  {
    id: 'bons-paiement',
    titre: 'Bons de paiement',
    description: 'Bons de paiement bancaires émis sur la période.',
    roles: ['financier', 'client', ...PLATEFORME],
    periode: 'Date d’émission',
    orientation: 'paysage',
    colonnes: () => [
      { libelle: 'Numéro', type: 'texte' },
      { libelle: 'Émis le', type: 'date' },
      { libelle: 'Commande', type: 'texte' },
      { libelle: 'Client', type: 'texte' },
      { libelle: 'Statut', type: 'texte' },
      { libelle: 'Référence bancaire', type: 'texte' },
      { libelle: 'Montant', type: 'montant' },
    ],
    charger: async (f) => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('bons_paiement')
        .select('numero, created_at, statut, reference_bancaire, montant, commandes(numero, entete_client)')
        .gte('created_at', f.du)
        .lte('created_at', fin(f.au))
        .order('created_at')
      return (data ?? []).map((b) => {
        const c = b.commandes as unknown as { numero: string; entete_client: Entete } | null
        return [b.numero, b.created_at, c?.numero ?? '', c?.entete_client.denomination ?? '', STATUTS_BON[b.statut]?.libelle ?? b.statut, b.reference_bancaire ?? '', b.montant]
      })
    },
  },
]

/** Valeur affichée (et exportée en PDF) selon le type de colonne. */
export function formaterValeur(v: Valeur, type: TypeColonne): string {
  if (v === null || v === '') return ''
  if (type === 'date') return formatDate(String(v))
  if (type === 'montant') return formatMontant(Number(v))
  if (type === 'quantite') return typeof v === 'number' ? formatQuantite(v) : String(v)
  return String(v)
}

/** Périodes proposées en raccourci (du, au). */
export function raccourcisPeriode(): { libelle: string; du: string; au: string }[] {
  const aujourdhui = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const a = aujourdhui.getFullYear()
  const m = aujourdhui.getMonth()
  const trimestre = Math.floor(m / 3) * 3
  return [
    { libelle: 'Ce mois', du: iso(new Date(Date.UTC(a, m, 1))), au: iso(aujourdhui) },
    { libelle: 'Mois dernier', du: iso(new Date(Date.UTC(a, m - 1, 1))), au: iso(new Date(Date.UTC(a, m, 0))) },
    { libelle: 'Ce trimestre', du: iso(new Date(Date.UTC(a, trimestre, 1))), au: iso(aujourdhui) },
    { libelle: 'Cette année', du: iso(new Date(Date.UTC(a, 0, 1))), au: iso(aujourdhui) },
    { libelle: 'Année dernière', du: iso(new Date(Date.UTC(a - 1, 0, 1))), au: iso(new Date(Date.UTC(a - 1, 11, 31))) },
  ]
}
