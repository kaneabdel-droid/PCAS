'use client'

import { useState } from 'react'
import { FormulaireAction } from '@/components/FormulaireAction'
import { Champ, GrilleChamps } from '@/components/ui/champ'
import { Input, Select } from '@/components/ui/input'
import { enregistrerTransformation } from '@/app/(app)/stocks/actions'

type Option = { id: string; nom: string; unite?: string }
type Rendement = { matiere_id: string; produit_id: string; rendement: number }

const lireNombre = (v: string) => Number(v.replace(/\s/g, '').replace(',', '.'))

/** Transformation : la quantité obtenue est proposée d'après le rendement du catalogue, et reste modifiable. */
export function FormTransformation({
  sites,
  matieres,
  produits,
  rendements,
  aujourdhui,
}: {
  sites: Option[]
  matieres: Option[]
  produits: Option[]
  rendements: Rendement[]
  aujourdhui: string
}) {
  const [matiere, setMatiere] = useState('')
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState('')
  const [obtenue, setObtenue] = useState('')
  const [modifiee, setModifiee] = useState(false)

  const rendement = rendements.find((r) => r.matiere_id === matiere && r.produit_id === produit)?.rendement
  const produitsPossibles = matiere ? produits.filter((p) => rendements.some((r) => r.matiere_id === matiere && r.produit_id === p.id)) : produits
  const proposee = rendement && quantite && lireNombre(quantite) > 0 ? String(Math.round(lireNombre(quantite) * rendement * 1000) / 1000) : ''
  const uniteMatiere = matieres.find((m) => m.id === matiere)?.unite
  const uniteProduit = produits.find((p) => p.id === produit)?.unite

  return (
    <FormulaireAction action={enregistrerTransformation} libelle="Enregistrer la transformation" reinitialiser>
      <GrilleChamps>
        <Champ id="tr-site" label="Site" requis>
          <Select id="tr-site" name="site_id" required defaultValue={sites.length === 1 ? sites[0].id : ''}>
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
        <Champ id="tr-date" label="Date">
          <Input id="tr-date" name="date_mouvement" type="date" max={aujourdhui} defaultValue={aujourdhui} />
        </Champ>
        <Champ id="tr-matiere" label="Matière première transformée" requis>
          <Select id="tr-matiere" name="matiere_id" required value={matiere} onChange={(e) => setMatiere(e.target.value)}>
            <option value="" disabled>
              Choisir…
            </option>
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="tr-qm" label={`Quantité transformée${uniteMatiere ? ` (${uniteMatiere})` : ''}`} requis>
          <Input id="tr-qm" name="quantite_matiere" required inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </Champ>
        <Champ id="tr-produit" label="Produit fini obtenu" requis>
          <Select id="tr-produit" name="produit_id" required value={produit} onChange={(e) => setProduit(e.target.value)}>
            <option value="" disabled>
              Choisir…
            </option>
            {produitsPossibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ
          id="tr-qp"
          label={`Quantité obtenue${uniteProduit ? ` (${uniteProduit})` : ''}`}
          requis
          aide={rendement ? `Rendement du catalogue : ${rendement.toLocaleString('fr-FR')} ${uniteProduit ?? ''} par ${uniteMatiere ?? 'unité'}.` : undefined}
        >
          <Input
            id="tr-qp"
            name="quantite_produit"
            required
            inputMode="decimal"
            value={modifiee ? obtenue : proposee}
            onChange={(e) => {
              setModifiee(true)
              setObtenue(e.target.value)
            }}
          />
        </Champ>
        <Champ id="tr-commentaire" label="Commentaire" className="sm:col-span-2">
          <Input id="tr-commentaire" name="commentaire" maxLength={500} />
        </Champ>
      </GrilleChamps>
    </FormulaireAction>
  )
}
