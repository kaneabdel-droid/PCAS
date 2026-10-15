import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { Apple, Carrot, Wheat } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Textarea } from '@/components/ui/input'
import { estAdmin } from '@/lib/admin'
import { messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { FILIERES, FILIERES_CODES, type FiliereCode } from '@/lib/filieres'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Paramètres & Filières' }

const ICONES = {
  cereale: Wheat,
  maraichage: Carrot,
  fruitier: Apple,
}

async function enregistrerParametres(fd: FormData): Promise<Resultat> {
  'use server'
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const grace = nombre(fd, 'delai_grace_contrat_jours')
  const tacite = nombre(fd, 'delai_reception_tacite_heures')
  if (grace === null || !Number.isInteger(grace) || grace < 0 || grace > 90) return { error: 'Délai de grâce : entre 0 et 90 jours.' }
  if (tacite === null || !Number.isInteger(tacite) || tacite < 24 || tacite > 720) return { error: 'Réception tacite : entre 24 et 720 heures.' }

  // Filières activées par le SuperAdmin
  const filieresSelectionnees = fd.getAll('filieres') as FiliereCode[]
  const filieresValides = filieresSelectionnees.filter((f) => FILIERES_CODES.includes(f))
  if (filieresValides.length === 0) {
    return { error: 'Vous devez activer au moins une filière agricole sur la plateforme.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('parametres_plateforme')
    .update({
      filieres_actives: filieresValides,
      delai_grace_contrat_jours: grace,
      delai_reception_tacite_heures: tacite,
      mention_tva: requis(fd, 'mention_tva') || 'Exonéré de TVA',
      mentions_legales: texte(fd, 'mentions_legales'),
    })
    .eq('id', true)
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/parametres')
  revalidatePath('/')
  revalidatePath('/marche')
  revalidatePath('/commandes')
  revalidatePath('/supervision/approbations')
  revalidatePath('/supervision/capacites')
  revalidatePath('/supervision/litiges')
  return { success: 'Paramètres et filières agricoles enregistrés avec succès.' }
}

export default async function ParametresPage() {
  const supabase = await createClient()
  const { data: p } = await supabase.from('parametres_plateforme').select('*').single()
  const filieresActives: FiliereCode[] = Array.isArray(p?.filieres_actives) && p.filieres_actives.length > 0
    ? p.filieres_actives
    : ['cereale', 'maraichage', 'fruitier']

  return (
    <>
      <PageHeader
        titre="Paramètres & Filières"
        description="Configuration générale, activation des filières agricoles distribuées et délais légaux de la plateforme."
      />
      <FormulaireAction action={enregistrerParametres} libelle="Enregistrer les paramètres">
        <div className="space-y-6">
          {/* Activation des filières */}
          <Card>
            <div className="mb-4">
              <h2 className="font-heading text-lg font-semibold">Filières Agricoles Actives</h2>
              <p className="text-sm text-foreground-muted">
                Activez la ou les filières que vous souhaitez déployer. Si une seule filière est cochée, le système fonctionnera
                comme une plateforme dédiée à cette filière. Si plusieurs sont activées, le système permet la supervision par filière
                ainsi que la vue globale consolidée.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {FILIERES_CODES.map((code) => {
                const f = FILIERES[code]
                const Icone = ICONES[code]
                const cochee = filieresActives.includes(code)
                return (
                  <label
                    key={code}
                    className={cn(
                      'relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-all',
                      cochee
                        ? cn(f.theme.bgSoft, f.theme.borderAccent, 'shadow-xs ring-1 ring-current/20')
                        : 'border-surface-border bg-surface hover:bg-surface-muted opacity-75'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg border shadow-xs', f.theme.badgeClass)}>
                        <Icone className="h-5 w-5" aria-hidden />
                      </span>
                      <input
                        type="checkbox"
                        name="filieres"
                        value={code}
                        defaultChecked={cochee}
                        className="h-5 w-5 rounded accent-primary"
                      />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-foreground">{f.nom}</p>
                      <p className="mt-1 text-xs text-foreground-muted">{f.description}</p>
                      <p className="mt-2 text-[11px] font-medium text-foreground-muted/80">
                        Ex : {f.exemples}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </Card>

          {/* Délais et mentions */}
          <Card>
            <div className="mb-4">
              <h2 className="font-heading text-lg font-semibold">Délais Opérationnels & Mentions</h2>
              <p className="text-sm text-foreground-muted">Délais légaux de livraison et mentions figurant sur les factures.</p>
            </div>
            <GrilleChamps>
              <Champ
                id="delai_grace_contrat_jours"
                label="Délai de grâce d’un nouveau contrat (jours)"
                aide="Après la publication d’une nouvelle version, une entreprise en règle sur la version précédente garde l’accès pendant ce délai."
              >
                <Input id="delai_grace_contrat_jours" name="delai_grace_contrat_jours" type="number" min={0} max={90} defaultValue={p?.delai_grace_contrat_jours ?? 15} />
              </Champ>
              <Champ
                id="delai_reception_tacite_heures"
                label="Réception tacite (heures après la livraison)"
                aide="Sans réponse du client dans ce délai, la réception est réputée conforme au bon de livraison."
              >
                <Input
                  id="delai_reception_tacite_heures"
                  name="delai_reception_tacite_heures"
                  type="number"
                  min={24}
                  max={720}
                  defaultValue={p?.delai_reception_tacite_heures ?? 72}
                />
              </Champ>
              <Champ id="mention_tva" label="Mention TVA sur les factures">
                <Input id="mention_tva" name="mention_tva" defaultValue={p?.mention_tva ?? 'Exonéré de TVA'} />
              </Champ>
              <Champ id="mentions_legales" label="Mentions légales (pied des documents)" className="sm:col-span-2">
                <Textarea id="mentions_legales" name="mentions_legales" rows={3} defaultValue={p?.mentions_legales ?? ''} />
              </Champ>
            </GrilleChamps>
          </Card>
        </div>
      </FormulaireAction>
    </>
  )
}

