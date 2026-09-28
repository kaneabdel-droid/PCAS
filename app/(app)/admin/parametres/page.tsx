import type { Metadata } from 'next'
import { revalidatePath } from 'next/cache'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card, PageHeader } from '@/components/ui/card'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Textarea } from '@/components/ui/input'
import { estAdmin } from '@/lib/admin'
import { messageErreur, nombre, requis, texte, type Resultat } from '@/lib/formulaire'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: 'Paramètres' }

async function enregistrerParametres(fd: FormData): Promise<Resultat> {
  'use server'
  if (!(await estAdmin())) return { error: 'Réservé à l’administrateur.' }
  const grace = nombre(fd, 'delai_grace_contrat_jours')
  const tacite = nombre(fd, 'delai_reception_tacite_heures')
  if (grace === null || !Number.isInteger(grace) || grace < 0 || grace > 90) return { error: 'Délai de grâce : entre 0 et 90 jours.' }
  if (tacite === null || !Number.isInteger(tacite) || tacite < 24 || tacite > 720) return { error: 'Réception tacite : entre 24 et 720 heures.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('parametres_plateforme')
    .update({
      delai_grace_contrat_jours: grace,
      delai_reception_tacite_heures: tacite,
      mention_tva: requis(fd, 'mention_tva') || 'Exonéré de TVA',
      mentions_legales: texte(fd, 'mentions_legales'),
    })
    .eq('id', true)
  if (error) return { error: messageErreur(error, 'Enregistrement impossible.') }
  revalidatePath('/admin/parametres')
  return { success: 'Paramètres enregistrés.' }
}

export default async function ParametresPage() {
  const supabase = await createClient()
  const { data: p } = await supabase.from('parametres_plateforme').select('*').single()

  return (
    <>
      <PageHeader titre="Paramètres de la plateforme" description="Délais et mentions appliqués à toutes les entreprises." />
      <Card>
        <FormulaireAction action={enregistrerParametres} libelle="Enregistrer">
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
        </FormulaireAction>
      </Card>
    </>
  )
}
