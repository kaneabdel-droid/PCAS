import { Apple, Carrot, Wheat } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { FORMES_JURIDIQUES, REGIONS, TYPES_IDENTIFIANT } from '@/lib/referentiels'
import { LIBELLES_TYPES_ENTREPRISE } from '@/lib/roles'
import { FILIERES, FILIERES_CODES, type FiliereCode } from '@/lib/filieres'
import { cn } from '@/lib/utils'
import type { Entreprise } from '@/lib/entreprise'
import type { Resultat } from '@/lib/formulaire'

/** Fiche d'information entreprise : création (avec choix du type, par l'administrateur) ou modification. */
export function FicheForm({
  entreprise,
  action,
  libelle,
  choixType = false,
  typeParDefaut,
}: {
  entreprise?: Entreprise
  action: (fd: FormData) => Promise<Resultat>
  libelle: string
  choixType?: boolean
  typeParDefaut?: string
}) {
  const e = entreprise
  const filieresInitiales: FiliereCode[] =
    e?.filieres && e.filieres.length > 0 ? e.filieres : ['cereale', 'maraichage', 'fruitier']

  return (
    <FormulaireAction action={action} libelle={libelle}>
      {e?.id && <input type="hidden" name="entreprise_id" value={e.id} />}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Identité</h3>
        <GrilleChamps colonnes={3}>
          {choixType && (
            <Champ id="type" label="Type d’entreprise" requis>
              <Select id="type" name="type" required defaultValue={typeParDefaut ?? ''}>
                <option value="" disabled>
                  Choisir…
                </option>
                {Object.entries(LIBELLES_TYPES_ENTREPRISE).map(([cle, libelleType]) => (
                  <option key={cle} value={cle}>
                    {libelleType}
                  </option>
                ))}
              </Select>
            </Champ>
          )}
          <Champ id="denomination" label="Dénomination" requis className={choixType ? '' : 'sm:col-span-2'}>
            <Input id="denomination" name="denomination" required minLength={2} defaultValue={e?.denomination} />
          </Champ>
          <Champ id="sigle" label="Sigle">
            <Input id="sigle" name="sigle" defaultValue={e?.sigle ?? ''} />
          </Champ>
          <Champ id="forme_juridique" label="Forme juridique">
            <Select id="forme_juridique" name="forme_juridique" defaultValue={e?.forme_juridique ?? ''}>
              <option value="">—</option>
              {FORMES_JURIDIQUES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </Select>
          </Champ>
          <Champ id="representant_legal" label="Représentant légal">
            <Input id="representant_legal" name="representant_legal" defaultValue={e?.representant_legal ?? ''} />
          </Champ>
        </GrilleChamps>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Filières d’appartenance
          </h3>
          <p className="mt-1 text-xs text-foreground-muted">
            Précisez la ou les filières agricoles de l’entreprise. L’entreprise sera dirigée exclusivement dans cette ou ces filières, et verrouillée sur le reste de la plateforme.
          </p>
        </div>
        <input type="hidden" name="gestion_filieres" value="1" />
        <div className="grid gap-3 sm:grid-cols-3">
          {FILIERES_CODES.map((code) => {
            const f = FILIERES[code]
            const Icone = code === 'cereale' ? Wheat : code === 'maraichage' ? Carrot : Apple
            const cocheParDefaut = filieresInitiales.includes(code)

            return (
              <label
                key={code}
                className={cn(
                  'relative flex cursor-pointer flex-col justify-between rounded-xl border p-4 transition-all duration-200',
                  'border-surface-border bg-surface hover:border-surface-border/80 hover:shadow-xs has-checked:border-2 has-checked:shadow-xs',
                  code === 'cereale' && 'has-checked:border-amber-500 has-checked:bg-amber-50/40 dark:has-checked:bg-amber-950/20',
                  code === 'maraichage' && 'has-checked:border-emerald-500 has-checked:bg-emerald-50/40 dark:has-checked:bg-emerald-950/20',
                  code === 'fruitier' && 'has-checked:border-rose-500 has-checked:bg-rose-50/40 dark:has-checked:bg-rose-950/20'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-2xs', f.theme.emblemBg)}>
                      <Icone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-heading text-sm font-bold text-foreground">{f.nomCourt}</p>
                      <p className="text-[11px] text-foreground-muted">{f.nom}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    name="filieres"
                    value={code}
                    defaultChecked={cocheParDefaut}
                    className="h-4 w-4 rounded border-surface-border accent-primary"
                  />
                </div>
                <p className="mt-3 text-xs text-foreground-muted line-clamp-2">{f.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.exemplesCultures.slice(0, 3).map((c) => (
                    <span key={c} className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-foreground-muted">
                      {c}
                    </span>
                  ))}
                </div>
              </label>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Identification</h3>
        <GrilleChamps colonnes={3}>
          <Champ id="type_identifiant" label="Type d’identifiant">
            <Select id="type_identifiant" name="type_identifiant" defaultValue={e?.type_identifiant ?? 'NINEA'}>
              {TYPES_IDENTIFIANT.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Champ>
          <Champ id="identifiant_fiscal" label="Numéro d’identification" aide="NINEA au Sénégal, ou équivalent.">
            <Input id="identifiant_fiscal" name="identifiant_fiscal" defaultValue={e?.identifiant_fiscal ?? ''} />
          </Champ>
          <Champ id="rccm" label="RCCM">
            <Input id="rccm" name="rccm" defaultValue={e?.rccm ?? ''} />
          </Champ>
        </GrilleChamps>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">Adresse et contact</h3>
        <GrilleChamps colonnes={3}>
          <Champ id="adresse" label="Adresse" className="sm:col-span-2 lg:col-span-3">
            <Input id="adresse" name="adresse" defaultValue={e?.adresse ?? ''} autoComplete="street-address" />
          </Champ>
          <Champ id="region" label="Région">
            <Select id="region" name="region" defaultValue={e?.region ?? ''}>
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Champ>
          <Champ id="departement" label="Département">
            <Input id="departement" name="departement" defaultValue={e?.departement ?? ''} />
          </Champ>
          <Champ id="commune" label="Commune">
            <Input id="commune" name="commune" defaultValue={e?.commune ?? ''} />
          </Champ>
          <Champ id="telephone" label="Téléphone">
            <Input id="telephone" name="telephone" type="tel" defaultValue={e?.telephone ?? ''} autoComplete="tel" />
          </Champ>
          <Champ id="email" label="Email">
            <Input id="email" name="email" type="email" defaultValue={e?.email ?? ''} autoComplete="email" />
          </Champ>
          <Champ id="site_web" label="Site web">
            <Input id="site_web" name="site_web" type="url" placeholder="https://" defaultValue={e?.site_web ?? ''} />
          </Champ>
        </GrilleChamps>
      </section>
    </FormulaireAction>
  )
}
