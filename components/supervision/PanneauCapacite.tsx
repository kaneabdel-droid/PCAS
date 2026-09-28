import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { niveauRisque, type Analyse } from '@/lib/supervision'
import { formatQuantite } from '@/lib/stocks'
import { cn } from '@/lib/utils'

const NIVEAUX = {
  ok: { libelle: 'Capacité suffisante', classe: 'border-success/40 bg-success/10', barre: 'bg-success', Icone: CheckCircle2, texte: 'text-success' },
  juste: { libelle: 'Capacité juste', classe: 'border-warning/50 bg-warning/10', barre: 'bg-warning', Icone: AlertTriangle, texte: 'text-warning' },
  insuffisant: { libelle: 'Capacité insuffisante', classe: 'border-danger/40 bg-danger/10', barre: 'bg-danger', Icone: XCircle, texte: 'text-danger' },
}

/** Jauge et détail du calcul de capacité d'un producteur pour une ligne de commande. */
export function PanneauCapacite({
  titre,
  analyse,
  quantite,
  unite,
  date,
}: {
  titre: string
  analyse: Analyse
  quantite: number
  unite: string
  date: string
}) {
  const niveau = NIVEAUX[niveauRisque(analyse, quantite)]
  const besoin = analyse.engage + quantite
  const remplissage = analyse.disponible_total > 0 ? Math.min(100, (besoin / analyse.disponible_total) * 100) : 100
  const q = (n: number) => formatQuantite(Math.round(n * 1000) / 1000, unite)

  return (
    <div className={cn('rounded-xl border p-4', niveau.classe)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{titre}</p>
        <span className={cn('inline-flex items-center gap-1 text-sm font-semibold', niveau.texte)}>
          <niveau.Icone className="h-4 w-4" aria-hidden /> {niveau.libelle}
        </span>
      </div>
      <div className="mb-1 h-2.5 overflow-hidden rounded-full bg-surface" role="img" aria-label={`Engagements et commande : ${Math.round(remplissage)} % du disponible`}>
        <div className={cn('h-full rounded-full', niveau.barre)} style={{ width: `${remplissage}%` }} />
      </div>
      <p className="mb-3 text-xs text-foreground-muted">
        Engagements + cette commande : {q(besoin)} sur {q(analyse.disponible_total)} disponibles d’ici le {new Date(date).toLocaleDateString('fr-FR')}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-foreground-muted">Stock disponible</dt>
          <dd className="font-medium tabular-nums">{q(analyse.stock_disponible)}</dd>
        </div>
        {analyse.transforme && (
          <div>
            <dt className="text-xs text-foreground-muted">Potentiel matière première</dt>
            <dd className="font-medium tabular-nums">{q(analyse.potentiel_matiere)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-foreground-muted">Capacité sur la période</dt>
          <dd className="font-medium tabular-nums">{q(analyse.capacite_periode)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Production attendue</dt>
          <dd className="font-medium tabular-nums">{q(analyse.production_attendue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Déjà engagé</dt>
          <dd className="font-medium tabular-nums">{q(analyse.engage)}</dd>
        </div>
        <div>
          <dt className="text-xs text-foreground-muted">Marge après commande</dt>
          <dd className={cn('font-semibold tabular-nums', analyse.marge - quantite < 0 && 'text-danger')}>{q(analyse.marge - quantite)}</dd>
        </div>
      </dl>
    </div>
  )
}
