# PCAS — Mise en production

Check-list pour passer de l'environnement de développement actuel à `https://pcas.dembasolution.com`.

## 1. Base de données (Supabase)

- [ ] **Projet de production** : soit le projet actuel (`vrcvjpqrtnngfapdyunz`) après nettoyage des données de démonstration, soit un projet neuf. Un projet neuf est plus propre : appliquez-y les migrations `00` à `12` dans l'ordre, puis `npm run creer-admin`.
- [ ] **Offre Supabase** : l'offre gratuite met le projet en pause après une semaine sans activité et n'a pas de sauvegarde restaurable. Pour la production, passez en **Pro** (sauvegardes quotidiennes) ; activez le **Point-in-Time Recovery** si le volume le justifie.
- [ ] **Audit** : exécutez [`supabase/audit/verifications.sql`](../supabase/audit/verifications.sql) ; chaque requête doit renvoyer zéro ligne.
- [ ] **Authentication › Sign In / Providers** : inscription libre **désactivée**.
- [ ] **Authentication › URL Configuration** : *Site URL* = `https://pcas.dembasolution.com` ; *Redirect URLs* : `https://pcas.dembasolution.com/**`.
- [ ] **Authentication › Email Templates** (invitation, réinitialisation) : liens vers `/auth/confirm` (voir README).
- [ ] **Authentication › Emails › SMTP** : Resend (`smtp.resend.com`, port 465, utilisateur `resend`, mot de passe = clé API, expéditeur `noreply@dembasolution.com`).
- [ ] **Données de démonstration** (si vous gardez le projet actuel) : désactivez ou supprimez les comptes `@pcas.test` et les entreprises « (démo) ». Une entreprise qui a un historique ne se supprime pas : suspendez-la depuis Administration › Entreprises.

## 2. Application (Vercel)

- [ ] Poussez `pcas/` dans son propre dépôt GitHub, puis **Vercel › Add New Project** : *Root Directory* = racine du dépôt, framework Next.js.
- [ ] **Variables d'environnement** (Production) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet de production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé secrète (`sb_secret_…`) |
| `NEXT_PUBLIC_SITE_URL` | `https://pcas.dembasolution.com` |
| `CRON_SECRET` | la valeur générée (jamais commitée) |
| `RESEND_API_KEY` | clé API Resend dédiée à PCAS |
| `EMAIL_EXPEDITEUR` | `PCAS <noreply@dembasolution.com>` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON du compte de service (quand les applications mobiles seront publiées) |

- [ ] **Domaine** : Vercel › Settings › Domains › `pcas.dembasolution.com` ; chez le registraire de `dembasolution.com`, ajoutez l'enregistrement **CNAME** `pcas` → `cname.vercel-dns.com` (Vercel indique la valeur exacte).
- [ ] **Tâche planifiée** : `vercel.json` l'appelle une fois par jour à 6 h UTC (réceptions tacites, retards, rappels, emails, push), seule fréquence acceptée par l'offre gratuite de Vercel (un déploiement avec une tâche plus fréquente est refusé). Avec l'offre **Vercel Pro**, passez-la toutes les heures (`"0 * * * *"`) pour que la réception tacite et les rappels tombent à l'heure près.
- [ ] Région : `dub1` (Dublin) dans `vercel.json`, au plus près de l'Afrique de l'Ouest parmi les régions Vercel ; choisissez la même zone pour le projet Supabase.

## 3. Vérifications après le déploiement

- [ ] `npm run lint`, `npm run typecheck` et `npm run build` passent (déjà vérifiés à chaque lot).
- [ ] **Recette** sur un projet de test : `npm run recette` → toutes les vérifications réussies (dernière exécution : 28/28).
- [ ] Connexion, invitation d'un utilisateur réel (email reçu), mot de passe oublié.
- [ ] Une commande complète entre deux entreprises réelles, jusqu'à « soldée ».
- [ ] QR code d'une facture scanné avec un téléphone en navigation privée (authentique, sans montant).
- [ ] Emails de notification reçus ; tâche planifiée visible dans Vercel › Crons.
- [ ] Navigateurs : Chrome et Edge (Windows), **Safari et Chrome (Mac)**, Safari (iPhone), Chrome (Android) ; impression et PDF d'une facture sur chacun.
- [ ] Installation PWA : « Installer » (Chrome/Edge), « Ajouter au Dock » (Safari Mac), « Sur l'écran d'accueil » (iPhone).

## 4. Avant l'ouverture aux entreprises

- [ ] **Contrats d'engagement** relus par un juriste (droit sénégalais et OHADA), publiés en nouvelle version si le texte change (Administration › Contrats).
- [ ] **Mentions légales** et délais (Administration › Paramètres).
- [ ] Catalogue produits et rendements vérifiés (Administration › Catalogue produits).
- [ ] Applications mobiles et de bureau : voir [`applications.md`](applications.md).
