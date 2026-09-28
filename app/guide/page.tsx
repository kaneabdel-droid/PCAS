import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = { title: 'Guide d’utilisation' }

type Section = { id: string; titre: string; pour: string; etapes: (string | { titre: string; texte: string })[] }

const SECTIONS: Section[] = [
  {
    id: 'demarrer',
    titre: 'Démarrer',
    pour: 'Tous',
    etapes: [
      { titre: 'Votre compte', texte: 'Les comptes sont ouverts par l’administrateur de la plateforme. Vous recevez un email d’invitation : suivez le lien pour choisir votre mot de passe (10 caractères au moins). Pas encore de compte ? « Demander un accès » sur la page de connexion.' },
      { titre: 'Contrat d’engagement', texte: 'Producteurs et clients : un signataire habilité de votre entreprise accepte le contrat d’engagement (menu « Mon entreprise › Contrat d’engagement »). Tant qu’il n’est pas accepté, vous pouvez consulter la plateforme mais pas publier d’offre, commander ni publier de besoin.' },
      { titre: 'Fiche entreprise', texte: 'Complétez votre fiche : identité, NINEA, adresse, logo (il figure sur vos documents) et comptes bancaires (le compte principal est imprimé sur les factures). Tout changement de compte bancaire est signalé à l’administrateur.' },
      { titre: 'Tableau de bord et notifications', texte: 'Le tableau de bord montre ce qui vous attend (commandes à valider, réceptions à confirmer, échéances…). La cloche signale chaque étape ; les notifications sont aussi envoyées par email et, dans l’application mobile, en notification sur le téléphone.' },
    ],
  },
  {
    id: 'producteur',
    titre: 'Producteur',
    pour: 'Producteurs',
    etapes: [
      { titre: '1. Sites et capacités', texte: 'Fiche entreprise › Sites de production : déclarez vos sites, leurs jours ouvrés et la capacité de production par jour de chaque produit. Elle sert à estimer ce que vous pourrez livrer.' },
      { titre: '2. Stocks', texte: 'Stock produits finis et Stock matière première : enregistrez vos entrées (récolte, achat, production), sorties (perte, don) et inventaires. La transformation (ex. paddy → riz blanchi) fait les deux mouvements d’un coup. La matière première n’est jamais visible des clients.' },
      { titre: '3. Offres', texte: 'Mes offres › Nouvelle offre : produit, site, prix en FCFA par unité, quantité. « Disponible maintenant » : limitée à votre stock disponible. « À une date » : production à venir, limitée par votre capacité d’ici là ; elle est commandée ferme. Ajoutez des photos réelles, puis publiez.' },
      { titre: '4. Besoins d’achat', texte: 'Les besoins des clients portant sur vos produits s’affichent (sans le nom du client). Faites une proposition : quantité, prix, date. Si le client la retient, une commande suit le circuit habituel.' },
      { titre: '5. Valider une commande', texte: 'Une commande vous parvient après l’approbation du superviseur (et de la banque si le client paie par bon). Validez-la : le stock est réservé pour ce client. Choisissez à ce moment la facturation regroupée si vous livrez en plusieurs fois. Vous pouvez aussi la refuser, avec un motif.' },
      { titre: '6. Livrer', texte: 'Sur la commande, « Émettre un bon de livraison » (livraison partielle possible). Le stock sort automatiquement et une facture provisoire est établie. Pour une offre à date, déclarez d’abord la production réalisée (sur l’offre).' },
      { titre: '7. Encaisser', texte: 'Après la réception par le client, la facture définitive est établie sur les quantités reçues, avec ses échéances. À chaque paiement reçu, ouvrez la facture et « Marquer payée » (date, mode, référence) : vous seul pouvez le faire. Une erreur se corrige dans les 48 heures.' },
    ],
  },
  {
    id: 'client',
    titre: 'Client',
    pour: 'Clients',
    etapes: [
      { titre: '1. Trouver une offre', texte: 'Offres des producteurs : filtrez par produit, région, disponibilité ; triez par prix. Chaque offre indique la quantité réellement disponible.' },
      { titre: '2. Commander', texte: 'Ajoutez au panier, puis « Commander » : une commande par producteur. Indiquez l’adresse et la date souhaitée, le mode de paiement (virement, chèque, espèces ou bon de paiement de votre banque) et l’échéancier. Le superviseur fixe la date de livraison convenue.' },
      { titre: '3. Exprimer un besoin', texte: 'Vous ne trouvez pas ? Besoins d’achat › Exprimer un besoin. Les producteurs font des propositions sans connaître votre identité ; vous retenez celle qui vous convient.' },
      { titre: '4. Réceptionner', texte: 'À chaque livraison, Livraisons et réceptions : approuvez la réception en corrigeant les quantités reçues si besoin (avec le motif), ou contestez-la (le superviseur arbitre). Sans réponse dans le délai (72 heures par défaut), la réception est réputée conforme ; vous êtes prévenu 48 h et 24 h avant.' },
      { titre: '5. Payer', texte: 'La facture définitive porte les échéances et le compte bancaire du producteur. Suivez-les dans l’Échéancier ; vous êtes prévenu 3 jours avant chaque échéance.' },
    ],
  },
  {
    id: 'banque',
    titre: 'Banque',
    pour: 'Financiers',
    etapes: [
      { titre: 'Bons de paiement', texte: 'Quand le superviseur approuve une commande payée par bon, un bon de paiement vous est adressé (Bons de paiement › À traiter). Approuvez-le avec la référence bancaire de l’engagement, ou refusez-le avec un motif. La commande n’est transmise au producteur qu’après votre approbation.' },
    ],
  },
  {
    id: 'superviseur',
    titre: 'Superviseur',
    pour: 'Superviseurs et administrateurs',
    etapes: [
      { titre: 'Approuver', texte: 'Supervision › Approbations : pour chaque commande, l’analyse de capacité du producteur (stock, matière première, capacité, engagements) indique si elle est tenable. Approuvez en fixant la date de livraison convenue, mettez en attente ou refusez avec un motif.' },
      { titre: 'Réorienter ou répartir', texte: 'Si le producteur ne peut pas honorer la commande, affectez tout ou partie des quantités à d’autres producteurs qui ont une offre publiée du même produit. Une nouvelle commande est créée par producteur ; approuvez-les ensuite.' },
      { titre: 'Litiges', texte: 'Supervision › Litiges de réception : fixez les quantités retenues après une contestation. La facture définitive est établie sur ces quantités.' },
    ],
  },
  {
    id: 'documents',
    titre: 'Documents, QR codes et états',
    pour: 'Tous',
    etapes: [
      { titre: 'Imprimer ou télécharger', texte: 'Sur chaque commande, bon, bon de livraison et facture : « Imprimer / PDF ». Dans l’application mobile, le PDF s’ouvre dans la feuille de partage (enregistrer, WhatsApp…).' },
      { titre: 'Vérifier un document', texte: 'Chaque document porte un QR code : scannez-le (ou « Vérifier un document ») pour contrôler qu’il est authentique et voir les étapes de la commande. Les montants ne sont visibles que des entreprises concernées.' },
      { titre: 'États', texte: 'Impressions et états : commandes, factures, échéancier, paiements reçus, livraisons et écarts, chiffre d’affaires, stocks… Choisissez la période, les colonnes, le portrait ou le paysage, puis imprimez, téléchargez en PDF ou en CSV (Excel).' },
    ],
  },
]

/** Guide d'utilisation (public : consultable avant la connexion). */
export default function GuidePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Logo className="text-foreground" />
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </div>
      <h1 className="font-heading text-3xl font-semibold">Guide d’utilisation</h1>
      <p className="mt-2 text-foreground-muted">
        PCAS relie les producteurs agricoles du Sénégal et leurs clients : offres, commandes, livraisons, factures et paiements, avec
        des documents vérifiables par QR code. Chaque commande suit le même circuit : commande → approbation → (banque) → validation →
        livraison → réception → facture définitive → paiement.
      </p>
      <nav className="my-8 flex flex-wrap gap-2" aria-label="Sections du guide">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-surface-border bg-surface px-3 py-1 text-sm hover:border-primary hover:text-primary">
            {s.titre}
          </a>
        ))}
      </nav>
      <div className="space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="font-heading text-2xl font-semibold">{s.titre}</h2>
            <p className="mb-4 text-sm text-foreground-muted">Pour : {s.pour}</p>
            <ol className="space-y-3">
              {s.etapes.map((e, i) =>
                typeof e === 'string' ? (
                  <li key={i}>{e}</li>
                ) : (
                  <li key={i} className="rounded-xl border border-surface-border bg-surface p-4">
                    <p className="font-semibold">{e.titre}</p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{e.texte}</p>
                  </li>
                )
              )}
            </ol>
          </section>
        ))}
      </div>
      <p className="mt-12 text-center text-xs text-foreground-muted">PCAS — Plateforme de Commercialisation Agricole du Sénégal · un produit DembaSolution</p>
    </main>
  )
}
