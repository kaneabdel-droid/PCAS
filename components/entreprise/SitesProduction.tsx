import { Factory, MapPin, Plus } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import {
  ajouterSite,
  enregistrerCapacite,
  modifierSite,
  supprimerCapacite,
  supprimerSite,
} from '@/app/(app)/entreprise/actions'
import { REGIONS } from '@/lib/referentiels'
import type { Site } from '@/lib/entreprise'

type Produit = { id: string; nom: string; unite: string }

const nombreFr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })

function ChampsSite({ site }: { site?: Site }) {
  return (
    <GrilleChamps colonnes={3}>
      <Champ id={`nom-${site?.id ?? 'nouveau'}`} label="Nom du site" requis>
        <Input id={`nom-${site?.id ?? 'nouveau'}`} name="nom" required defaultValue={site?.nom} />
      </Champ>
      <Champ id={`region-${site?.id ?? 'nouveau'}`} label="Région">
        <Select id={`region-${site?.id ?? 'nouveau'}`} name="region" defaultValue={site?.region ?? ''}>
          <option value="">—</option>
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Champ>
      <Champ id={`departement-${site?.id ?? 'nouveau'}`} label="Département">
        <Input id={`departement-${site?.id ?? 'nouveau'}`} name="departement" defaultValue={site?.departement ?? ''} />
      </Champ>
      <Champ id={`commune-${site?.id ?? 'nouveau'}`} label="Commune">
        <Input id={`commune-${site?.id ?? 'nouveau'}`} name="commune" defaultValue={site?.commune ?? ''} />
      </Champ>
      <Champ id={`localite-${site?.id ?? 'nouveau'}`} label="Localité / village">
        <Input id={`localite-${site?.id ?? 'nouveau'}`} name="localite" defaultValue={site?.localite ?? ''} />
      </Champ>
      <Champ id={`superficie-${site?.id ?? 'nouveau'}`} label="Superficie (ha)">
        <Input id={`superficie-${site?.id ?? 'nouveau'}`} name="superficie_ha" inputMode="decimal" defaultValue={site?.superficie_ha ?? ''} />
      </Champ>
      <Champ id={`latitude-${site?.id ?? 'nouveau'}`} label="Latitude" aide="Ex. 16.0326 (facultatif)">
        <Input id={`latitude-${site?.id ?? 'nouveau'}`} name="latitude" inputMode="decimal" defaultValue={site?.latitude ?? ''} />
      </Champ>
      <Champ id={`longitude-${site?.id ?? 'nouveau'}`} label="Longitude" aide="Ex. -16.4896 (facultatif)">
        <Input id={`longitude-${site?.id ?? 'nouveau'}`} name="longitude" inputMode="decimal" defaultValue={site?.longitude ?? ''} />
      </Champ>
      <Champ id={`jours-${site?.id ?? 'nouveau'}`} label="Jours ouvrés par semaine" aide="Sert au calcul de la production attendue.">
        <Input
          id={`jours-${site?.id ?? 'nouveau'}`}
          name="jours_ouvres_semaine"
          type="number"
          min={1}
          max={7}
          defaultValue={site?.jours_ouvres_semaine ?? 6}
        />
      </Champ>
    </GrilleChamps>
  )
}

/**
 * Sites de production et capacité de production par jour ouvré, par produit : avec le stock de matière première,
 * elles permettent au superviseur d'estimer la production attendue d'un producteur.
 */
export function SitesProduction({ entrepriseId, sites, produits }: { entrepriseId: string; sites: Site[]; produits: Produit[] }) {
  return (
    <div className="space-y-6">
      {sites.length === 0 && <Vide titre="Aucun site de production">Déclarez vos sites et leur capacité de production par jour.</Vide>}

      {sites.map((site) => (
        <Card key={site.id} className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                <Factory className="h-5 w-5" />
              </span>
              <div>
                <p className="font-heading font-semibold">{site.nom}</p>
                <p className="flex items-center gap-1 text-sm text-foreground-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {[site.localite, site.commune, site.region].filter(Boolean).join(', ') || 'Localisation non renseignée'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {site.superficie_ha !== null && <Badge>{nombreFr(site.superficie_ha)} ha</Badge>}
              <Badge>{site.jours_ouvres_semaine} j / semaine</Badge>
              {!site.actif && <Badge ton="alerte">Inactif</Badge>}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Capacité de production par jour ouvré</h4>
            {site.capacites_production.length === 0 ? (
              <p className="text-sm text-foreground-muted">Aucune capacité déclarée.</p>
            ) : (
              <ul className="divide-y divide-surface-border rounded-lg border border-surface-border">
                {site.capacites_production.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{c.produits?.nom}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">
                        {nombreFr(c.capacite_jour)} {c.produits?.unite} / jour
                      </span>
                      <FormulaireAction action={supprimerCapacite} libelle="Retirer" variante="ghost" boutonClassName="h-7 px-2 text-xs text-danger">
                        <input type="hidden" name="entreprise_id" value={entrepriseId} />
                        <input type="hidden" name="capacite_id" value={c.id} />
                      </FormulaireAction>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <FormulaireAction action={enregistrerCapacite} libelle="Enregistrer la capacité" variante="outline" className="mt-3" reinitialiser>
              <input type="hidden" name="entreprise_id" value={entrepriseId} />
              <input type="hidden" name="site_id" value={site.id} />
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <Select name="produit_id" required defaultValue="" aria-label="Produit">
                  <option value="" disabled>
                    Produit fini…
                  </option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} ({p.unite})
                    </option>
                  ))}
                </Select>
                <Input name="capacite_jour" inputMode="decimal" required placeholder="Quantité par jour" aria-label="Capacité par jour" />
              </div>
            </FormulaireAction>
          </div>

          <details className="group rounded-lg border border-surface-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground">
              Modifier le site
            </summary>
            <div className="space-y-4 border-t border-surface-border p-3">
              <FormulaireAction action={modifierSite} libelle="Enregistrer le site">
                <input type="hidden" name="entreprise_id" value={entrepriseId} />
                <input type="hidden" name="site_id" value={site.id} />
                <ChampsSite site={site} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="actif" defaultChecked={site.actif} className="h-4 w-4 accent-primary" /> Site actif
                </label>
              </FormulaireAction>
              <FormulaireAction
                action={supprimerSite}
                libelle="Supprimer le site"
                variante="ghost"
                boutonClassName="text-danger"
                confirmation={`Supprimer le site « ${site.nom} » et ses capacités ?`}
              >
                <input type="hidden" name="entreprise_id" value={entrepriseId} />
                <input type="hidden" name="site_id" value={site.id} />
              </FormulaireAction>
            </div>
          </details>
        </Card>
      ))}

      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-heading font-semibold">
          <Plus className="h-4 w-4 text-accent" aria-hidden /> Ajouter un site de production
        </h3>
        <FormulaireAction action={ajouterSite} libelle="Ajouter le site" reinitialiser>
          <input type="hidden" name="entreprise_id" value={entrepriseId} />
          <ChampsSite />
        </FormulaireAction>
      </Card>
    </div>
  )
}
