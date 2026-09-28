# Plan d'implémentation — PCAS

**Plateforme de Commercialisation Agricole du Sénégal** — produit DembaSolution.
Mise en relation producteurs agricoles ↔ clients (entreprises) : offres de produits finis, commandes, besoins d'achat, circuit d'approbation, livraison, réception, facturation, échéances de paiement, traçabilité par QR code.
Hébergement cible : `pcas.dembasolution.com`. Devise unique : **FCFA (XOF), sans décimales**.
Langue : **français uniquement** (textes écrits directement en français, sans couche de traduction).
Versions : **application web responsive + application mobile (Android / iOS) + installation poste de travail Windows et Mac**, en mode **toujours connecté** (pas de hors-ligne — décision prise pour garantir qu'aucun stock inexistant ne puisse être vendu).
Le mode de monétisation (abonnement ou vente directe / commission) sera spécifié plus tard : le plan réserve l'emplacement (§ 12) sans l'implémenter.

---

## 0. Décisions structurantes

### 0.1 Nouveau dépôt, fondations reprises de D-AGROBUSINESS

Le métier de PCAS (place de marché + circuit documentaire) n'a rien de commun avec la gestion interne d'une exploitation : **on ne forke pas** une application existante. En revanche, on **copie les fondations transverses** de `d-agrobusiness/`, déjà éprouvées en production :

| Brique reprise | Source D-AGROBUSINESS | Adaptation PCAS |
|---|---|---|
| Shell façon Slack (barre latérale, en-tête entreprise, thèmes) | `components/AppShell.tsx`, `app/globals.css` (tokens sémantiques `bg-surface`, `text-foreground`…) | Nouvelle identité de couleurs, menus par rôle |
| Registre unique des menus + matrice de permissions | `lib/menus.ts`, `lib/permissions.ts`, migration `37_permissions_menus.sql` | Sert de base aux « profils personnalisés » (§ 3.2) |
| Contexte de session mis en cache | `lib/session.ts` (`getContexte`, `getClaims`) | Contexte = utilisateur + rôle + entreprise + type d'entreprise |
| Impression HTML navigateur + PDF jsPDF | `lib/impression.ts`, `components/DocumentsImprimables.tsx`, `jspdf-autotable` | Généralisé en moteur d'états (§ 8), sans la partie arabe / RTL |
| Super-admin séparé (`/admin`, login dédié) | `app/admin/(protected)/*`, `utils/supabase/admin.ts` | Devient le dashboard Administrateur |
| Proxy de session Next 16 | `proxy.ts`, `utils/supabase/{server,client,middleware}.ts` | Inscription publique **désactivée** |
| Scripts d'audit | `scripts/audit-securite.mjs`, `audit-index.mjs`, `seed-demo.mjs` | Réécrits pour le schéma PCAS |

**Non repris** : la couche i18n (`lib/i18n*.ts`, `I18nProvider`, `LanguageSwitcher`, `verifier-i18n.mjs`). PCAS est **en français seulement** : les textes sont écrits en dur, comme dans les pages de SIGGIE.

### 0.2 Pile technique

- **Next.js 16 (App Router) + React 19 + TypeScript**, Tailwind CSS v4, shadcn/ui (Radix), `lucide-react` — même pile que les autres produits.
- **Supabase** (projet **dédié** PCAS) : PostgreSQL + Auth + **Storage** (logos, pièces jointes, PDF archivés) + **Realtime** (notifications en direct).
- `qrcode` (génération des QR), `jspdf` + `jspdf-autotable` (téléchargement PDF), impression navigateur (états et documents).
- Déploiement Vercel ; e-mails transactionnels via Supabase Auth (invitations) + un fournisseur SMTP (Resend ou Brevo) pour les notifications.
- Mobile : **PWA + Capacitor** ; poste de travail : **PWA installable** (et coque Tauri optionnelle) — voir § 10.

### 0.3 Principe de sécurité : la base fait foi

Comme dans D-QUINCA/D-AGROBUSINESS, **toutes les règles métier critiques sont posées en base** (RLS + fonctions PostgreSQL `security definer`), pas seulement dans le code serveur :
- qui voit quoi (un client ne voit **jamais** la matière première ni les commandes des autres) ;
- qui peut faire passer une commande d'un statut à l'autre (machine à états § 5) ;
- réservation de stock atomique (verrou de ligne) : **impossible de vendre deux fois la même quantité** ;
- seul le producteur de la facture peut cocher une échéance « payée ».

---

## 1. Profils utilisateurs

Toutes les entreprises (producteurs, clients, banques) sont des **personnes morales** ; chaque entreprise peut avoir **plusieurs utilisateurs**.

| Profil | Rattachement | Rôle dans le circuit |
|---|---|---|
| **Administrateur** | Plateforme (DembaSolution) | Seul à créer / suspendre / supprimer entreprises, comptes et profils. Gère le catalogue produits, les paramètres, voit tout. |
| **Superviseur** | Plateforme | Approuve les commandes, fixe la date de livraison convenue, réoriente / répartit / met en attente ; traite les besoins d'achat ; analyse les capacités. Pas de création de comptes. |
| **Producteur** | Entreprise de type *producteur* | Déclare sites, stocks de matière première (MP) et produits finis (PF), publie ses offres et prix ; valide les commandes ; émet BL et facture ; coche les échéances payées. |
| **Client** | Entreprise de type *client* | Consulte les offres, passe commande, exprime des besoins d'achat, établit le bon de réception (corrige les quantités, commente). |
| **Financier** | Entreprise de type *banque / institution financière* | Approuve ou refuse les **bons de paiement** des commandes payées par la banque ; suit les échéances correspondantes. |

**Profils supplémentaires proposés** (à activer si besoin, sans code nouveau grâce au § 3.2) :
- **Observateur** (ministère, SAED, ANCAR, interprofession) : lecture seule des statistiques agrégées, sans données nominatives de prix.
- **Logisticien / transporteur** : consulte les BL qui lui sont affectés, saisit l'enlèvement et la remise.
- **Contrôleur qualité** : peut bloquer une offre ou un lot (calibre, humidité, conformité).
- **Comptable** d'une entreprise : lecture des factures et échéances de sa propre entreprise, sans pouvoir commander ni valider.

---

## 2. Modèle de données (PostgreSQL / Supabase)

Migrations numérotées dans `pcas/supabase/migrations/` (convention des autres produits). Toutes les tables métier ont `id uuid`, `created_at`, `created_by`, `updated_at`.

### 2.1 Référentiel

- `entreprises` — `type` (`producteur` | `client` | `banque` | `plateforme`), `denomination`, `sigle`, `forme_juridique`, `adresse`, `region`, `departement`, `commune`, `pays` (défaut `SN`), `telephone`, `email`, `site_web`, `identifiant_fiscal` (**NINEA** ou équivalent), `type_identifiant` (NINEA, NIF, RCCM…), `rccm`, `logo_path` (Storage), `representant_legal`, `statut` (`actif` | `suspendu`), `valide_par_admin`.
- `entreprise_comptes_bancaires` — `banque`, `intitule`, `numero_rib` / `iban`, `code_swift`, `principal bool`. Plusieurs comptes par entreprise ; le compte principal figure sur les factures.
- `sites_production` — `entreprise_id`, `nom`, `region`, `departement`, `commune`, `localite`, `latitude`/`longitude`, `superficie_ha`, `jours_ouvres_semaine` (défaut 6), `actif`.
- `capacites_production` — `site_id`, `produit_id`, `capacite_jour` : capacité **par produit fini** et par jour ouvré, dans l'unité du produit (un site peut produire plusieurs produits ; une capacité globale ne permettrait pas l'analyse du § 6).
- `produits` (catalogue plateforme géré par l'administrateur) — `nom`, `categorie` (céréales, légumes, fruits, fruits à coque…), `nature` (`matiere_premiere` | `produit_fini`), `unite` (kg, tonne, sac 50 kg, caisse, régime…), `image_path`, `actif`.
  Amorçage : riz paddy → riz local blanchi, oignon, pomme de terre, carotte, tomate, banane, mangue, anacarde (brute / amande), madd, orange…
- `transformations` — `matiere_id` → `produit_id`, `rendement` exprimé dans les unités des deux produits (ex. 1 tonne de paddy → 13 sacs de 50 kg de riz blanchi : rendement 13) : indispensable pour estimer la production attendue à partir du stock de MP.

### 2.2 Utilisateurs et profils

- `utilisateurs` — `id` = `auth.users.id`, `entreprise_id` (null pour administrateur/superviseur), `role_base` (enum § 1), `profil_id` (profil personnalisé, facultatif), `nom_complet`, `telephone`, `fonction`, `actif`.
- `profils` — `code`, `libelle`, `role_base`, `matrice_permissions jsonb` (restriction additive seulement — même philosophie que la migration 37 de D-AGROBUSINESS : un profil ne peut **jamais** accorder plus que son rôle de base).

### 2.3 Stocks et offres

- `mouvements_stock` — **grand livre append-only** : `entreprise_id`, `site_id`, `produit_id`, `type` (`entree` | `sortie` | `ajustement` | `reservation` | `liberation`), `quantite`, `reference_type/id` (BL, commande, inventaire), `motif`.
- `stocks` — cache maintenu par trigger : `quantite_physique`, `quantite_reservee`, `quantite_disponible` (générée = physique − réservée), contrainte `CHECK (quantite_physique >= 0 AND quantite_disponible >= 0)`. **La matière première n'est lisible que par son producteur, le superviseur et l'administrateur.**
- `offres` — `producteur_id`, `site_id`, `produit_id` (PF), `prix_unitaire` (XOF entier), `quantite_offerte`, `disponibilite` (`immediate` | `court_terme` | `moyen_terme`), `date_disponibilite`, `date_fin_validite`, `qualite / calibre / variete`, `conditionnement`, `quantite_min_commande`, `statut` (`brouillon` | `publiee` | `suspendue` | `epuisee`), `photos`.
  - Offre **immédiate** : adossée au stock PF réel (la quantité offerte ≤ stock disponible).
  - Offre **court / moyen terme** : production annoncée à une date ; plafonnée par l'estimation de capacité (§ 6) ; le client la voit avec sa date de disponibilité. **Elle se commande ferme** (§ 5.2) : colonne `quantite_reservee` avec contrainte `CHECK (quantite_reservee <= quantite_offerte)`.
  - `declarations_production` — le producteur déclare la production réalisée sur une offre prévisionnelle (date, quantité) : entrée en stock PF et transfert des réservations de l'offre vers le stock réel.

### 2.4 Demandes et commandes

- `besoins_achat` — `client_id`, `produit_id`, `quantite`, `prix_cible` (facultatif), `date_souhaitee`, `lieu_livraison`, `producteur_souhaite_id` (**facultatif**), `commentaire`, `statut` (`ouvert` | `en_traitement` | `converti` | `clos` | `annule`). **Besoins publics** : visibles de tous les producteurs (filtrés sur les produits qu'ils offrent), l'identité du client étant masquée (« Client — région de Thiès ») jusqu'à la conversion en commande, pour éviter que la transaction se fasse hors plateforme. Le superviseur le convertit en une ou plusieurs commandes.
- `propositions_besoin` — réponse d'un producteur à un besoin public : `besoin_id`, `producteur_id`, `offre_id` (facultatif), `quantite`, `prix_unitaire`, `date_disponibilite`, `commentaire`, `statut` (`proposee` | `retenue` | `ecartee`). Le client et le superviseur comparent les propositions ; une proposition retenue devient une commande (partielle si plusieurs sont retenues).
- `commandes` — `numero` (`CMD-2026-000123`), `client_id`, `producteur_id`, `commande_parent_id` (répartition), `besoin_id` (origine éventuelle), `statut` (§ 5), `mode_paiement` (`cheque` | `virement` | `especes` | `bon_banque`), `banque_id` (si bon), `adresse_livraison`, `date_souhaitee`, `date_livraison_convenue` (fixée par le superviseur), `conditions_paiement` (échéancier modèle), `facturation_groupee bool` (défaut `false`, § 5.3), `entete_client jsonb` (**instantané** de l'en-tête client au moment de l'émission), `montant_total`, `motif_attente / refus`.
- `lignes_commande` — `offre_id`, `produit_id`, `quantite`, `prix_unitaire` (**instantané** : le prix convenu ne bouge plus), `quantite_livree`, `quantite_recue`.
- `echeancier_commande` — échéances convenues à la commande (`rang`, `pourcentage` ou `montant`, `delai_jours` ou `date`), recopiées sur la facture.
- `commande_evenements` — **journal de bord** : `commande_id`, `acteur_id`, `role`, `action` (`soumise`, `approuvee`, `reorientee`, `repartie`, `mise_en_attente`, `approuvee_banque`, `validee_producteur`, `livree`, `receptionnee`, `facturee`, `echeance_payee`…), `commentaire`, `horodatage`, `donnees jsonb`. C'est lui qui alimente le suivi de bout en bout derrière le QR code.

### 2.5 Documents

- `bons_paiement` — `commande_id`, `banque_id`, `numero` (`BP-…`), `montant`, `reference_bancaire`, `statut` (`soumis` | `approuve` | `refuse`), `decide_par`, `decide_le`, `commentaire`.
- `bons_livraison` — `numero` (`BL-…`), `commande_id`, `site_id`, `date_livraison`, `transporteur`, `immatriculation`, `chauffeur`, `lignes` (`bl_lignes` : produit, quantité livrée). **Plusieurs BL possibles par commande** (livraisons partielles).
- `bons_reception` — `numero` (`BR-…`), `bl_id`, `receptionne_par`, `date`, `commentaire_approbation`, `statut` (`en_attente` | `approuve` | `approuve_avec_reserves`), `br_lignes` (quantité reçue **corrigible** par le client, motif d'écart).
- `factures` — `nature` (`provisoire` | `definitive`), `numero` (`FP-…` pour la provisoire, `FAC-…` pour la définitive), `bl_id` (provisoire), `commande_id`, `producteur_id`, `client_id`, `montant_total`, `statut` (`provisoire` | `receptionnee` | `remplacee` | `definitive` | `partiellement_payee` | `payee` | `annulee`), `compte_bancaire_id` (du producteur, imprimé). **Pas de TVA** : les produits agricoles sont exonérés ; la mention « Exonéré de TVA » est paramétrable dans `parametres_plateforme`.
- `factures_definitives_provisoires` — lien N-1 : `facture_definitive_id`, `facture_provisoire_id`, `br_id`. Une facture définitive remplace **une ou plusieurs** factures provisoires **de la même commande** (regroupement, § 5.3) ; une provisoire ne peut être liée qu'à une seule définitive (contrainte d'unicité).
- `echeances` — `facture_id`, `rang`, `date_echeance`, `montant`, `statut` (`a_payer` | `en_retard` | `payee`), `payee_le`, `payee_par` (**uniquement un utilisateur du producteur émetteur**), `mode_reglement`, `reference` (n° chèque, virement…).
- `documents` — registre commun de **tous** les documents imprimables pour le QR : `type`, `document_id`, `jeton_public` (aléatoire, 22+ caractères), `empreinte_sha256` (du contenu figé), `version`, `emis_par`, `emis_le`, `pdf_path` (archive Storage).
- `sequences_numerotation` — compteur par (type, année), incrémenté dans une fonction transactionnelle (pas de trou ni de doublon).

### 2.6 Transverse

- `notifications` (destinataire, type, lien, lu), `parametres_plateforme` (mention d'exonération de TVA, délais, mentions légales), `journal_audit` (connexions, créations/suppressions de comptes, changements de rôle, modifications de fiche entreprise).
- `modeles_contrat` — `type` (`producteur` | `client`), `version`, `titre`, `contenu` (texte des articles), `empreinte_sha256`, `en_vigueur_le`, `actif`. Rédigés et publiés par l'administrateur (§ 3.3).
- `acceptations_contrat` — `entreprise_id`, `modele_id` (donc la version), `accepte_par` (utilisateur), `nom_signataire`, `fonction_signataire`, `accepte_le`, `adresse_ip`, `agent_utilisateur`, `jeton_public` (QR du contrat signé).

---

## 3. Comptes, entreprises et profils (Administrateur)

### 3.1 Création réservée à l'administrateur

- **Inscription publique supprimée** : pas de page `/signup`. Une page publique « Demander un accès » (formulaire → table `demandes_acces`) permet à un producteur ou client de se signaler ; l'administrateur crée ensuite le compte.
- Dashboard `/admin` :
  - **Entreprises** : création/édition de la fiche complète (§ 2.1), logo (Storage, bucket `logos`, 1 Mo max, png/jpg/webp), comptes bancaires, sites de production, suspension, **suppression** (avec confirmation renforcée : saisie de la dénomination ; suppression refusée si des factures non soldées existent → proposer la suspension).
  - **Utilisateurs** : création via `auth.admin.inviteUserByEmail` (clé service côté serveur uniquement) → l'utilisateur reçoit un lien pour définir son mot de passe ; rattachement entreprise + rôle + profil ; désactivation ; réinitialisation ; suppression.
  - **Profils** : création de profils personnalisés (§ 3.2).
  - **Catalogue produits**, **transformations / rendements**, **paramètres**, **journal d'audit**, **demandes d'accès**.
- Le producteur, le client ou la banque **mettent à jour eux-mêmes leur fiche** (dénomination, adresse, contacts, identifiant fiscal, logo, comptes bancaires, sites, capacités), sans validation préalable. Seul le **type** d'entreprise (producteur / client / banque), qui détermine les droits, reste réservé à l'administrateur. Chaque modification est tracée dans `journal_audit` (ancienne → nouvelle valeur) et un changement de **compte bancaire** ou d'**identifiant fiscal** notifie l'administrateur, pour détecter une fraude au RIB.

### 3.2 Profils personnalisés (« Autres à créer si besoin »)

Un profil = un rôle de base + une matrice lire/écrire/modifier par menu (reprise de `lib/permissions.ts`). Exemple : « Commercial producteur » = rôle *producteur* sans droit de cocher les échéances payées ni d'émettre de facture. La RLS s'appuie sur le rôle de base ; la matrice ne fait que **restreindre** (écrans, boutons et contrôle dans les actions serveur).

### 3.3 Contrats d'engagement (producteur et client)

Chaque entreprise productrice ou cliente doit accepter le **contrat d'engagement** de son type avant de pouvoir agir sur la plateforme. Les projets de texte sont dans [contrats-engagement.md](contrats-engagement.md).
- **Premier accès** d'un utilisateur habilité (représentant légal ou utilisateur désigné par l'administrateur) : écran de lecture intégrale du contrat, saisie du nom et de la fonction du signataire, case « J'ai lu et j'accepte au nom de [dénomination] », validation. L'acceptation est enregistrée dans `acceptations_contrat` (date, IP, version, empreinte).
- **Tant que le contrat n'est pas accepté** : consultation possible, mais le producteur ne peut ni publier d'offre ni valider de commande, et le client ne peut ni commander ni publier de besoin. Contrôle en base dans les fonctions concernées.
- **Nouvelle version** publiée par l'administrateur : nouvelle acceptation exigée à la connexion suivante (délai de grâce paramétrable, par ex. 15 jours).
- Le contrat accepté est **imprimable et téléchargeable** (PDF) avec un QR vers `/v/<jeton>` qui atteste de l'acceptation.
- **Manquements** : l'administrateur ou le superviseur enregistre un incident (`incidents_engagement` : entreprise, article concerné, description, pièce jointe, sanction : avertissement / suspension temporaire / exclusion). Les suspensions s'appliquent automatiquement (statut de l'entreprise). Le taux de service et le nombre d'incidents alimentent la **note de fiabilité** affichée sur la fiche producteur.

---

## 4. Espaces fonctionnels par profil

### Producteur
- **Tableau de bord** : commandes à valider, livraisons à effectuer, échéances à encaisser, alertes de sur-engagement.
- **Ma fiche entreprise**, **Sites de production** (capacité/jour).
- **Stock matière première** (masqué aux clients) : entrées (récolte, achat), sorties (transformation), inventaires.
- **Stock produits finis** : entrées (production), sorties automatiques par les BL, réservations visibles.
- **Mes offres** : actuelles et prévisionnelles, prix, photos, publication / suspension ; **déclaration de production** pour les offres prévisionnelles.
- **Besoins d'achat publics** : consulter les besoins portant sur ses produits et **faire une proposition** (quantité, prix, date).
- **Commandes reçues** → valider / refuser (motif) → préparer → **émettre le BL** (génère la facture provisoire).
- **Factures & échéances** → cocher « payé » par échéance (mode, référence, date).

### Client
- **Place de marché** : catalogue des offres publiées, filtres (produit, région, disponibilité immédiate / à date, prix), fiche producteur (sans stock MP).
- **Panier → commande** (un producteur par commande ; un panier multi-producteurs génère une commande par producteur) : adresse de livraison, date souhaitée, mode de paiement, banque si bon.
- **Besoins d'achat** : produit, quantité, date, lieu, prix cible, producteur facultatif ; comparaison des **propositions** reçues des producteurs.
- **Mes commandes** (suivi en frise chronologique), **Réceptions** (BR : corriger les quantités, commentaire d'approbation, ou signaler un litige), **Factures** (provisoires et définitives) **& échéancier**.

### Superviseur
- **File d'approbation** des commandes soumises, avec pour chaque commande le **panneau d'analyse de capacité** du producteur (§ 6).
- Actions : **approuver** (date de livraison convenue obligatoire), **réorienter** vers un autre producteur, **répartir** entre plusieurs producteurs, **mettre en attente** (motif + date de revue), **refuser** (motif).
- **Besoins d'achat** : suivre les propositions des producteurs, en suggérer d'autres (classés par disponibilité, distance, prix), convertir en commande(s).
- **Litiges de réception** : arbitrage entre producteur et client (§ 5.3).
- **Offres prévisionnelles à risque** : production déclarée insuffisante à l'approche de la date (§ 5.2).
- **Vue producteurs** : production attendue vs engagements, carte des sites.
- **Suivi global** : commandes en retard de livraison, BR en attente, échéances en retard.

### Financier (banque)
- **Bons de paiement à traiter** (commandes en mode `bon_banque` désignant sa banque) : approuver (référence bancaire) / refuser (motif).
- **Suivi** des factures et échéances concernées ; états imprimables.

### Administrateur
- Tout ce qui précède en lecture + § 3 + statistiques plateforme (volumes par produit, région, période ; taux de service).

---

## 5. Circuit de la commande (machine à états)

### 5.1 Statuts

```
brouillon ──(client)──► soumise
soumise ──(superviseur)──► approuvee            [date_livraison_convenue obligatoire]
        ├─(superviseur)──► en_attente ──► soumise (reprise)
        ├─(superviseur)──► reorientee  → nouvelle commande « soumise » chez un autre producteur
        ├─(superviseur)──► repartie    → N commandes filles (même client, quantités réparties)
        └─(superviseur)──► refusee
approuvee ──[si bon_banque]──► attente_banque ──(financier)──► approuvee_banque | refusee_banque
approuvee | approuvee_banque ──(producteur)──► validee   [réservation du stock]
                             └─(producteur)──► refusee_producteur → retour au superviseur
validee ──(producteur : BL)──► en_livraison / livree_partiellement / livree  [facture PROVISOIRE par BL]
livree ──(client : BR approuvé, ou tacite après 72 h)──► receptionnee   [facture DÉFINITIVE : par BR, ou regroupée]
       └─(client : litige)──► en_litige ──(superviseur : arbitrage)──► receptionnee
receptionnee ──(producteur : échéances)──► partiellement_payee ──► soldee (clôture)
annulee : possible jusqu'à « validee » (client avant approbation ; superviseur ensuite)
```

Chaque transition est une **fonction PostgreSQL** (`rpc_commande_approuver`, `rpc_commande_valider`, `rpc_emettre_bl`, `rpc_approuver_br`, `rpc_echeance_payee`…) qui :
1. vérifie le rôle et l'entreprise de l'appelant (`auth.uid()`) ;
2. verrouille la commande (`SELECT … FOR UPDATE`) et vérifie le statut de départ ;
3. applique les effets (stock, documents, numérotation) ;
4. écrit l'événement dans `commande_evenements` ;
5. crée les notifications.
Les tables `commandes`, `factures`, `echeances` ne sont **pas modifiables directement** par les rôles métier (RLS : `select` seulement) — tout passe par ces fonctions.

### 5.2 Stock : jamais de vente d'un stock inexistant

- À la **validation producteur** : réservation dans `stocks` avec verrou de ligne ; refus si `quantite_disponible < quantite`.
- **Offres prévisionnelles, commandées ferme** : la réservation porte sur `offres.quantite_reservee` (verrou de ligne sur l'offre, contrainte `quantite_reservee <= quantite_offerte`), elle-même plafonnée par la capacité estimée (§ 6). La commande est ferme pour les deux parties : prix, quantité et date sont engagés.
  - À la **déclaration de production**, la production entre en stock PF et les réservations de l'offre y sont transférées.
  - **Alerte de risque** (cron quotidien) : à J-7 de la date de disponibilité (paramétrable), si la production déclarée + stock PF < quantités réservées, le superviseur et le client sont alertés ; le superviseur peut compléter par un autre producteur (répartition) ou replanifier avec l'accord du client. Un manquement répété est un incident au sens du contrat d'engagement (§ 3.3).
- À l'**émission du BL** : la réservation devient une sortie physique.
- À l'**annulation** : libération automatique.
- Contraintes `CHECK` en base : même un bug applicatif ne peut pas rendre un stock négatif.

### 5.3 Livraison, réception, facture

Règle retenue : **facture provisoire à la livraison, facture définitive à l'approbation du BR.**
- **Émission du BL** → **facture provisoire** (`FP-…`) générée automatiquement sur les quantités livrées, aux prix et avec l'échéancier de la commande. Elle porte la mention en filigrane **« PROVISOIRE — non exigible »** et son propre QR.
- **Approbation du BR** par le client (quantités éventuellement corrigées, commentaire) → la facture provisoire passe au statut `receptionnee` (quantités reçues figées), puis :
  - **mode standard** (`facturation_groupee = false`) : la **facture définitive** (`FAC-…`) est générée immédiatement, sur les quantités reçues de ce BR ;
  - **mode regroupé** (option) : les provisoires réceptionnées d'une **même commande** attendent ; le producteur établit, quand il le souhaite, **une seule facture définitive** regroupant tout ou partie d'entre elles (sélection par cases à cocher, sous-totaux par BL sur la facture). Quand la commande est entièrement livrée et réceptionnée, les provisoires restantes sont regroupées automatiquement, pour qu'aucune livraison ne reste sans facture définitive.
  - L'option est choisie par le producteur à la validation de la commande (préréglage possible sur sa fiche) et reste modifiable jusqu'à la première facture définitive de la commande. Le client voit le mode retenu sur la commande.
  - Les provisoires remplacées passent au statut `remplacee` ; elles ne sont jamais réécrites (leur QR indique « remplacée par FAC-… »). Le regroupement de provisoires de **commandes différentes** est interdit (contrôle en base).
- Les **échéances** sont créées sur la facture définitive uniquement ; leurs dates partent de la date de la facture définitive (délais convenus à la commande).
- **Litige** : si le client conteste (quantité, qualité), le BR passe en `en_litige` avec motif et photos ; le superviseur arbitre en fixant les quantités acceptées, ce qui rend la provisoire `receptionnee`.
- **Réception tacite** : si le client n'a ni approuvé ni contesté le BR **72 h** après la livraison (délai paramétrable), la réception est réputée conforme au BL (cron horaire) ; un rappel est envoyé au client à 24 h et à 48 h. L'événement « réception tacite » est tracé dans le journal et visible sur la frise.
- **Livraisons partielles** : chaque BL a sa facture provisoire ; la définitive suit le mode standard ou regroupé.

### 5.4 Paiement

- Modes : chèque, virement, espèces (payés directement au producteur) ou **bon de paiement bancaire** (approuvé par le financier avant la validation producteur).
- **Seul un utilisateur du producteur émetteur** peut cocher « payé » sur une échéance (contrôle en base dans `rpc_echeance_payee`) ; il renseigne la date, le mode et la référence. Décocher reste possible pendant 48 h, avec trace dans le journal.
- Toutes les échéances payées → facture `payee` → commande **`soldee`** : fin de la chaîne.
- Échéances passées non payées → `en_retard` (tâche planifiée quotidienne, cron Vercel) + notification.

---

## 6. Analyse de capacité (Superviseur / Administrateur)

Pour un producteur, un produit fini et une date de livraison :

```
potentiel_MP       = stock_MP_disponible × rendement(MP → PF)
capacité_période   = Σ sites actifs [capacité_jour(produit) × jours_ouvrés(aujourd'hui → date_livraison)]
production_attendue = min(potentiel_MP, capacité_période)
disponible_total   = stock_PF_disponible + production_attendue
engagé             = Σ quantités des commandes approuvées/validées non livrées (même produit, même période)
marge              = disponible_total − engagé − quantité_de_la_commande
```

- Implémenté en **fonction SQL** `analyse_capacite(producteur, produit, date)` (le client n'y a pas accès).
- Affichage : jauge (vert si marge ≥ 0, orange si marge < 10 %, rouge si négative), détail du calcul, historique du taux de service du producteur (commandes livrées à temps / total).
- Suggestion automatique en cas de marge négative : liste des autres producteurs ayant une marge positive → **réorienter** ou **répartir** en un clic (quantités pré-remplies, modifiables).

---

## 7. QR code, signature et traçabilité

- Chaque document (commande, bon de paiement, BL, BR, facture provisoire, facture définitive, contrat d'engagement accepté) reçoit à son émission une ligne dans `documents` : `jeton_public` aléatoire + **empreinte SHA-256** du contenu figé (numéro, parties, lignes, montants, dates, validateur).
- Le QR encode `https://pcas.dembasolution.com/v/<jeton>`. La page publique `/v/[jeton]` (sans connexion) affiche :
  - l'**authenticité** (document trouvé, empreinte conforme, statut actuel : valide / annulé / provisoire remplacée par définitive) ;
  - la **frise des étapes** de la commande (étapes, dates, profils des validateurs — noms masqués partiellement pour les visiteurs non connectés) ;
  - **jamais de prix, de montant ni de quantité** pour un visiteur non connecté, ni pour un utilisateur connecté étranger à la commande.
- **Montants et détail complet** visibles uniquement, après connexion, par les **parties concernées** : le client et le producteur de la commande, la banque si le paiement passe par bon de paiement, le **superviseur** et l'administrateur. Le contrôle est fait en base (fonction `document_public(jeton)` qui renvoie la version réduite ou complète selon `auth.uid()`), pas seulement dans l'affichage.
- « Signature » : le QR atteste qui a validé quoi et quand (journal `commande_evenements`) ; toute modification du document le rend non conforme à son empreinte.
- Le mobile (Capacitor) propose un **scanner de QR** natif qui ouvre directement le suivi.

---

## 8. Impression, états et documents

### 8.1 Documents (édition + téléchargement)

Commande, bon de paiement, BL, BR, facture provisoire (filigrane « PROVISOIRE »), facture définitive, échéancier, contrat d'engagement accepté :
- mise en page A4 professionnelle : **logos et fiches des deux entreprises** (en-tête client repris de l'instantané de la commande), numéro, dates, lignes, totaux en lettres (« … francs CFA »), conditions, compte bancaire du producteur, mentions légales, **QR code**, zone de visa ;
- **Télécharger PDF** (jsPDF) et **Imprimer** (HTML navigateur, avec « Enregistrer au format PDF » possible, y compris sur Mac) ;
- PDF archivé dans Storage à l'émission (copie de référence liée à l'empreinte).

### 8.2 Moteur d'états imprimables

Un composant unique `<EtatImprimable>` réutilisé par toutes les listes :
- **période** du … au … (raccourcis : ce mois, trimestre, année, campagne) ;
- **orientation portrait / paysage** (CSS `@page { size: A4 landscape }` et paramètre jsPDF) ;
- choix des colonnes, filtres courants (producteur, client, produit, statut, région) ;
- sorties : impression, PDF, **CSV/Excel**.

États prévus : catalogue des offres, stocks PF (et MP pour producteur/superviseur), commandes par statut, besoins d'achat, bons de paiement, livraisons, réceptions et écarts, factures, **échéancier (à payer / en retard / payé)**, encaissements, analyse de capacité par producteur, chiffre d'affaires par produit / région / producteur / client, taux de service.

---

## 9. Design et ergonomie

- **Style des autres produits DembaSolution** : barre latérale façon Slack (logo PCAS, nom de l'entreprise, menus groupés par profil, badge de notifications), **3 thèmes** (clair, sombre, contrasté), tokens sémantiques (`bg-surface`, `text-foreground`, `border-surface-border`, `--primary`…) — **aucune couleur brute** dans les composants.
- Identité PCAS proposée : **vert savane** (primaire), **ocre / terre** (accent), jaune mangue pour les alertes — à valider sur une maquette.
- Typographies Inter (texte) + Outfit (titres), comme D-AGROBUSINESS.
- **Responsive d'abord** : barre latérale en tiroir + **barre de navigation basse** sur mobile ; tableaux transformés en **cartes** sous 768 px ; cibles tactiles ≥ 44 px ; formulaires en une colonne.
- Place de marché visuelle : cartes produit avec photo, badge « Disponible » / « Disponible le 15/11 », prix au kg/sac, note de service du producteur.
- Frise chronologique de commande (stepper) partagée entre toutes les vues et la page QR.
- Visuels marketing et photos produits **réalistes** (pas d'aspect « IA »).
- Accessibilité : contrastes AA, focus visible, libellés ARIA.

---

## 10. Versions web, mobile et poste de travail (mode connecté)

| Cible | Solution | Détail |
|---|---|---|
| Web | Next.js sur Vercel | Tous navigateurs récents |
| Poste Windows (et Linux) | **PWA installable** (manifeste, icônes, écran de démarrage) | Installation en un clic depuis Chrome/Edge : icône bureau, fenêtre dédiée. Coque **Tauri** optionnelle si un installateur `.exe/.msi` est exigé |
| **Mac (macOS)** | **PWA** + coque **Tauri** `.dmg` | Voir § 10.1 |
| Android / iOS (iPhone, iPad) | **Capacitor** (coque native chargeant l'application en ligne) | Notifications push (FCM / APNs), **scanner QR** natif, partage/ouverture des PDF, écran « pas de connexion » propre |

### 10.1 Utilisation sur Mac

- **Sans installation** : Safari, Chrome ou Edge sur macOS. **Safari est un navigateur cible à part entière** (moteur WebKit), testé à chaque lot au même titre que Chrome.
- **Installation légère (PWA)** : Safari (macOS 14 Sonoma et plus) → menu *Fichier › Ajouter au Dock* ; Chrome/Edge → *Installer PCAS*. L'application s'ouvre dans sa propre fenêtre, avec son icône dans le Dock et le Launchpad.
- **Application Mac installable** : coque **Tauri** produisant un `.dmg` (processeurs Apple Silicon et Intel), **signée « Developer ID » et notarisée par Apple** pour éviter l'avertissement « développeur non identifié » de Gatekeeper. Le même compte Apple Developer (99 $/an) sert pour l'App Store iOS. Mise à jour automatique intégrée à Tauri.
- **Points d'attention propres au Mac, vérifiés en recette** :
  - raccourcis clavier affichés en **⌘** (et non Ctrl) : ⌘P imprimer, ⌘K recherche ;
  - impression depuis Safari : respect de `@page` (portrait/paysage) et des marges ; en cas d'écart, le PDF jsPDF reste la référence ;
  - téléchargement des PDF/CSV dans Safari (dossier *Téléchargements*, pas d'ouverture dans un nouvel onglet vide) ;
  - champs date et nombres (format français `27/09/2026`, séparateur de milliers pour les FCFA) identiques dans Safari et Chrome ;
  - écrans Retina : logos et QR en SVG ou en haute résolution ; défilement au trackpad dans les tableaux larges ;
  - thème sombre suivant le réglage macOS (`prefers-color-scheme`) si l'utilisateur n'a pas choisi de thème.
- La compilation iOS **et** la signature de l'application Mac demandent un Mac (ou un service de compilation dans le cloud).

- Apple refuse les coques qui ne sont qu'un site : les fonctions natives (push, scanner, partage) sont nécessaires pour la validation App Store.
- Prérequis : compte Google Play (25 $, une fois), compte Apple Developer (99 $/an) + un Mac pour la compilation iOS (ou un service de build dans le cloud).

---

## 11. Notifications

In-app (Realtime) + e-mail (+ push mobile) à chaque étape : commande soumise (superviseur), approuvée / en attente / réorientée (client, producteur), bon de paiement à traiter (financier), commande à valider (producteur), BL émis (client), BR approuvé avec écart (producteur), échéance proche / en retard (client, producteur). SMS / WhatsApp : extension ultérieure.

---

## 12. Réservé pour plus tard : monétisation

Emplacement prévu (non implémenté) : `lib/paiements/` et tables `abonnements` / `commissions`, sur le modèle `lib/payments/*` de SIGGIE/D-AGROBUSINESS (Chariow, Moneroo, Bictorys). À spécifier : abonnement par entreprise, commission par commande, ou vente directe.

---

## 13. Points à confirmer avant ou pendant le développement

### Tranchés

| # | Question | Décision | Intégrée au |
|---|---|---|---|
| 1 | Langues | Français uniquement | En-tête, § 0.1 |
| 2 | Écart au BR | Facture **provisoire** au BL, facture **définitive** à l'approbation du BR (pas d'avoir) | § 2.5, § 5.1, § 5.3 |
| 3 | TVA | Pas de TVA (produits exonérés, mention paramétrable) | § 2.5 |
| 4 | Livraisons partielles | Autorisées (plusieurs BL par commande) | § 2.5, § 5.3 |
| 5 | Besoins d'achat | **Publics** pour les producteurs, identité du client masquée jusqu'à la commande ; les producteurs font des propositions | § 2.4, § 4 |
| 6 | Fiche entreprise | Modifiée **directement par l'entreprise** (sauf le type), avec traçage et alerte en cas de changement de RIB | § 3.1 |
| 2 bis | Regroupement des factures | **En option** : plusieurs factures provisoires d'une même commande peuvent être regroupées en une seule facture définitive | § 2.5, § 5.3 |
| 7 | Page QR publique | Authenticité et étapes pour tous ; **montants visibles seulement des parties concernées** (client, producteur, banque le cas échéant, superviseur, administrateur) | § 7 |
| 8 | Offres prévisionnelles | **Commandes fermes** avec réservation sur la production annoncée | § 2.3, § 5.2 |
| 9 | Contrat d'engagement | Producteur et client, acceptation électronique obligatoire | § 3.3, [contrats-engagement.md](contrats-engagement.md) |

| 10 | Masquage du client dans les besoins publics | Oui, identité masquée jusqu'à la conversion en commande | § 2.4 |
| 11 | Réception tacite | Oui, réception réputée conforme au BL après 72 h sans réponse (paramétrable), rappels à 24 h et 48 h | § 5.3, contrat client art. 13 |

### Reste à faire hors développement

- **Contrats d'engagement** : faire relire les projets par un juriste avant la mise en production (droit OHADA et sénégalais).

---

## 14. Découpage en lots

**État (28/09/2026)** : lots 0 à 11 codés dans `pcas/` ; migrations `00` à `12` appliquées au projet de développement ; recette de bout en bout `npm run recette` : **28/28**. Restent hors code : compilation et publication des applications mobiles et Mac/Windows (voir `docs/applications.md`), relecture juridique des contrats, mise en production (voir `docs/mise-en-production.md`).

| Lot | Contenu | Livrable vérifiable |
|---|---|---|
| **0. Fondations** | Dépôt `pcas/`, projet Supabase, fondations reprises (§ 0.1), thèmes/identité, proxy de session sans inscription, manifeste PWA, CI (lint, typecheck) | Connexion d'un compte invité, shell vide responsive dans les 3 thèmes, vérifié sur Chrome **et Safari Mac** |
| **1. Administration** | Entreprises + fiche complète + logo + comptes bancaires + sites, utilisateurs (invitation), profils personnalisés, catalogue produits et rendements, demandes d'accès, journal d'audit, **contrats d'engagement** (modèles versionnés, acceptation au premier accès, blocage tant que non accepté) | L'administrateur crée un producteur, un client et une banque avec leurs utilisateurs ; un producteur sans contrat accepté ne peut pas publier d'offre |
| **2. Producteur : stocks et offres** | Grand livre de stock, MP masquée, PF, offres immédiates et prévisionnelles, déclarations de production | Offre publiée visible du client, MP invisible (test RLS) |
| **3. Client : place de marché** | Catalogue, fiche producteur, panier, commande (instantané de l'en-tête, échéancier, mode de paiement), besoins d'achat publics et propositions des producteurs | Commande soumise avec son numéro ; un besoin reçoit deux propositions, dont une devient commande |
| **4. Supervision** | File d'approbation, analyse de capacité, approuver / réorienter / répartir / attente / refuser, conversion des besoins | Répartition d'une commande entre 2 producteurs |
| **5. Banque** | Bons de paiement, approbation / refus | Commande `bon_banque` bloquée tant que la banque n'a pas approuvé |
| **6. Exécution** | Validation producteur (réservation, y compris sur offre prévisionnelle), BL + facture provisoire, BR avec corrections + facture définitive (par BR ou regroupée) + échéances, réception tacite, litige et arbitrage, alerte de risque J-7, cases « payé », clôture | Chaîne complète jusqu'à `soldee` ; test de concurrence : deux validations simultanées sur le dernier stock → une seule réussit |
| **7. QR et traçabilité** | Registre `documents`, empreintes, page `/v/[jeton]`, frise | Un QR scanné affiche l'étape réelle ; un document altéré est détecté |
| **8. Impression** | Documents PDF/HTML avec QR, moteur d'états (période, portrait/paysage, CSV) | Tous les états listés au § 8.2 |
| **9. Tableaux de bord et notifications** | Indicateurs par profil, notifications in-app / e-mail, cron des retards | — |
| **10. Mobile et poste de travail** | Capacitor Android/iOS (push, scanner, partage PDF), PWA Windows/Mac, **application Mac Tauri `.dmg` signée et notarisée**, coque Windows si demandée | APK de test + TestFlight + `.dmg` installé sur un Mac sans avertissement Gatekeeper |
| **11. Recette et mise en production** | Audits sécurité/RLS/index, recette croisée Windows / Mac (Safari) / Android / iOS, jeu de démo (`seed:demo`), **guide utilisateur en français**, pages vitrine | Mise en ligne sur `pcas.dembasolution.com` |

### Qualité et tests

- **Tests des fonctions de transition** (machine à états, droits par rôle, réservation concurrente, échéance cochée par un non-producteur → refus) : scripts Node sur une base Supabase locale, lancés en CI.
- **Tests RLS** : un script par rôle vérifie ce qu'il peut et ne peut pas lire (la matière première ne doit jamais être lisible par un client ou une banque).
- `npm run lint` et `typecheck` bloquants avant chaque déploiement.
