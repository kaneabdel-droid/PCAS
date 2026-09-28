# PCAS — Plateforme de Commercialisation Agricole du Sénégal

Produit DembaSolution. Plan complet : [`../implementation_plan_pcas.md`](../implementation_plan_pcas.md) ; contrats d'engagement : [`../pcas_contrats_engagement.md`](../pcas_contrats_engagement.md).

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL, Auth, Storage). Interface en français uniquement, devise FCFA (XOF), mode toujours connecté.

## Commandes

```bash
npm run dev        # serveur de développement (http://localhost:3000)
npm run build      # build de production
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run creer-admin -- admin@exemple.com "Prénom Nom" "MotDePasseSolide"   # premier administrateur (une seule fois)
npm run recette    # recette de bout en bout sur un projet de test (crée un jeu de démonstration fictif)
```

Documentation : [mise en production](docs/mise-en-production.md) · [applications mobiles et de bureau](docs/applications.md) · [audit de sécurité SQL](supabase/audit/verifications.sql) · guide d'utilisation en ligne sur `/guide`.

## Migrations

| Fichier | Contenu |
|---|---|
| `00_fondations` | entreprises, utilisateurs, profils, fonctions de contexte, RLS |
| `01_administration` | comptes bancaires, sites et capacités, catalogue et rendements, paramètres, journal d'audit, demandes d'accès, logos, contrats |
| `02_contrats_v1` | contrats d'engagement v1.0 (générés par `scripts/generer-contrats-sql.mjs`) |
| `03_stocks_offres` | grand livre des stocks, offres immédiates et à date, déclarations de production, photos |
| `04_marche_commandes` | place de marché, panier, commandes, besoins d'achat et propositions |
| `05_supervision` | analyse de capacité, approbation, attente, refus, réorientation et répartition |
| `06_banque` | bons de paiement |
| `07_execution` | validation et réservation, livraisons, réceptions, factures provisoires et définitives, échéances, paiements |
| `08_documents_qr` | registre des documents, empreintes, vérification publique par QR code |
| `09_notifications` | notifications, rappels planifiés |
| `10_appareils` | appareils mobiles (notifications push) |
| `11_correctifs_recette`, `12_correctif_stock` | correctifs trouvés par la recette |

## Mise en route

1. **Projet Supabase dédié à PCAS** (ne pas réutiliser celui d'un autre produit).
2. Appliquer les migrations de [`supabase/migrations/`](supabase/migrations/) dans l'ordre (éditeur SQL de Supabase, ou `npx supabase db push` après `npx supabase link`).
3. Copier `.env.example` en `.env.local` et renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
4. **Supabase › Authentication** :
   - *Sign In / Providers* : désactiver **Allow new users to sign up** (les comptes sont créés par l'administrateur uniquement).
   - *URL Configuration* : *Site URL* = `NEXT_PUBLIC_SITE_URL` ; ajouter `http://localhost:3000/**` aux *Redirect URLs* pour le développement.
   - *Email Templates* : faire pointer les liens vers la route de confirmation de l'application :
     - **Invite user** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/nouveau-mot-de-passe`
     - **Reset password** : `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/nouveau-mot-de-passe`
5. `npm install`, puis `npm run creer-admin -- …` pour le premier administrateur, puis `npm run dev`.

## Architecture

- **La base fait foi** : les règles d'accès sont des politiques RLS et des fonctions PostgreSQL (`mon_role()`, `mon_entreprise_id()`, `est_admin()`, `est_plateforme()`). Un utilisateur désactivé ou dont l'entreprise est suspendue n'a plus aucun rôle en base.
- **Rôles** : `administrateur` et `superviseur` (plateforme, sans entreprise) ; `producteur`, `client`, `financier` (rattachés à une entreprise du type correspondant, contrôlé par trigger). Les profils personnalisés ne font que restreindre un rôle de base.
- **Clients Supabase** : [`utils/supabase/server.ts`](utils/supabase/server.ts) (composants serveur, actions), [`client.ts`](utils/supabase/client.ts) (composants client), [`admin.ts`](utils/supabase/admin.ts) (clé de service, serveur uniquement, après contrôle du rôle).
- **Session** : [`proxy.ts`](proxy.ts) rafraîchit la session et redirige vers `/login` ; [`lib/session.ts`](lib/session.ts) charge le contexte (rôle, entreprise, profil).
- **Menus** : registre unique [`lib/menus.ts`](lib/menus.ts) (plafond par rôle ; `bientot` = écran à venir, affiché grisé).
- **Circuit de commande** : aucune écriture directe sur les commandes, livraisons, factures ou échéances ; tout passe par des fonctions PostgreSQL qui vérifient le rôle et le statut, verrouillent les lignes et tracent l'étape dans `commande_evenements` (qui alimente aussi les notifications).
- **Tâche planifiée** : [`app/api/cron/circuit`](app/api/cron/circuit/route.ts) (réceptions tacites, retards, rappels, emails, push), protégée par `CRON_SECRET`.
- **Design** : jetons sémantiques dans [`app/globals.css`](app/globals.css) (`bg-surface`, `text-foreground`, `bg-sidebar`, `bg-primary`…), jamais de couleur brute. Trois thèmes : Savane (défaut), Latérite, Nuit ; sans choix, le thème suit le réglage clair/sombre du système.
- **Installation** : manifeste PWA ([`app/manifest.ts`](app/manifest.ts)) et icônes générées ([`app/icone/[taille]`](app/icone/), [`app/apple-icon.tsx`](app/apple-icon.tsx)) : « Installer » dans Chrome/Edge, « Ajouter au Dock » dans Safari sur Mac, « Sur l'écran d'accueil » sur iPhone.

## Navigateurs à tester à chaque lot

Chrome et Edge (Windows), **Safari et Chrome (Mac)**, Safari (iPhone/iPad), Chrome (Android).
