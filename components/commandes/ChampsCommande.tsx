'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ECHEANCIERS_TYPES, MODES_PAIEMENT, type Echeance } from '@/lib/commandes'
import { REGIONS } from '@/lib/referentiels'
import { formatMontant } from '@/lib/utils'

type Banque = { id: string; denomination: string }

/**
 * Conditions de la commande : livraison, date souhaitée, mode de paiement (banque si bon de paiement) et échéancier.
 * L'échéancier part d'un modèle et reste modifiable ; il est transmis en JSON dans le champ « echeancier ».
 */
export function ChampsCommande({
  prefixe,
  adresseParDefaut,
  regionParDefaut,
  banques,
  montant,
  aujourdhui,
}: {
  prefixe: string
  adresseParDefaut: string | null
  regionParDefaut: string | null
  banques: Banque[]
  montant: number
  aujourdhui: string
}) {
  const [mode, setMode] = useState('virement')
  const [echeances, setEcheances] = useState<Echeance[]>(ECHEANCIERS_TYPES[0].echeances)
  const somme = Math.round(echeances.reduce((s, e) => s + (Number(e.pourcentage) || 0), 0) * 100) / 100
  const id = (nom: string) => `${prefixe}-${nom}`

  const modifier = (i: number, cle: keyof Echeance, valeur: string) =>
    setEcheances((liste) => liste.map((e, j) => (j === i ? { ...e, [cle]: Number(valeur.replace(',', '.')) } : e)))

  return (
    <div className="space-y-5">
      <GrilleChamps>
        <Champ id={id('adresse')} label="Adresse de livraison" requis className="sm:col-span-2">
          <Input id={id('adresse')} name="adresse_livraison" required minLength={3} defaultValue={adresseParDefaut ?? ''} />
        </Champ>
        <Champ id={id('region')} label="Région de livraison">
          <Select id={id('region')} name="region_livraison" defaultValue={regionParDefaut ?? ''}>
            <option value="">—</option>
            {REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Champ>
        <Champ id={id('contact')} label="Contact à la livraison">
          <Input id={id('contact')} name="contact_livraison" placeholder="Nom et téléphone" />
        </Champ>
        <Champ id={id('date')} label="Date de livraison souhaitée" aide="La date convenue sera fixée par le superviseur.">
          <Input id={id('date')} name="date_souhaitee" type="date" min={aujourdhui} />
        </Champ>
        <Champ id={id('mode')} label="Mode de paiement" requis>
          <Select id={id('mode')} name="mode_paiement" required value={mode} onChange={(e) => setMode(e.target.value)}>
            {Object.entries(MODES_PAIEMENT).map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </Select>
        </Champ>
        {mode === 'bon_banque' && (
          <Champ id={id('banque')} label="Banque émettrice du bon" requis aide="La banque devra approuver le bon avant la validation du producteur.">
            <Select id={id('banque')} name="banque_id" required defaultValue="">
              <option value="" disabled>
                {banques.length ? 'Choisir…' : 'Aucune banque inscrite'}
              </option>
              {banques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.denomination}
                </option>
              ))}
            </Select>
          </Champ>
        )}
      </GrilleChamps>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Échéancier de paiement</legend>
        <div className="flex flex-wrap gap-2">
          {ECHEANCIERS_TYPES.map((t) => (
            <button
              key={t.cle}
              type="button"
              onClick={() => setEcheances(t.echeances)}
              className="rounded-full border border-surface-border px-3 py-1 text-xs hover:border-primary hover:text-primary"
            >
              {t.libelle}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {echeances.map((e, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 text-sm">
              <label className="flex items-center gap-2">
                <Input
                  inputMode="decimal"
                  value={Number.isFinite(e.pourcentage) ? String(e.pourcentage) : ''}
                  onChange={(ev) => modifier(i, 'pourcentage', ev.target.value)}
                  aria-label={`Pourcentage de l’échéance ${i + 1}`}
                  className="h-9"
                />
                %
              </label>
              <label className="flex items-center gap-2 whitespace-nowrap">
                <Input
                  inputMode="numeric"
                  value={Number.isFinite(e.delai_jours) ? String(e.delai_jours) : ''}
                  onChange={(ev) => modifier(i, 'delai_jours', ev.target.value)}
                  aria-label={`Délai de l’échéance ${i + 1} en jours`}
                  className="h-9"
                />
                jours
              </label>
              <span className="w-28 text-right tabular-nums text-foreground-muted">
                {formatMontant(Math.round((montant * (Number(e.pourcentage) || 0)) / 100))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={echeances.length === 1}
                onClick={() => setEcheances((l) => l.filter((_, j) => j !== i))}
                aria-label={`Retirer l’échéance ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={echeances.length >= 6}
            onClick={() => setEcheances((l) => [...l, { pourcentage: Math.max(0, 100 - somme), delai_jours: 30 }])}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Ajouter une échéance
          </Button>
          <span className={somme === 100 ? 'text-success' : 'font-medium text-danger'}>Total : {somme.toLocaleString('fr-FR')} %</span>
        </div>
        <p className="text-xs text-foreground-muted">Délais comptés à partir de la facture définitive (établie à la réception).</p>
        <input type="hidden" name="echeancier" value={JSON.stringify(echeances)} />
      </fieldset>

      <Champ id={id('commentaire')} label="Commentaire">
        <Textarea id={id('commentaire')} name="commentaire" rows={2} maxLength={1000} />
      </Champ>
    </div>
  )
}
