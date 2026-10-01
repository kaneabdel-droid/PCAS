# PCAS — Rapport d'audit (septembre 2026)

Audit complet avant ouverture aux entreprises réelles : sécurité, performances, rapidité, reprise de panne, intégrité
des données. Base : projet Supabase `vrcvjpqrtnngfapdyunz` (démonstration cloisonnée), site `pcas.dembasolution.com`.

## Synthèse

| Domaine | Verdict | Manquements trouvés | Corrigés |
|---|---|---|---|
| Sécurité | Bon | 5 | 5 |
| Performances et rapidité | Bon | 2 | 2 |
| Reprise de panne | Insuffisant → correct | 5 | 4 (+1 hors code) |
| Intégrité des données | Très bon | 0 | — |
| Cloisonnement démonstration / réel | Très bon | 3 (en cours d'audit) | 3 |

## Contrôles automatisés (à relancer après chaque migration)

| Commande | Ce qu'elle vérifie | Résultat |
|---|---|---|
| `npm run audit:securite` | visiteur anonyme : 37 tables illisibles, 66 fonctions refusées ou sans effet, en-têtes HTTP, cron, redirection | 111/112 → 112/112 après la migration 19 |
| `npm run verifier-espaces` | aucun compte de démonstration ne voit le réel, et inversement ; formulaire public ; limite de débit | 38/38 après la migration 17 |
| `npm run recette` | circuit complet par rôle, refus de chaque rôle, concurrence sur le dernier stock | 28/28 |
| `supabase/audit/verifications.sql` | RLS, fonctions SECURITY DEFINER, buckets, stocks, empreintes, espaces (11 requêtes) | à exécuter dans l'éditeur SQL : 0 ligne attendue |

## 1. Sécurité

Déjà en place et vérifié : RLS sur 100 % des tables ; fonctions SECURITY DEFINER à `search_path` figé ; en-têtes CSP,
HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy ; aucun secret dans l'historique Git ; `npm audit` sans
vulnérabilité ; buckets limités en taille et en type (pas de SVG) ; cron protégé par secret ; jetons QR de 24 caractères
aléatoires.

| # | Manquement | Gravité | Correction |
|---|---|---|---|
| S1 | `/auth/confirm` : redirection ouverte (`next=/\site-externe`, le navigateur lit `\` comme `/`) | Moyenne | seuls les chemins internes sans `\` sont acceptés |
| S2 | Demandes d'accès sans limite de débit : spam possible de l'administrateur via l'API publique | Moyenne | 3 demandes par email et par 24 h, 30 par heure (migration 16) |
| S3 | L'administrateur de démonstration pouvait écrire dans le dossier de logo d'une entreprise réelle | Faible (identifiant à deviner) | politiques du bucket `logos` cloisonnées par espace (16) |
| S4 | `masquer_nom()` appelable par un visiteur | Très faible | droit retiré (19) |
| S5 | Secret du cron comparé par égalité simple | Très faible | comparaison à temps constant |

## 2. Performances et rapidité

Mesures en production (serveur Vercel `dub1`) : pages connectées 0,4 à 1 s, page de connexion 0,6 à 0,9 s. Les
requêtes des pages sont déjà lancées en parallèle.

| # | Manquement | Correction |
|---|---|---|
| P1 | 15 clés étrangères sans index, dont `echeances.facture_id` utilisée à chaque contrôle d'accès aux échéances | 16 index (migration 16) |
| P2 | Politiques RLS évaluant les fonctions d'identité à chaque ligne | enveloppées dans `(select …)` : une évaluation par requête (16) |

Latence Vercel (`dub1`) → Supabase mesurée par `/api/sante` : **45 ms**. La base est proche des fonctions, rien à
déplacer.

## 3. Reprise de panne

Déjà en place : délai de 15 s et nouvelle tentative sur les lectures (jamais sur les écritures) ; transitions en
transactions verrouillées ; boutons désactivés pendant l'envoi (pas de double commande) ; service worker « hors ligne ».

| # | Manquement | Correction |
|---|---|---|
| R1 | Une erreur JavaScript faisait tomber toutes les pages connectées (cloche Realtime) | un canal par cloche (déployé) |
| R2 | Écran d'erreur anglais de Next.js, sans bouton pour réessayer | `error.tsx`, `global-error.tsx`, `not-found.tsx` en français |
| R3 | Tâche planifiée : une étape en échec bloquait rappels et emails | étapes indépendantes, statut 500 visible dans Vercel |
| R4 | Aucun point de surveillance | `/api/sante` : état de la base, latence, région |
| R5 | Aucune sauvegarde sur l'offre gratuite Supabase | `npm run sauvegarde` (export JSON) ; **à faire hors code : offre Pro + Point-in-Time Recovery** |

## 4. Intégrité des données

Contrôle croisé sur la base : 10 stocks = somme du grand livre des mouvements, aucun négatif ; 18 factures = somme de
leurs lignes et de leurs échéances ; 26 commandes = somme de leurs lignes ; aucune livraison au-delà du commandé.
Numérotation sans trou et séparée pour la démonstration (`DEMO-…`). Concurrence : deux validations simultanées sur le
dernier stock → une seule réussit (recette).

## 5. Cloisonnement démonstration / réel (migrations 13 à 15, 17)

Défauts trouvés pendant l'audit et corrigés : contrôles d'espace non exécutables par un producteur (14) ; contrôle
« mon entreprise » valant NULL pour le superviseur (15) ; **formulaire public « Demander un accès » refusé depuis la
migration 13** (17).

## Reste à faire (hors code)

- [x] Migrations 17, 18 et 19 exécutées, démonstration reconstruite (contrat v1.1 accepté) : `verifier-espaces` 38/38, `audit:securite` 112/112.
- [ ] Supabase **Pro** (sauvegardes quotidiennes, PITR) avant les premières entreprises réelles.
- [x] Surveillance UptimeRobot : sonde HTTP(s) `/api/sante` toutes les 5 min (2xx seulement, sans suivre les redirections), alerte email — créée par l’API v3 (`npm run surveillance`).
- [x] Sentry actif en production (projet `pcas`, région UE) : erreur navigateur de test transmise par `/monitoring`, alerte email configurée.
- [x] Lighthouse mobile (`npm run lighthouse`, exécuté par Google) : `/login` 99 · 100 · 100 · 100 ; `/guide` 99 · 100 · 100 · 100 ; `/decouvrir-pcas` 94 · 100 · 100 · 100 (performance · accessibilité · bonnes pratiques · SEO), après ajout de robots.txt et sitemap.xml (SEO 91 → 100).
- [ ] Relecture juridique des contrats v1.1 (droit OHADA et sénégalais).
