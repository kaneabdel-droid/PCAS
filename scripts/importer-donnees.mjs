#!/usr/bin/env node
/**
 * Agent CLI d'importation de données existantes pour PCAS (Plateforme de Commercialisation Agricole du Sénégal).
 * 
 * Usage :
 *   node scripts/importer-donnees.mjs --modele=produits|entreprises|sites|offres
 *   node scripts/importer-donnees.mjs --type=produits|entreprises|sites|offres --fichier=donnees.csv [--entreprise="Nom producteur"]
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const MODELES = {
  produits: `nom,categorie,nature,unite,description
Riz Paddy Local,Céréales,matiere_premiere,kg,Riz paddy brut récolté dans la vallée du fleuve
Riz Blanc Brisé 50kg,Céréales,produit_fini,sac de 50 kg,Riz blanc de qualité supérieure 100% brisé
Oignon Local Gandon,Légumes,produit_fini,sac de 25 kg,Oignon violet de Gandon séché et calibré
Pomme de terre du Walo,Tubercules,produit_fini,sac de 25 kg,Variété Sahel gros calibre`,

  entreprises: `denomination,type,sigle,telephone,email,region,departement,identifiant_fiscal
Fédération des Producteurs du Delta,producteur,FPD,771234567,contact@fpd-senegal.org,Saint-Louis,Dagana,NINEA-123456789
Centrale d'Achat Alimentaire Dakar,client,CAAD,782345678,achats@caad.sn,Dakar,Dakar,NINEA-987654321
Banque Agricole du Sénégal,banque,LBA,338890000,contact@labanqueagricole.sn,Dakar,Dakar,NINEA-555666777`,

  sites: `nom,region,departement,commune,localite,superficie_ha
Périmètre Irrigué de Dagana,Saint-Louis,Dagana,Dagana,Kassak Nord,150.5
Station Agricole de Ross Béthio,Saint-Louis,Dagana,Ross Béthio,Pont Gendarmerie,85.0
Domaine Maraîcher de Mbane,Saint-Louis,Dagana,Mbane,Bord du Lac,45.0`,

  offres: `produit,prix_unitaire,quantite_offerte,disponibilite,variete,conditionnement
Riz Blanc Brisé 50kg,17500,200,immediate,Sahel 108,sac de 50 kg
Oignon Local Gandon,8500,150,immediate,Violet de Gandon,sac de 25 kg
Pomme de terre du Walo,11000,100,court_terme,Sahel,sac de 25 kg`
}

function parseCSV(content) {
  const clean = content.replace(/^\uFEFF/, '').trim()
  const lines = clean.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) return []

  const separator = lines[0].includes(';') ? ';' : ','

  function parseLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === separator && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
  const records = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    if (values.length === 0 || (values.length === 1 && !values[0])) continue
    const obj = {}
    headers.forEach((header, idx) => {
      let val = values[idx] !== undefined ? values[idx] : ''
      val = val.replace(/^["']|["']$/g, '')
      obj[header] = val
    })
    records.push(obj)
  }

  return records
}

function parseArgs() {
  const args = process.argv.slice(2)
  const params = {}
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx)
        const val = arg.slice(eqIdx + 1)
        params[key] = val
      } else {
        params[arg.slice(2)] = true
      }
    }
  }
  return params
}

async function main() {
  const args = parseArgs()

  if (args.modele) {
    const type = args.modele.toLowerCase()
    const content = MODELES[type]
    if (!content) {
      console.error(`Type de modèle invalide. Choix possibles : ${Object.keys(MODELES).join(', ')}`)
      process.exit(1)
    }
    const filename = `modele_import_pcas_${type}.csv`
    writeFileSync(filename, content, 'utf8')
    console.log(`✓ Fichier modèle généré avec succès : ${filename}`)
    return
  }

  if (!args.fichier || !args.type) {
    console.log(`
Agent d'importation de données - PCAS
====================================
Usage :
  1. Générer un modèle CSV :
     node scripts/importer-donnees.mjs --modele=produits|entreprises|sites|offres

  2. Importer des données :
     node scripts/importer-donnees.mjs --type=produits|entreprises|sites|offres --fichier=chemin/vers/fichier.csv [--entreprise="Nom"]
    `)
    return
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Erreur : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants.")
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const filePath = resolve(args.fichier)
  if (!existsSync(filePath)) {
    console.error(`Fichier introuvable : ${filePath}`)
    process.exit(1)
  }

  const rawFile = readFileSync(filePath, 'utf8')
  let records = []
  if (filePath.endsWith('.json')) {
    records = JSON.parse(rawFile)
  } else {
    records = parseCSV(rawFile)
  }

  console.log(`✓ ${records.length} ligne(s) chargée(s). Début de l'importation (${args.type})...\n`)

  let reussis = 0
  let erreurs = 0

  if (args.type === 'produits') {
    const categoriesValides = ['Céréales', 'Légumes', 'Tubercules', 'Fruits', 'Fruits à coque', 'Autres']
    const unitesValides = ['kg', 'tonne', 'sac de 25 kg', 'sac de 50 kg', 'caisse', 'régime', 'pièce']

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const nom = (r.nom || '').trim()

      if (!nom) {
        erreurs++
        console.error(`Ligne ${i + 1} : Nom du produit obligatoire.`)
        continue
      }

      let categorie = (r.categorie || 'Autres').trim()
      if (!categoriesValides.includes(categorie)) {
        const found = categoriesValides.find(c => c.toLowerCase() === categorie.toLowerCase())
        categorie = found || 'Autres'
      }

      let nature = (r.nature || 'produit_fini').toLowerCase().trim()
      if (nature !== 'matiere_premiere' && nature !== 'produit_fini') nature = 'produit_fini'

      let unite = (r.unite || 'kg').trim()
      if (!unitesValides.includes(unite)) {
        const found = unitesValides.find(u => u.toLowerCase() === unite.toLowerCase())
        unite = found || 'kg'
      }

      const description = (r.description || '').trim() || null

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
        console.error(`Ligne ${i + 1} (${nom}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  } else if (args.type === 'entreprises') {
    const typesValides = ['producteur', 'client', 'banque']

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const denomination = (r.denomination || r.nom || '').trim()

      if (!denomination) {
        erreurs++
        console.error(`Ligne ${i + 1} : Dénomination de l'entreprise obligatoire.`)
        continue
      }

      let type = (r.type || 'producteur').toLowerCase().trim()
      if (!typesValides.includes(type)) type = 'producteur'

      const sigle = (r.sigle || '').trim() || null
      const telephone = (r.telephone || r.tel || '').trim() || null
      const email = (r.email || '').trim() || null
      const region = (r.region || '').trim() || null
      const departement = (r.departement || '').trim() || null
      const identifiantFiscal = (r.identifiant_fiscal || r.ninea || '').trim() || null

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
        console.error(`Ligne ${i + 1} (${denomination}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  } else if (args.type === 'sites') {
    // Résoudre l'entreprise productrice
    let entrepriseId = args.entreprise_id
    if (!entrepriseId && args.entreprise) {
      const { data: orgs } = await supabase
        .from('entreprises')
        .select('id, denomination')
        .eq('type', 'producteur')
        .or(`denomination.ilike.%${args.entreprise}%,id.eq.${args.entreprise}`)
        .limit(1)

      if (orgs && orgs.length > 0) {
        entrepriseId = orgs[0].id
        console.log(`✓ Entreprise productrice sélectionnée : ${orgs[0].denomination} (${entrepriseId})`)
      }
    }

    if (!entrepriseId) {
      // Prendre le premier producteur disponible
      const { data: prods } = await supabase.from('entreprises').select('id, denomination').eq('type', 'producteur').limit(1)
      if (prods && prods.length > 0) {
        entrepriseId = prods[0].id
        console.log(`✓ Aucun producteur précisé, affectation par défaut à : ${prods[0].denomination}`)
      } else {
        console.error("Erreur : Aucun producteur trouvé. Créez d'abord une entreprise de type 'producteur'.")
        process.exit(1)
      }
    }

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const nom = (r.nom || '').trim()

      if (!nom) {
        erreurs++
        console.error(`Ligne ${i + 1} : Nom du site obligatoire.`)
        continue
      }

      const region = (r.region || '').trim() || null
      const departement = (r.departement || '').trim() || null
      const commune = (r.commune || '').trim() || null
      const localite = (r.localite || '').trim() || null
      const sup = parseFloat(r.superficie_ha || '0')

      const { error } = await supabase.from('sites_production').insert({
        entreprise_id: entrepriseId,
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
        console.error(`Ligne ${i + 1} (${nom}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  } else if (args.type === 'offres') {
    // Récupérer un producteur et son premier site
    let entrepriseId = args.entreprise_id
    if (!entrepriseId && args.entreprise) {
      const { data: orgs } = await supabase
        .from('entreprises')
        .select('id, denomination')
        .eq('type', 'producteur')
        .or(`denomination.ilike.%${args.entreprise}%,id.eq.${args.entreprise}`)
        .limit(1)
      if (orgs && orgs.length > 0) entrepriseId = orgs[0].id
    }

    if (!entrepriseId) {
      const { data: prods } = await supabase.from('entreprises').select('id').eq('type', 'producteur').limit(1)
      if (prods && prods.length > 0) entrepriseId = prods[0].id
    }

    if (!entrepriseId) {
      console.error("Erreur : Aucun producteur enregistré.")
      process.exit(1)
    }

    // Récupérer un site de ce producteur
    const { data: sites } = await supabase.from('sites_production').select('id').eq('entreprise_id', entrepriseId).limit(1)
    if (!sites || sites.length === 0) {
      console.error("Erreur : Le producteur n'a aucun site de production configuré.")
      process.exit(1)
    }
    const siteId = sites[0].id

    // Cache des produits
    const { data: prods } = await supabase.from('produits').select('id, nom')
    const prodsMap = new Map()
    if (prods) {
      prods.forEach(p => prodsMap.set(p.nom.trim().toLowerCase(), p.id))
    }

    for (let i = 0; i < records.length; i++) {
      const r = records[i]
      const nomProd = (r.produit || r.nom || '').trim()

      const produitId = prodsMap.get(nomProd.toLowerCase())
      if (!produitId) {
        erreurs++
        console.error(`Ligne ${i + 1} : Produit « ${nomProd} » introuvable dans le catalogue.`)
        continue
      }

      const prix = parseInt(r.prix_unitaire || r.prix || '0', 10)
      const qte = parseFloat(r.quantite_offerte || r.quantite || '0')

      if (isNaN(prix) || prix <= 0 || isNaN(qte) || qte <= 0) {
        erreurs++
        console.error(`Ligne ${i + 1} : Prix et quantité doivent être positifs.`)
        continue
      }

      let dispo = (r.disponibilite || 'immediate').toLowerCase().trim()
      if (!['immediate', 'court_terme', 'moyen_terme'].includes(dispo)) dispo = 'immediate'

      const variete = (r.variete || '').trim() || null
      const conditionnement = (r.conditionnement || '').trim() || null

      const { error } = await supabase.from('offres').insert({
        producteur_id: entrepriseId,
        site_id: siteId,
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
        console.error(`Ligne ${i + 1} (${nomProd}) : ${error.message}`)
      } else {
        reussis++
      }
    }
  }

  console.log(`\nImportation terminée : ${reussis} succès, ${erreurs} échec(s).`)
}

main().catch(err => {
  console.error("Erreur inattendue :", err)
  process.exit(1)
})
