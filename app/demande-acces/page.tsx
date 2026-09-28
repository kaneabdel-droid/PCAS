import type { Metadata } from 'next'
import Link from 'next/link'
import { EcranAuth } from '@/components/EcranAuth'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Champ } from '@/components/ui/champ'
import { Input, Select, Textarea } from '@/components/ui/input'
import { deposerDemande } from '@/app/demande-acces/actions'
import { REGIONS } from '@/lib/referentiels'
import { LIBELLES_TYPES_ENTREPRISE } from '@/lib/roles'

export const metadata: Metadata = { title: 'Demander un accès' }

export default function DemandeAccesPage() {
  return (
    <EcranAuth titre="Demander un accès" sousTitre="Producteurs, acheteurs et banques : présentez votre entreprise, nous vous recontactons.">
      <FormulaireAction action={deposerDemande} libelle="Envoyer ma demande" enCoursLibelle="Envoi…" boutonClassName="h-11 w-full" reinitialiser>
        <Champ id="type_entreprise" label="Vous êtes" requis>
          <Select id="type_entreprise" name="type_entreprise" required defaultValue="" className="h-11">
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(LIBELLES_TYPES_ENTREPRISE).map(([cle, libelle]) => (
              <option key={cle} value={cle}>
                {libelle}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="denomination" label="Dénomination de l’entreprise" requis>
          <Input id="denomination" name="denomination" required minLength={2} maxLength={200} className="h-11" autoComplete="organization" />
        </Champ>
        <Champ id="contact_nom" label="Votre nom" requis>
          <Input id="contact_nom" name="contact_nom" required minLength={2} maxLength={120} className="h-11" autoComplete="name" />
        </Champ>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ id="telephone" label="Téléphone" requis>
            <Input id="telephone" name="telephone" type="tel" required maxLength={30} className="h-11" autoComplete="tel" />
          </Champ>
          <Champ id="region" label="Région">
            <Select id="region" name="region" defaultValue="" className="h-11">
              <option value="">—</option>
              {REGIONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Champ>
        </div>
        <Champ id="email" label="Email" requis>
          <Input id="email" name="email" type="email" required maxLength={200} className="h-11" autoComplete="email" />
        </Champ>
        <Champ id="message" label="Message" aide="Produits, volumes, besoins… (facultatif)">
          <Textarea id="message" name="message" rows={3} maxLength={2000} />
        </Champ>
        {/* Champ piège anti-robots, invisible et ignoré par les lecteurs d'écran */}
        <div className="absolute -left-[9999px]" aria-hidden>
          <label>
            Site internet
            <input type="text" name="site_internet" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
      </FormulaireAction>
      <p className="mt-6 text-sm">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Se connecter
        </Link>
      </p>
    </EcranAuth>
  )
}
