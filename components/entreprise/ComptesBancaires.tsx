import { Landmark, Star } from 'lucide-react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Card } from '@/components/ui/card'
import { Badge, Champ, GrilleChamps, Vide } from '@/components/ui/champ'
import { Input } from '@/components/ui/input'
import { ajouterCompte, definirComptePrincipal, supprimerCompte } from '@/app/(app)/entreprise/actions'
import type { CompteBancaire } from '@/lib/entreprise'

/** Comptes bancaires de l'entreprise ; le compte principal est imprimé sur les factures du producteur. */
export function ComptesBancaires({ entrepriseId, comptes }: { entrepriseId: string; comptes: CompteBancaire[] }) {
  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
        Tout ajout, modification ou suppression de compte bancaire est enregistré dans le journal d’audit et signalé à
        l’administrateur de la plateforme (prévention de la fraude au RIB).
      </p>

      {comptes.length === 0 ? (
        <Vide titre="Aucun compte bancaire">Ajoutez au moins un compte : le compte principal figure sur les factures.</Vide>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {comptes.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-3 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary" aria-hidden>
                      <Landmark className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{c.banque}</p>
                      <p className="text-sm text-foreground-muted">{c.intitule}</p>
                    </div>
                  </div>
                  {c.principal && <Badge ton="primaire">Principal</Badge>}
                </div>
                <p className="font-mono text-sm tracking-wide">{c.numero_compte}</p>
                {c.code_swift && <p className="text-xs text-foreground-muted">SWIFT / BIC : {c.code_swift}</p>}
                <div className="mt-auto flex flex-wrap gap-2 border-t border-surface-border pt-3">
                  {!c.principal && (
                    <FormulaireAction action={definirComptePrincipal} libelle="Définir comme principal" variante="outline" boutonClassName="h-8 px-3 text-xs">
                      <input type="hidden" name="entreprise_id" value={entrepriseId} />
                      <input type="hidden" name="compte_id" value={c.id} />
                    </FormulaireAction>
                  )}
                  <FormulaireAction
                    action={supprimerCompte}
                    libelle="Supprimer"
                    variante="ghost"
                    boutonClassName="h-8 px-3 text-xs text-danger"
                    confirmation={`Supprimer le compte ${c.banque} — ${c.numero_compte} ?`}
                  >
                    <input type="hidden" name="entreprise_id" value={entrepriseId} />
                    <input type="hidden" name="compte_id" value={c.id} />
                  </FormulaireAction>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <h3 className="mb-4 flex items-center gap-2 font-heading font-semibold">
          <Star className="h-4 w-4 text-accent" aria-hidden /> Ajouter un compte
        </h3>
        <FormulaireAction action={ajouterCompte} libelle="Ajouter le compte" reinitialiser>
          <input type="hidden" name="entreprise_id" value={entrepriseId} />
          <GrilleChamps>
            <Champ id="banque" label="Banque" requis>
              <Input id="banque" name="banque" required placeholder="Ex. CBAO, BICIS, Ecobank…" />
            </Champ>
            <Champ id="intitule" label="Intitulé du compte" requis>
              <Input id="intitule" name="intitule" required />
            </Champ>
            <Champ id="numero_compte" label="Numéro de compte (RIB / IBAN)" requis>
              <Input id="numero_compte" name="numero_compte" required className="font-mono" />
            </Champ>
            <Champ id="code_swift" label="Code SWIFT / BIC">
              <Input id="code_swift" name="code_swift" className="font-mono uppercase" />
            </Champ>
          </GrilleChamps>
        </FormulaireAction>
      </Card>
    </div>
  )
}
