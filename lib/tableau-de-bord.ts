import { createClient } from '@/utils/supabase/server'
import type { Tuile } from '@/components/tableau-de-bord/Tuiles'
import type { Contexte } from '@/lib/session'
import { STATUTS_A_TRAITER } from '@/lib/supervision'
import { formatDate, formatMontant } from '@/lib/utils'

// Chiffres clés et listes « à traiter » du tableau de bord, selon le profil. Chaque requête passe par la RLS : un même
// comptage donne les commandes du client, du producteur, de la banque ou de toute la plateforme selon l'utilisateur.

export type Liste = {
  titre: string
  lienTout: string
  vide: string
  elements: { id: string; libelle: string; detail: string; lien: string; valeur?: string }[]
}

const EN_COURS = ['soumise', 'en_attente', 'approuvee', 'attente_banque', 'approuvee_banque', 'validee', 'livree_partiellement', 'livree', 'en_litige']
const A_LIVRER = ['validee', 'livree_partiellement']

function debutDuMois() {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toISOString().slice(0, 10)
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

type Commande = { id: string; numero: string; montant_total: number; date_livraison_convenue: string | null; entete_client: { denomination?: string } }

async function sommeEcheances(statuts: string[]) {
  const supabase = await createClient()
  const { data } = await supabase.from('echeances').select('montant').in('statut', statuts)
  return (data ?? []).reduce((s, e) => s + Number(e.montant), 0)
}

export async function donneesTableauDeBord(ctx: Contexte): Promise<{ tuiles: Tuile[]; listes: Liste[] }> {
  const supabase = await createClient()
  const jour = aujourdhui()

  if (ctx.role === 'client') {
    const [{ count: enCours }, { data: receptions }, aPayer, enRetard, { count: besoins }] = await Promise.all([
      supabase.from('commandes').select('id', { count: 'exact', head: true }).in('statut', EN_COURS),
      supabase.from('bons_reception').select('id, numero, date_limite, bl_id, commandes(numero)').eq('statut', 'en_attente').order('date_limite').limit(5),
      sommeEcheances(['a_payer', 'en_retard']),
      sommeEcheances(['en_retard']),
      supabase.from('besoins_achat').select('id', { count: 'exact', head: true }).in('statut', ['ouvert', 'en_traitement']),
    ])
    const { data: echeances } = await supabase
      .from('echeances')
      .select('id, date_echeance, montant, statut, factures(id, numero)')
      .in('statut', ['a_payer', 'en_retard'])
      .order('date_echeance')
      .limit(5)
    return {
      tuiles: [
        { libelle: 'Commandes en cours', valeur: String(enCours ?? 0), lien: '/commandes' },
        { libelle: 'Réceptions à confirmer', valeur: String(receptions?.length ?? 0), lien: '/livraisons', alerte: (receptions?.length ?? 0) > 0 },
        { libelle: 'Reste à payer', valeur: formatMontant(aPayer), detail: enRetard ? `dont ${formatMontant(enRetard)} en retard` : undefined, lien: '/echeances', alerte: enRetard > 0 },
        { libelle: 'Besoins d’achat ouverts', valeur: String(besoins ?? 0), lien: '/besoins' },
      ],
      listes: [
        {
          titre: 'Réceptions à confirmer',
          lienTout: '/livraisons',
          vide: 'Aucune livraison en attente de votre confirmation.',
          elements: (receptions ?? []).map((r) => ({
            id: r.id,
            libelle: `${r.numero} · commande ${(r.commandes as unknown as { numero: string } | null)?.numero ?? ''}`,
            detail: `Réception tacite le ${formatDate(r.date_limite)} sans réponse`,
            lien: `/livraisons/${r.bl_id}`,
          })),
        },
        {
          titre: 'Prochaines échéances',
          lienTout: '/echeances',
          vide: 'Aucune échéance à payer.',
          elements: (echeances ?? []).map((e) => ({
            id: e.id,
            libelle: `Facture ${(e.factures as unknown as { numero: string } | null)?.numero ?? ''}`,
            detail: `${e.statut === 'en_retard' ? 'En retard depuis le' : 'Le'} ${formatDate(e.date_echeance)}`,
            lien: `/factures/${(e.factures as unknown as { id: string } | null)?.id ?? ''}`,
            valeur: formatMontant(e.montant),
          })),
        },
      ],
    }
  }

  if (ctx.role === 'producteur') {
    const [{ data: aValider }, { data: aLivrer }, aEncaisser, enRetard, { count: offres }, { data: aDate }] = await Promise.all([
      supabase.from('commandes').select('id, numero, montant_total, date_livraison_convenue, entete_client').in('statut', ['approuvee', 'approuvee_banque']).order('approuvee_le').returns<Commande[]>(),
      supabase.from('commandes').select('id, numero, montant_total, date_livraison_convenue, entete_client').in('statut', A_LIVRER).order('date_livraison_convenue').returns<Commande[]>(),
      sommeEcheances(['a_payer', 'en_retard']),
      sommeEcheances(['en_retard']),
      supabase.from('offres').select('id', { count: 'exact', head: true }).eq('statut', 'publiee'),
      supabase
        .from('offres')
        .select('id, date_disponibilite, quantite_reservee, produits(nom, unite)')
        .not('date_disponibilite', 'is', null)
        .gt('quantite_reservee', 0)
        .lte('date_disponibilite', new Date(Date.parse(jour) + 7 * 86400000).toISOString().slice(0, 10))
        .order('date_disponibilite')
        .limit(5),
    ])
    const enRetardLivraison = (aLivrer ?? []).filter((c) => c.date_livraison_convenue && c.date_livraison_convenue < jour).length
    return {
      tuiles: [
        { libelle: 'Commandes à valider', valeur: String(aValider?.length ?? 0), lien: '/commandes', alerte: (aValider?.length ?? 0) > 0 },
        {
          libelle: 'Commandes à livrer',
          valeur: String(aLivrer?.length ?? 0),
          detail: enRetardLivraison ? `dont ${enRetardLivraison} en retard sur la date convenue` : undefined,
          lien: '/commandes',
          alerte: enRetardLivraison > 0,
        },
        { libelle: 'Reste à encaisser', valeur: formatMontant(aEncaisser), detail: enRetard ? `dont ${formatMontant(enRetard)} en retard` : undefined, lien: '/echeances', alerte: enRetard > 0 },
        { libelle: 'Offres publiées', valeur: String(offres ?? 0), lien: '/offres' },
      ],
      listes: [
        {
          titre: 'À valider',
          lienTout: '/commandes',
          vide: 'Aucune commande en attente de validation.',
          elements: (aValider ?? []).slice(0, 5).map((c) => ({
            id: c.id,
            libelle: `${c.numero} · ${c.entete_client.denomination ?? ''}`,
            detail: `Livraison convenue le ${formatDate(c.date_livraison_convenue)}`,
            lien: `/commandes/${c.id}`,
            valeur: formatMontant(c.montant_total),
          })),
        },
        {
          titre: 'À livrer',
          lienTout: '/commandes',
          vide: 'Aucune livraison en attente.',
          elements: (aLivrer ?? []).slice(0, 5).map((c) => ({
            id: c.id,
            libelle: `${c.numero} · ${c.entete_client.denomination ?? ''}`,
            detail: `${c.date_livraison_convenue && c.date_livraison_convenue < jour ? 'En retard — convenue le' : 'Convenue le'} ${formatDate(c.date_livraison_convenue)}`,
            lien: `/commandes/${c.id}`,
          })),
        },
        {
          titre: 'Offres à date commandées : production à déclarer',
          lienTout: '/offres',
          vide: 'Aucune offre à date commandée dans les 7 prochains jours.',
          elements: (aDate ?? []).map((o) => {
            const p = o.produits as unknown as { nom: string; unite: string } | null
            return {
              id: o.id,
              libelle: p?.nom ?? '',
              detail: `Disponible le ${formatDate(o.date_disponibilite)} · ${Number(o.quantite_reservee).toLocaleString('fr-FR')} ${p?.unite ?? ''} commandés`,
              lien: `/offres/${o.id}`,
            }
          }),
        },
      ],
    }
  }

  if (ctx.role === 'financier') {
    const [{ data: bons }, { data: approuves }] = await Promise.all([
      supabase.from('bons_paiement').select('id, numero, montant, created_at, commandes(entete_client)').eq('statut', 'soumis').order('created_at').limit(20),
      supabase.from('bons_paiement').select('montant').eq('statut', 'approuve').gte('decide_le', debutDuMois()),
    ])
    const enRetard = await sommeEcheances(['en_retard'])
    return {
      tuiles: [
        { libelle: 'Bons de paiement à traiter', valeur: String(bons?.length ?? 0), lien: '/bons-paiement', alerte: (bons?.length ?? 0) > 0 },
        { libelle: 'Approuvés ce mois', valeur: formatMontant((approuves ?? []).reduce((s, b) => s + Number(b.montant), 0)), lien: '/bons-paiement?onglet=approuve' },
        { libelle: 'Échéances en retard (commandes financées)', valeur: formatMontant(enRetard), lien: '/echeances', alerte: enRetard > 0 },
      ],
      listes: [
        {
          titre: 'Bons de paiement à traiter',
          lienTout: '/bons-paiement',
          vide: 'Aucun bon de paiement en attente.',
          elements: (bons ?? []).slice(0, 5).map((b) => ({
            id: b.id,
            libelle: `${b.numero} · ${(b.commandes as unknown as { entete_client: { denomination?: string } } | null)?.entete_client.denomination ?? ''}`,
            detail: `Émis le ${formatDate(b.created_at)}`,
            lien: `/bons-paiement/${b.id}`,
            valeur: formatMontant(b.montant),
          })),
        },
      ],
    }
  }

  // Superviseur et administrateur
  const [{ data: aTraiter }, { count: litiges }, { data: enRetardLivraison }, enRetard, { data: factures }, { count: demandes }] = await Promise.all([
    supabase.from('commandes').select('id, numero, montant_total, date_livraison_convenue, entete_client').in('statut', STATUTS_A_TRAITER).order('soumise_le').returns<Commande[]>(),
    supabase.from('bons_reception').select('id', { count: 'exact', head: true }).eq('statut', 'en_litige'),
    supabase.from('commandes').select('id, numero, montant_total, date_livraison_convenue, entete_client').in('statut', A_LIVRER).lt('date_livraison_convenue', jour).order('date_livraison_convenue').returns<Commande[]>(),
    sommeEcheances(['en_retard']),
    supabase.from('factures').select('montant_total').eq('nature', 'definitive').gte('date_facture', debutDuMois()),
    ctx.role === 'administrateur'
      ? supabase.from('demandes_acces').select('id', { count: 'exact', head: true }).eq('statut', 'nouvelle')
      : Promise.resolve({ count: 0 }),
  ])
  const ventesMois = (factures ?? []).reduce((s, f) => s + Number(f.montant_total), 0)
  return {
    tuiles: [
      { libelle: 'Commandes à approuver', valeur: String(aTraiter?.length ?? 0), lien: '/supervision/approbations', alerte: (aTraiter?.length ?? 0) > 0 },
      { libelle: 'Litiges de réception', valeur: String(litiges ?? 0), lien: '/supervision/litiges', alerte: (litiges ?? 0) > 0 },
      { libelle: 'Livraisons en retard', valeur: String(enRetardLivraison?.length ?? 0), detail: 'Date convenue dépassée', lien: '/commandes', alerte: (enRetardLivraison?.length ?? 0) > 0 },
      ctx.role === 'administrateur' && (demandes ?? 0) > 0
        ? { libelle: 'Demandes d’accès', valeur: String(demandes), lien: '/admin/demandes', alerte: true }
        : { libelle: 'Facturé ce mois', valeur: formatMontant(ventesMois), detail: enRetard ? `${formatMontant(enRetard)} d’échéances en retard` : undefined, lien: '/etats/ventes' },
    ],
    listes: [
      {
        titre: 'À approuver',
        lienTout: '/supervision/approbations',
        vide: 'Aucune commande à traiter.',
        elements: (aTraiter ?? []).slice(0, 5).map((c) => ({
          id: c.id,
          libelle: `${c.numero} · ${c.entete_client.denomination ?? ''}`,
          detail: 'Soumise au superviseur',
          lien: `/supervision/approbations/${c.id}`,
          valeur: formatMontant(c.montant_total),
        })),
      },
      {
        titre: 'Livraisons en retard',
        lienTout: '/commandes',
        vide: 'Aucune livraison en retard.',
        elements: (enRetardLivraison ?? []).slice(0, 5).map((c) => ({
          id: c.id,
          libelle: `${c.numero} · ${c.entete_client.denomination ?? ''}`,
          detail: `Convenue le ${formatDate(c.date_livraison_convenue)}`,
          lien: `/commandes/${c.id}`,
        })),
      },
    ],
  }
}
