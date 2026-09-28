'use client'

import { useState } from 'react'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { LIBELLES_ROLES, ROLES_PLATEFORME, type RoleBase, type TypeEntreprise } from '@/lib/roles'

type EntrepriseOption = { id: string; denomination: string; type: TypeEntreprise }
type ProfilOption = { id: string; libelle: string; role_base: RoleBase }

// Type d'entreprise attendu pour chaque rôle rattaché à une entreprise (contrôlé aussi en base par trigger).
const TYPE_POUR_ROLE: Partial<Record<RoleBase, TypeEntreprise>> = {
  producteur: 'producteur',
  client: 'client',
  financier: 'banque',
}

/**
 * Champs d'un utilisateur : la liste des entreprises et des profils se restreint selon le rôle choisi,
 * pour qu'on ne puisse pas rattacher un producteur à une banque par exemple.
 */
export function ChampsUtilisateur({
  entreprises,
  profils,
  valeurs,
  emailModifiable,
  entrepriseParDefaut,
}: {
  entreprises: EntrepriseOption[]
  profils: ProfilOption[]
  valeurs?: {
    email: string
    nom_complet: string
    telephone: string | null
    fonction: string | null
    role_base: RoleBase
    profil_id: string | null
    entreprise_id: string | null
    signataire: boolean
  }
  emailModifiable: boolean
  /** Invitation depuis la fiche d'une entreprise : rôle et entreprise pré-sélectionnés. */
  entrepriseParDefaut?: string
}) {
  const entrepriseIdInitiale = valeurs?.entreprise_id ?? entrepriseParDefaut ?? null
  const entrepriseInitiale = entreprises.find((e) => e.id === entrepriseIdInitiale)
  const roleInitial: RoleBase | '' =
    valeurs?.role_base ??
    (entrepriseInitiale ? (Object.entries(TYPE_POUR_ROLE).find(([, t]) => t === entrepriseInitiale.type)?.[0] as RoleBase) : '')
  const [role, setRole] = useState<RoleBase | ''>(roleInitial)
  const plateforme = role !== '' && ROLES_PLATEFORME.includes(role)
  const typeAttendu = role ? TYPE_POUR_ROLE[role] : undefined
  const entreprisesPossibles = entreprises.filter((e) => e.type === typeAttendu)
  const profilsPossibles = profils.filter((p) => p.role_base === role)

  return (
    <GrilleChamps>
      <Champ id="nom_complet" label="Nom complet" requis>
        <Input id="nom_complet" name="nom_complet" required minLength={2} defaultValue={valeurs?.nom_complet} autoComplete="off" />
      </Champ>
      <Champ id="email" label="Email" requis aide={emailModifiable ? 'L’invitation est envoyée à cette adresse.' : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={valeurs?.email}
          readOnly={!emailModifiable}
          className={emailModifiable ? '' : 'bg-surface-muted'}
          autoComplete="off"
        />
      </Champ>
      <Champ id="telephone" label="Téléphone">
        <Input id="telephone" name="telephone" type="tel" defaultValue={valeurs?.telephone ?? ''} />
      </Champ>
      <Champ id="fonction" label="Fonction">
        <Input id="fonction" name="fonction" defaultValue={valeurs?.fonction ?? ''} placeholder="Ex. Directeur commercial" />
      </Champ>
      <Champ id="role_base" label="Rôle" requis>
        <Select id="role_base" name="role_base" required value={role} onChange={(e) => setRole(e.target.value as RoleBase)}>
          <option value="" disabled>
            Choisir…
          </option>
          {Object.entries(LIBELLES_ROLES).map(([cle, libelle]) => (
            <option key={cle} value={cle}>
              {libelle}
            </option>
          ))}
        </Select>
      </Champ>
      {!plateforme && role !== '' && (
        <Champ id="entreprise_id" label="Entreprise" requis>
          <Select id="entreprise_id" name="entreprise_id" required defaultValue={entrepriseIdInitiale ?? ''} key={role}>
            <option value="" disabled>
              {entreprisesPossibles.length ? 'Choisir…' : 'Aucune entreprise de ce type'}
            </option>
            {entreprisesPossibles.map((e) => (
              <option key={e.id} value={e.id}>
                {e.denomination}
              </option>
            ))}
          </Select>
        </Champ>
      )}
      {role !== '' && (
        <Champ id="profil_id" label="Profil" aide="Facultatif : un profil personnalisé restreint les droits du rôle.">
          <Select id="profil_id" name="profil_id" defaultValue={valeurs?.profil_id ?? ''} key={`p-${role}`}>
            <option value="">Aucun (tous les droits du rôle)</option>
            {profilsPossibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.libelle}
              </option>
            ))}
          </Select>
        </Champ>
      )}
      {(role === 'producteur' || role === 'client') && (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="signataire" defaultChecked={valeurs?.signataire ?? true} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>
            <strong>Habilité à signer</strong> le contrat d’engagement au nom de l’entreprise.
          </span>
        </label>
      )}
    </GrilleChamps>
  )
}
