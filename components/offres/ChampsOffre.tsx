'use client'

import { useState } from 'react'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import type { Offre } from '@/lib/offres'

type Option = { id: string; nom: string; unite?: string }

/** Champs d'une offre. « À une date » fait apparaître la date de disponibilité (offre à court ou moyen terme). */
export function ChampsOffre({ offre, sites, produits, aujourdhui }: { offre?: Offre; sites: Option[]; produits: Option[]; aujourdhui: string }) {
  const [aDate, setADate] = useState(Boolean(offre?.date_disponibilite))
  const [produit, setProduit] = useState(offre?.produit_id ?? '')
  const unite = produits.find((p) => p.id === produit)?.unite ?? offre?.produits?.unite

  return (
    <div className="space-y-6">
      <GrilleChamps colonnes={3}>
        <Champ id="produit_id" label="Produit" requis>
          <Select id="produit_id" name="produit_id" required value={produit} onChange={(e) => setProduit(e.target.value)}>
            <option value="" disabled>
              Choisir…
            </option>
            {produits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} ({p.unite})
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="site_id" label="Site de production" requis>
          <Select id="site_id" name="site_id" required defaultValue={offre?.site_id ?? (sites.length === 1 ? sites[0].id : '')}>
            <option value="" disabled>
              Choisir…
            </option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="prix_unitaire" label={`Prix unitaire (FCFA${unite ? ` par ${unite}` : ''})`} requis>
          <Input id="prix_unitaire" name="prix_unitaire" required inputMode="numeric" defaultValue={offre?.prix_unitaire} />
        </Champ>
        <Champ id="quantite_offerte" label={`Quantité offerte${unite ? ` (${unite})` : ''}`} requis>
          <Input id="quantite_offerte" name="quantite_offerte" required inputMode="decimal" defaultValue={offre?.quantite_offerte} />
        </Champ>
        <Champ id="quantite_min_commande" label="Quantité minimale par commande">
          <Input id="quantite_min_commande" name="quantite_min_commande" inputMode="decimal" defaultValue={offre?.quantite_min_commande ?? ''} />
        </Champ>
        <Champ id="date_fin_validite" label="Offre valable jusqu’au">
          <Input id="date_fin_validite" name="date_fin_validite" type="date" min={aujourdhui} defaultValue={offre?.date_fin_validite ?? ''} />
        </Champ>
      </GrilleChamps>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">Disponibilité</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${!aDate ? 'border-primary bg-primary-soft' : 'border-surface-border'}`}>
            <input type="radio" name="disponibilite" value="maintenant" checked={!aDate} onChange={() => setADate(false)} className="mt-0.5 accent-primary" />
            <span>
              <strong className="block">Disponible maintenant</strong>
              <span className="text-foreground-muted">Limitée par votre stock disponible de ce produit sur ce site.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${aDate ? 'border-primary bg-primary-soft' : 'border-surface-border'}`}>
            <input type="radio" name="disponibilite" value="a_date" checked={aDate} onChange={() => setADate(true)} className="mt-0.5 accent-primary" />
            <span>
              <strong className="block">À une date (production à venir)</strong>
              <span className="text-foreground-muted">
                Commandée ferme ; limitée par votre capacité de production d’ici là. Court terme jusqu’à 90 jours, moyen terme au-delà.
              </span>
            </span>
          </label>
        </div>
        {aDate && (
          <Champ id="date_disponibilite" label="Date de disponibilité" requis className="max-w-xs">
            <Input id="date_disponibilite" name="date_disponibilite" type="date" required min={aujourdhui} defaultValue={offre?.date_disponibilite ?? ''} />
          </Champ>
        )}
      </fieldset>

      <GrilleChamps colonnes={3}>
        <Champ id="variete" label="Variété">
          <Input id="variete" name="variete" defaultValue={offre?.variete ?? ''} placeholder="Ex. Sahel 108, Kent…" />
        </Champ>
        <Champ id="calibre" label="Calibre">
          <Input id="calibre" name="calibre" defaultValue={offre?.calibre ?? ''} />
        </Champ>
        <Champ id="qualite" label="Qualité">
          <Input id="qualite" name="qualite" defaultValue={offre?.qualite ?? ''} placeholder="Ex. 1er choix, bio…" />
        </Champ>
        <Champ id="conditionnement" label="Conditionnement">
          <Input id="conditionnement" name="conditionnement" defaultValue={offre?.conditionnement ?? ''} placeholder="Ex. sacs de 25 kg filets" />
        </Champ>
        <Champ id="description" label="Description" className="sm:col-span-2">
          <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={offre?.description ?? ''} />
        </Champ>
      </GrilleChamps>
    </div>
  )
}
