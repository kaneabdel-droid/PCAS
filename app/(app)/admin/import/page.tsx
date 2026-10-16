import { exigerAdmin } from '@/lib/admin'
import { AssistantImport, type TypeImportOption } from '@/components/admin/AssistantImport'
import { importerDonneesPcas } from './actions'

const OPTIONS_PCAS: TypeImportOption[] = [
  {
    id: 'produits',
    titre: 'Catalogue Produits',
    description: 'Importez les produits agricoles (céréales, légumes, fruits, tubercules) avec leurs unités et natures (matière première ou produit fini).',
    icone: 'produits',
    nomFichierModele: 'modele_import_produits.csv',
    modeleCSV: `nom,categorie,nature,unite,description
Riz Paddy Local,Céréales,matiere_premiere,kg,Riz paddy brut récolté dans la vallée du fleuve
Riz Blanc Brisé 50kg,Céréales,produit_fini,sac de 50 kg,Riz blanc de qualité supérieure 100% brisé
Oignon Local Gandon,Légumes,produit_fini,sac de 25 kg,Oignon violet de Gandon séché et calibré
Pomme de terre du Walo,Tubercules,produit_fini,sac de 25 kg,Variété Sahel gros calibre`
  },
  {
    id: 'entreprises',
    titre: 'Entreprises Adhérentes',
    description: 'Importez les producteurs, clients acheteurs et banques partenaires avec leurs coordonnées et identifiants fiscaux.',
    icone: 'entreprises',
    nomFichierModele: 'modele_import_entreprises.csv',
    modeleCSV: `denomination,type,sigle,telephone,email,region,departement,identifiant_fiscal
Fédération des Producteurs du Delta,producteur,FPD,771234567,contact@fpd-senegal.org,Saint-Louis,Dagana,NINEA-123456789
Centrale d'Achat Alimentaire Dakar,client,CAAD,782345678,achats@caad.sn,Dakar,Dakar,NINEA-987654321
Banque Agricole du Sénégal,banque,LBA,338890000,contact@labanqueagricole.sn,Dakar,Dakar,NINEA-555666777`
  },
  {
    id: 'sites',
    titre: 'Sites de Production',
    description: 'Importez les périmètres agricoles, fermes et stations de conditionnement des producteurs.',
    icone: 'sites',
    nomFichierModele: 'modele_import_sites.csv',
    modeleCSV: `nom,region,departement,commune,localite,superficie_ha
Périmètre Irrigué de Dagana,Saint-Louis,Dagana,Dagana,Kassak Nord,150.5
Station Agricole de Ross Béthio,Saint-Louis,Dagana,Ross Béthio,Pont Gendarmerie,85.0
Domaine Maraîcher de Mbane,Saint-Louis,Dagana,Mbane,Bord du Lac,45.0`
  },
  {
    id: 'offres',
    titre: 'Offres de Vente',
    description: 'Importez les offres de vente pour approvisionner la place de marché.',
    icone: 'offres',
    nomFichierModele: 'modele_import_offres.csv',
    modeleCSV: `produit,prix_unitaire,quantite_offerte,disponibilite,variete,conditionnement
Riz Blanc Brisé 50kg,17500,200,immediate,Sahel 108,sac de 50 kg
Oignon Local Gandon,8500,150,immediate,Violet de Gandon,sac de 25 kg
Pomme de terre du Walo,11000,100,court_terme,Sahel,sac de 25 kg`
  }
]

export default async function ImportPcasPage() {
  await exigerAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Importation des données de la plateforme
        </h1>
        <p className="text-sm text-foreground-muted mt-1">
          Intégrez en masse les catalogues de produits, entreprises adhérentes, sites et offres sur PCAS.
        </p>
      </div>

      <AssistantImport
        nomApplication="PCAS"
        titreModule="Plateforme de Commercialisation Agricole"
        optionsTypes={OPTIONS_PCAS}
        onImporter={importerDonneesPcas as any}
      />
    </div>
  )
}
