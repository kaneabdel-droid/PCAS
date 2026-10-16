'use server'

import { createClient } from '@/utils/supabase/server'
import { exigerAdmin } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

export async function importerDonneesPcas(
  typeId: 'produits' | 'entreprises' | 'sites' | 'offres',
  records: any[]
): Promise<{ succes: number; erreurs: number; details: string[] }> {
  try {
    await exigerAdmin()
    const supabase = await createClient()

    let succes = 0
    let erreurs = 0
    const details: string[] = []

    if (!records || !Array.isArray(records) || records.length === 0) {
      return { succes: 0, erreurs: 0, details: ['Aucun enregistrement valide à importer.'] }
    }

    if (typeId === 'produits') {
      const categoriesValides = ['Céréales', 'Légumes', 'Tubercules', 'Fruits', 'Fruits à coque', 'Autres']
      const unitesValides = ['kg', 'tonne', 'sac de 25 kg', 'sac de 50 kg', 'caisse', 'régime', 'pièce']

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nom = (r.nom || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Le nom du produit est obligatoire.`)
          continue
        }

        let categorie = (r.categorie || 'Autres').toString().trim()
        if (!categoriesValides.includes(categorie)) {
          const found = categoriesValides.find(c => c.toLowerCase() === categorie.toLowerCase())
          categorie = found || 'Autres'
        }

        let nature = (r.nature || 'produit_fini').toString().toLowerCase().trim()
        if (nature !== 'matiere_premiere' && nature !== 'produit_fini') nature = 'produit_fini'

        let unite = (r.unite || 'kg').toString().trim()
        if (!unitesValides.includes(unite)) {
          const found = unitesValides.find(u => u.toLowerCase() === unite.toLowerCase())
          unite = found || 'kg'
        }

        const description = (r.description || '').toString().trim() || null

        const { error } = await supabase.from('produits').upsert(
          {
            nom,
            categorie,
            nature,
            unite,
            description,
            actif: true
          },
          { onConflict: 'nom' }
        )

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nom}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/admin/produits')
      revalidatePath('/marche')
    } else if (typeId === 'entreprises') {
      const typesValides = ['producteur', 'client', 'banque']

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const denomination = (r.denomination || r.nom || '').toString().trim()

        if (!denomination) {
          erreurs++
          details.push(`Ligne ${i + 1} : La dénomination de l'entreprise est obligatoire.`)
          continue
        }

        let type = (r.type || 'producteur').toString().toLowerCase().trim()
        if (!typesValides.includes(type)) type = 'producteur'

        const sigle = (r.sigle || '').toString().trim() || null
        const telephone = (r.telephone || r.tel || '').toString().trim() || null
        const email = (r.email || '').toString().trim() || null
        const region = (r.region || '').toString().trim() || null
        const departement = (r.departement || '').toString().trim() || null
        const identifiantFiscal = (r.identifiant_fiscal || r.ninea || '').toString().trim() || null

        const { error } = await supabase.from('entreprises').insert({
          denomination,
          type,
          sigle,
          telephone,
          email,
          region,
          departement,
          identifiant_fiscal: identifiantFiscal,
          pays: 'SN',
          statut: 'actif'
        })

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${denomination}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/admin/entreprises')
    } else if (typeId === 'sites') {
      const { data: prods } = await supabase
        .from('entreprises')
        .select('id, denomination')
        .eq('type', 'producteur')

      const defautProdId = prods && prods.length > 0 ? prods[0].id : null

      if (!defautProdId) {
        return {
          succes: 0,
          erreurs: records.length,
          details: ["Aucune entreprise de type producteur trouvée. Veuillez d'abord créer ou importer les entreprises."]
        }
      }

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nom = (r.nom || '').toString().trim()

        if (!nom) {
          erreurs++
          details.push(`Ligne ${i + 1} : Le nom du site est obligatoire.`)
          continue
        }

        let prodId = defautProdId
        const entRef = (r.entreprise || r.producteur || '').toString().trim().toLowerCase()
        if (entRef && prods) {
          const match = prods.find(p => p.denomination.toLowerCase().includes(entRef) || p.id === entRef)
          if (match) prodId = match.id
        }

        const region = (r.region || '').toString().trim() || null
        const departement = (r.departement || '').toString().trim() || null
        const commune = (r.commune || '').toString().trim() || null
        const localite = (r.localite || '').toString().trim() || null
        const sup = parseFloat(r.superficie_ha || '0')

        const { error } = await supabase.from('sites_production').insert({
          entreprise_id: prodId,
          nom,
          region,
          departement,
          commune,
          localite,
          superficie_ha: isNaN(sup) ? 0 : sup,
          actif: true
        })

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nom}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/sites')
    } else if (typeId === 'offres') {
      const [{ data: prods }, { data: sites }, { data: produitsCatalogue }] = await Promise.all([
        supabase.from('entreprises').select('id, denomination').eq('type', 'producteur'),
        supabase.from('sites_production').select('id, entreprise_id'),
        supabase.from('produits').select('id, nom')
      ])

      if (!prods || prods.length === 0 || !sites || sites.length === 0) {
        return {
          succes: 0,
          erreurs: records.length,
          details: ["Producteurs ou sites de production manquants pour créer des offres."]
        }
      }

      const produitsMap = new Map<string, string>()
      if (produitsCatalogue) {
        produitsCatalogue.forEach(p => produitsMap.set(p.nom.trim().toLowerCase(), p.id))
      }

      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const nomProd = (r.produit || r.nom || '').toString().trim()

        const produitId = produitsMap.get(nomProd.toLowerCase())
        if (!produitId) {
          erreurs++
          details.push(`Ligne ${i + 1} : Produit « ${nomProd} » introuvable dans le catalogue.`)
          continue
        }

        // Trouver producteur et site
        let prodId = prods[0].id
        const entRef = (r.entreprise || r.producteur || '').toString().trim().toLowerCase()
        if (entRef) {
          const match = prods.find(p => p.denomination.toLowerCase().includes(entRef) || p.id === entRef)
          if (match) prodId = match.id
        }

        const site = sites.find(s => s.entreprise_id === prodId) || sites[0]

        const prix = parseInt(r.prix_unitaire || r.prix || '0', 10)
        const qte = parseFloat(r.quantite_offerte || r.quantite || '0')

        if (isNaN(prix) || prix <= 0 || isNaN(qte) || qte <= 0) {
          erreurs++
          details.push(`Ligne ${i + 1} : Prix et quantité doivent être des nombres strictement positifs.`)
          continue
        }

        let dispo = (r.disponibilite || 'immediate').toString().toLowerCase().trim()
        if (!['immediate', 'court_terme', 'moyen_terme'].includes(dispo)) dispo = 'immediate'

        const variete = (r.variete || '').toString().trim() || null
        const conditionnement = (r.conditionnement || '').toString().trim() || null

        const { error } = await supabase.from('offres').insert({
          producteur_id: prodId,
          site_id: site.id,
          produit_id: produitId,
          prix_unitaire: prix,
          quantite_offerte: qte,
          disponibilite: dispo,
          variete,
          conditionnement,
          statut: 'publiee',
          publiee_le: new Date().toISOString()
        })

        if (error) {
          erreurs++
          details.push(`Ligne ${i + 1} (${nomProd}) : ${error.message}`)
        } else {
          succes++
        }
      }

      revalidatePath('/offres')
      revalidatePath('/marche')
    }

    return { succes, erreurs, details }
  } catch (err: any) {
    return {
      succes: 0,
      erreurs: records.length,
      details: [`Erreur inattendue : ${err?.message || 'Erreur inconnue'}`]
    }
  }
}
