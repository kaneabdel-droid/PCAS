# PCAS — Applications mobiles et de bureau

PCAS reste **toujours en ligne** : les applications sont des coques natives qui chargent `https://pcas.dembasolution.com`. Une mise à jour du site est donc immédiatement présente dans toutes les applications, sans nouvelle version sur les stores (sauf changement de la coque elle-même).

| Cible | Dossier | Outil | Où compiler |
|---|---|---|---|
| Android | [`mobile/`](../mobile/) | Capacitor 7 | Windows, Mac ou Linux avec Android Studio |
| iPhone, iPad | [`mobile/`](../mobile/) | Capacitor 7 | **Mac** avec Xcode |
| Mac (`.dmg`) | [`desktop/`](../desktop/) | Tauri 2 | **Mac** |
| Windows (`.msi`, `.exe`) | [`desktop/`](../desktop/) | Tauri 2 | Windows |
| Tous (sans installateur) | — | PWA | « Installer » dans Chrome/Edge, « Ajouter au Dock » (Safari Mac), « Sur l'écran d'accueil » (iPhone) |

Fonctions natives utilisées par le site (via le pont Capacitor, voir [`lib/natif.ts`](../lib/natif.ts)) : **notifications push**, **scanner de QR code** (ML Kit), **partage des PDF** (enregistrer, WhatsApp, impression). Elles sont aussi ce qui permet la validation par l'App Store, qui refuse les applications qui ne font qu'afficher un site.

---

## 1. Icônes

Téléchargez l'icône source générée par le site, puis produisez toutes les tailles :

```bash
# depuis pcas/
mkdir -p mobile/assets
curl -o mobile/assets/icon-only.png https://pcas.dembasolution.com/icone/1024
curl -o mobile/assets/icon-foreground.png https://pcas.dembasolution.com/icone/1024-plein
cp mobile/assets/icon-only.png mobile/assets/splash.png
cd mobile && npm install && npm run icones        # Android et iOS
cd ../desktop && npm install && npm run icones    # Mac et Windows (src-tauri/icons)
```

## 2. Notifications push (Firebase)

1. Créez un projet sur [console.firebase.google.com](https://console.firebase.google.com) (« PCAS »).
2. Ajoutez une application **Android** d'identifiant `com.dembasolution.pcas` → téléchargez `google-services.json` → placez-le dans `mobile/android/app/`.
3. Ajoutez une application **iOS** d'identifiant `com.dembasolution.pcas` → `GoogleService-Info.plist` → ajoutez-le au projet Xcode (`mobile/ios/App/App/`).
4. **iPhone** : dans le compte Apple Developer, créez une clé APNs (Keys → +, cochez Apple Push Notifications) et déposez-la dans Firebase (Paramètres du projet → Cloud Messaging → Configuration des applications Apple).
5. **Serveur** : Paramètres du projet → Comptes de service → « Générer une nouvelle clé privée ». Copiez **tout le contenu du fichier JSON** dans la variable d'environnement `FIREBASE_SERVICE_ACCOUNT` sur Vercel. La tâche planifiée envoie alors chaque notification en push aux appareils de l'utilisateur.

## 3. Android

Prérequis : [Android Studio](https://developer.android.com/studio) (il installe le SDK et Java).

```bash
cd mobile
npm install
npm run ajouter:android     # une seule fois : crée mobile/android
npm run android             # synchronise puis ouvre Android Studio
```

Dans Android Studio : **Build › Generate Signed App Bundle** (créez la clé de signature et **conservez-la précieusement** : sans elle, plus de mise à jour possible sur le Play Store). Publiez le `.aab` sur la [Play Console](https://play.google.com/console) (compte 25 $, une fois).

La permission caméra (scanner) et les notifications sont déclarées par les modules ; Android 13+ demande l'autorisation des notifications au premier lancement.

## 4. iPhone et iPad (sur Mac)

Prérequis : Xcode (App Store), compte Apple Developer (99 $/an).

```bash
cd mobile
npm install
npm run ajouter:ios         # une seule fois : crée mobile/ios
npm run ios                 # synchronise puis ouvre Xcode
```

Dans Xcode :
- **Signing & Capabilities** : choisissez l'équipe, ajoutez **Push Notifications** et **Background Modes › Remote notifications**.
- **Info.plist** : ajoutez `NSCameraUsageDescription` = « PCAS utilise l'appareil photo pour scanner le QR code des documents afin d'en vérifier l'authenticité. »
- **Product › Archive**, puis **Distribute App** → App Store Connect → TestFlight pour les essais, puis soumission.

## 5. Mac (sur Mac)

Prérequis : Xcode (ou ses outils en ligne de commande) et [Rust](https://rustup.rs) : `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`, puis `rustup target add aarch64-apple-darwin x86_64-apple-darwin`.

**Signature et notarisation** (pour éviter l'alerte « développeur non identifié ») : dans le compte Apple Developer, créez un certificat **Developer ID Application** et installez-le dans le Trousseau ; créez un mot de passe d'application sur [appleid.apple.com](https://appleid.apple.com). Puis :

```bash
cd desktop
npm install
export APPLE_SIGNING_IDENTITY="Developer ID Application: DembaSolution (EQUIPEID)"
export APPLE_ID="adresse@exemple.com"
export APPLE_PASSWORD="mot-de-passe-d-application"
export APPLE_TEAM_ID="EQUIPEID"
npm run build:mac
```

Résultat : `desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/PCAS_1.0.0_universal.dmg` (processeurs Apple Silicon et Intel), signé et notarisé.

## 6. Windows

Prérequis : [Rust](https://rustup.rs), « Visual Studio Build Tools » (charge de travail C++), WebView2 (déjà présent sur Windows 10/11 à jour).

```powershell
cd desktop
npm install
npm run build:windows
```

Résultats dans `desktop\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\` (`msi` et `nsis`). Pour éviter l'avertissement SmartScreen, signez l'installateur avec un certificat de signature de code.

## 7. À vérifier après la première compilation

- Connexion, navigation, thèmes ; retour arrière Android.
- Notification reçue téléphone verrouillé, et ouverture de la bonne page en la touchant.
- Scanner d'un QR code imprimé → page de vérification.
- « Télécharger PDF » : feuille de partage sur mobile ; fichier dans Téléchargements sur Mac et Windows.
- Mode avion au lancement → écran « Pas de connexion ».
