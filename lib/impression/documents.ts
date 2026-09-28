import { createClient } from '@/utils/supabase/server'
import { MODES_PAIEMENT } from '@/lib/commandes'
import { MODES_REGLEMENT } from '@/lib/execution'
import { montantEnLettres } from '@/lib/lettres'
import { urlVerification, type TypeDocument } from '@/lib/qr'
import { urlLogo } from '@/lib/referentiels'
import { formatQuantite } from '@/lib/stocks'
import { formatDate, formatMontant } from '@/lib/utils'
import type { ModeleDocument, PartieDocument } from '@/lib/impression/modele'

type Entete = Record<string, string | null | undefined>

function partieClient(role: string, e: Entete): PartieDocument {
  return {
    role,
    nom: e.denomination ?? '',
    logo: urlLogo(e.logo_path ?? null),
    lignes: [
      [e.adresse, e.commune, e.region].filter(Boolean).join(', '),
      e.identifiant_fiscal ? `${e.type_identifiant ?? 'NINEA'} ${e.identifiant_fiscal}${e.rccm ? ` · RCCM ${e.rccm}` : ''}` : '',
      [e.telephone, e.email].filter(Boolean).join(' · '),
    ].filter(Boolean),
  }
}

/** Fiche de l'émetteur : entreprise complète si l'utilisateur peut la lire (partie ou plateforme), sinon fiche publique. */
async function partieEntreprise(role: string, id: string | null): Promise<PartieDocument> {
  if (!id) return { role, nom: '—', lignes: [], logo: null }
  const supabase = await createClient()
  const { data } = await supabase.from('entreprises').select('*').eq('id', id).maybeSingle()
  if (data) return partieClient(role, data as Entete)
  const { data: publique } = await supabase.rpc('producteurs_publics').select('denomination, commune, region, logo_path').eq('id', id).maybeSingle()
  const { data: banque } = publique ? { data: null } : await supabase.rpc('banques_publiques').select('denomination, logo_path').eq('id', id).maybeSingle()
  const p = (publique ?? banque ?? {}) as Entete
  return { role, nom: p.denomination ?? '—', logo: urlLogo(p.logo_path ?? null), lignes: [[p.commune, p.region].filter(Boolean).join(', ')].filter(Boolean) }
}

async function jeton(type: TypeDocument, id: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('documents').select('jeton_public').eq('type', type).eq('document_id', id).maybeSingle()
  return data?.jeton_public ? { url: urlVerification(data.jeton_public), jeton: data.jeton_public } : null
}

async function mentions() {
  const supabase = await createClient()
  const { data } = await supabase.from('parametres_plateforme').select('mentions_legales').maybeSingle()
  return data?.mentions_legales ?? null
}

type LigneProduit = { quantite: number; prix_unitaire: number; montant?: number; produits: { nom: string; unite: string } | null }

function lignesProduits(lignes: LigneProduit[]) {
  return lignes.map((l) => [
    l.produits?.nom ?? '',
    formatQuantite(l.quantite, l.produits?.unite),
    formatMontant(l.prix_unitaire),
    formatMontant(l.montant ?? Math.round(Number(l.quantite) * l.prix_unitaire)),
  ])
}

const COLONNES_PRODUITS = [{ libelle: 'Produit' }, { libelle: 'Quantité', nombre: true }, { libelle: 'Prix unitaire', nombre: true }, { libelle: 'Montant', nombre: true }]

/** Modèle imprimable d'un document, ou null s'il n'existe pas ou n'est pas visible par l'utilisateur (RLS). */
export async function chargerModele(type: string, id: string): Promise<ModeleDocument | null> {
  const supabase = await createClient()

  if (type === 'commande') {
    const { data: c } = await supabase.from('commandes').select('*').eq('id', id).maybeSingle()
    if (!c) return null
    const [{ data: lignes }, { data: echeancier }] = await Promise.all([
      supabase.from('lignes_commande').select('quantite, prix_unitaire, montant, produits(nom, unite)').eq('commande_id', id).returns<LigneProduit[]>(),
      supabase.from('echeancier_commande').select('rang, pourcentage, delai_jours').eq('commande_id', id).order('rang'),
    ])
    return {
      titre: 'Bon de commande',
      numero: c.numero,
      date: formatDate(c.soumise_le),
      parties: [partieClient('Client (donneur d’ordre)', c.entete_client), await partieEntreprise('Producteur (fournisseur)', c.producteur_id)],
      infos: [
        ['Livraison souhaitée', c.date_souhaitee ? formatDate(c.date_souhaitee) : '—'],
        ['Livraison convenue', c.date_livraison_convenue ? formatDate(c.date_livraison_convenue) : 'À fixer par le superviseur'],
        ['Adresse de livraison', [c.adresse_livraison, c.region_livraison].filter(Boolean).join(', ')],
        ['Mode de paiement', MODES_PAIEMENT[c.mode_paiement] ?? c.mode_paiement],
      ],
      colonnes: COLONNES_PRODUITS,
      lignes: lignesProduits(lignes ?? []),
      totaux: [['Total', formatMontant(c.montant_total)]],
      enLettres: montantEnLettres(c.montant_total),
      blocs: [
        {
          titre: 'Échéancier convenu',
          lignes: (echeancier ?? []).map(
            (e) => `${Number(e.pourcentage).toLocaleString('fr-FR')} % ${e.delai_jours === 0 ? 'à réception' : `à ${e.delai_jours} jours`} de la facture définitive : ${formatMontant(Math.round((c.montant_total * Number(e.pourcentage)) / 100))}`
          ),
        },
        ...(c.commentaire ? [{ titre: 'Commentaire', lignes: [c.commentaire] }] : []),
      ],
      visas: ['Le client', 'Le superviseur (approbation)', 'Le producteur (validation)'],
      mentions: await mentions(),
      qr: await jeton('commande', id),
      nomFichier: `Commande-${c.numero}.pdf`,
    }
  }

  if (type === 'bon_paiement') {
    const { data: b } = await supabase.from('bons_paiement').select('*, commandes(numero, entete_client, producteur_id, date_livraison_convenue)').eq('id', id).maybeSingle()
    if (!b) return null
    const c = b.commandes as { numero: string; entete_client: Entete; producteur_id: string; date_livraison_convenue: string | null }
    return {
      titre: 'Bon de paiement',
      numero: b.numero,
      date: formatDate(b.created_at),
      parties: [
        await partieEntreprise('Banque', b.banque_id),
        partieClient('Donneur d’ordre (client)', c.entete_client),
        await partieEntreprise('Bénéficiaire (producteur)', c.producteur_id),
      ],
      infos: [
        ['Commande', c.numero],
        ['Livraison convenue', formatDate(c.date_livraison_convenue)],
        ['Décision', b.statut === 'approuve' ? `Approuvé le ${formatDate(b.decide_le)}` : b.statut === 'refuse' ? `Refusé le ${formatDate(b.decide_le)}` : 'En attente'],
        ['Référence bancaire', b.reference_bancaire ?? '—'],
      ],
      colonnes: [],
      lignes: [],
      totaux: [['Montant', formatMontant(b.montant)]],
      enLettres: montantEnLettres(b.montant),
      blocs: b.commentaire ? [{ titre: b.statut === 'refuse' ? 'Motif du refus' : 'Commentaire de la banque', lignes: [b.commentaire] }] : [],
      visas: ['La banque'],
      mentions: await mentions(),
      qr: await jeton('bon_paiement', id),
      nomFichier: `Bon-de-paiement-${b.numero}.pdf`,
    }
  }

  if (type === 'bon_livraison' || type === 'bon_reception') {
    const blId =
      type === 'bon_livraison' ? id : ((await supabase.from('bons_reception').select('bl_id').eq('id', id).maybeSingle()).data?.bl_id as string | undefined)
    if (!blId) return null
    const [{ data: bl }, { data: lignes }, { data: br }] = await Promise.all([
      supabase.from('bons_livraison').select('*, commandes(numero, entete_client, adresse_livraison, contact_livraison)').eq('id', blId).maybeSingle(),
      supabase.from('bl_lignes').select('id, quantite, prix_unitaire, produits(nom, unite)').eq('bl_id', blId).returns<(LigneProduit & { id: string })[]>(),
      supabase.from('bons_reception').select('id, numero, statut, receptionne_le, commentaire, motif_litige, commentaire_arbitrage, arbitre_le, br_lignes(bl_ligne_id, quantite_recue, motif_ecart)').eq('bl_id', blId).maybeSingle(),
    ])
    if (!bl) return null
    const c = bl.commandes as { numero: string; entete_client: Entete; adresse_livraison: string; contact_livraison: string | null }
    const recues = new Map(((br?.br_lignes ?? []) as { bl_ligne_id: string; quantite_recue: number; motif_ecart: string | null }[]).map((r) => [r.bl_ligne_id, r]))
    const parties = [await partieEntreprise('Producteur (expéditeur)', bl.producteur_id), partieClient('Client (destinataire)', c.entete_client)]
    const transport: [string, string][] = [
      ['Commande', c.numero],
      ['Date de livraison', formatDate(bl.date_livraison)],
      ['Adresse de livraison', c.adresse_livraison],
      ['Transport', [bl.transporteur, bl.immatriculation, bl.chauffeur].filter(Boolean).join(' · ') || '—'],
    ]
    if (type === 'bon_livraison') {
      return {
        titre: 'Bon de livraison',
        numero: bl.numero,
        date: formatDate(bl.date_livraison),
        parties,
        infos: transport,
        colonnes: [{ libelle: 'Produit' }, { libelle: 'Quantité livrée', nombre: true }, { libelle: 'Quantité reçue', nombre: true }],
        lignes: (lignes ?? []).map((l) => [l.produits?.nom ?? '', formatQuantite(l.quantite, l.produits?.unite), recues.has(l.id) ? formatQuantite(recues.get(l.id)!.quantite_recue) : '']),
        totaux: [],
        blocs: bl.commentaire ? [{ titre: 'Commentaire du producteur', lignes: [bl.commentaire] }] : [],
        visas: ['Le livreur', 'Le réceptionnaire (client)'],
        mentions: await mentions(),
        qr: await jeton('bon_livraison', blId),
        nomFichier: `Bon-de-livraison-${bl.numero}.pdf`,
      }
    }
    if (!br) return null
    return {
      titre: 'Bon de réception',
      numero: br.numero,
      date: formatDate(br.receptionne_le ?? bl.date_livraison),
      parties: [partieClient('Client (réceptionnaire)', c.entete_client), parties[0]],
      infos: [...transport, ['Bon de livraison', bl.numero]],
      colonnes: [{ libelle: 'Produit' }, { libelle: 'Livré', nombre: true }, { libelle: 'Reçu', nombre: true }, { libelle: 'Écart', nombre: true }, { libelle: 'Motif' }],
      lignes: (lignes ?? []).map((l) => {
        const r = recues.get(l.id)
        return [
          l.produits?.nom ?? '',
          formatQuantite(l.quantite, l.produits?.unite),
          r ? formatQuantite(r.quantite_recue) : '',
          r ? formatQuantite(Number(r.quantite_recue) - Number(l.quantite)) : '',
          r?.motif_ecart ?? '',
        ]
      }),
      totaux: [],
      blocs: [
        ...(br.commentaire ? [{ titre: 'Commentaire d’approbation', lignes: [br.commentaire] }] : []),
        ...(br.motif_litige ? [{ titre: 'Contestation', lignes: [br.motif_litige] }] : []),
        ...(br.commentaire_arbitrage ? [{ titre: `Arbitrage du superviseur (${formatDate(br.arbitre_le)})`, lignes: [br.commentaire_arbitrage] }] : []),
        ...(br.statut === 'tacite' ? [{ titre: 'Réception tacite', lignes: ['Réception réputée conforme au bon de livraison : aucune réponse du client dans le délai.'] }] : []),
      ],
      visas: ['Le réceptionnaire (client)'],
      mentions: await mentions(),
      qr: await jeton('bon_reception', br.id),
      nomFichier: `Bon-de-reception-${br.numero}.pdf`,
    }
  }

  if (type === 'facture') {
    const { data: f } = await supabase.from('factures').select('*, commandes(numero, entete_client, mode_paiement), bons_livraison(numero)').eq('id', id).maybeSingle()
    if (!f) return null
    const c = f.commandes as { numero: string; entete_client: Entete; mode_paiement: string }
    const [{ data: lignes }, { data: echeances }] = await Promise.all([
      supabase.from('lignes_facture').select('quantite, prix_unitaire, montant, produits(nom, unite)').eq('facture_id', id).returns<LigneProduit[]>(),
      supabase.from('echeances').select('rang, date_echeance, montant, statut, payee_le, mode_reglement').eq('facture_id', id).order('rang'),
    ])
    const compte = f.compte_bancaire as { banque?: string; intitule?: string; numero_compte?: string; code_swift?: string | null } | null
    const provisoire = f.nature === 'provisoire'
    return {
      titre: provisoire ? 'Facture provisoire' : 'Facture',
      numero: f.numero,
      date: formatDate(f.date_facture),
      filigrane: provisoire ? 'PROVISOIRE' : undefined,
      parties: [await partieEntreprise('Producteur (émetteur)', f.producteur_id), partieClient('Client', c.entete_client)],
      infos: [
        ['Commande', c.numero],
        ...(f.bons_livraison ? [['Bon de livraison', (f.bons_livraison as { numero: string }).numero] as [string, string]] : []),
        ['Mode de paiement', MODES_PAIEMENT[c.mode_paiement] ?? c.mode_paiement],
        ['Base', provisoire ? 'Quantités livrées — non exigible' : 'Quantités reçues'],
      ],
      colonnes: COLONNES_PRODUITS,
      lignes: lignesProduits(lignes ?? []),
      totaux: [['Total', formatMontant(f.montant_total)], ...(f.mention_tva ? [['TVA', f.mention_tva] as [string, string]] : [])],
      enLettres: `Arrêtée la présente facture à la somme de : ${montantEnLettres(f.montant_total).replace(/^./, (c) => c.toLowerCase())}`,
      blocs: [
        ...(!provisoire && (echeances ?? []).length
          ? [
              {
                titre: 'Échéances',
                lignes: echeances!.map(
                  (e) =>
                    `${e.rang}. ${formatDate(e.date_echeance)} : ${formatMontant(e.montant)}${e.statut === 'payee' ? ` — payée le ${formatDate(e.payee_le)} (${MODES_REGLEMENT[e.mode_reglement ?? 'autre']})` : ''}`
                ),
              },
            ]
          : []),
        ...(compte?.numero_compte
          ? [{ titre: 'Coordonnées bancaires du producteur', lignes: [`${compte.banque} — ${compte.intitule}`, compte.numero_compte, ...(compte.code_swift ? [`SWIFT / BIC : ${compte.code_swift}`] : [])] }]
          : []),
        ...(provisoire ? [{ titre: 'Facture provisoire', lignes: ['Non exigible. La facture définitive sera établie sur les quantités reçues et approuvées par le client.'] }] : []),
      ],
      visas: provisoire ? [] : ['Le producteur'],
      mentions: await mentions(),
      qr: await jeton('facture', id),
      nomFichier: `Facture-${f.numero}.pdf`,
    }
  }

  return null
}
