'use client'

import React, { useState } from 'react'
import {
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Package,
  Building2,
  Factory,
  ShoppingBasket,
  FileSpreadsheet
} from 'lucide-react'

export interface TypeImportOption {
  id: string
  titre: string
  description: string
  icone: 'produits' | 'entreprises' | 'sites' | 'offres' | 'general'
  modeleCSV: string
  nomFichierModele: string
}

interface AssistantImportProps {
  nomApplication: string
  titreModule: string
  optionsTypes: TypeImportOption[]
  onImporter: (typeId: string, records: any[]) => Promise<{ succes: number; erreurs: number; details?: string[] }>
}

export function AssistantImport({
  nomApplication,
  titreModule,
  optionsTypes,
  onImporter
}: AssistantImportProps) {
  const [typeSelectionne, setTypeSelectionne] = useState<string>(optionsTypes[0]?.id || '')
  const [fichierNom, setFichierNom] = useState<string | null>(null)
  const [lignesApercu, setLignesApercu] = useState<any[]>([])
  const [colonnesApercu, setColonnesApercu] = useState<string[]>([])
  const [totalLignes, setTotalLignes] = useState<number>(0)
  const [donneesCompletes, setDonneesCompletes] = useState<any[]>([])
  const [enCours, setEnCours] = useState<boolean>(false)
  const [rapport, setRapport] = useState<{ succes: number; erreurs: number; details?: string[] } | null>(null)
  const [erreurLecture, setErreurLecture] = useState<string | null>(null)

  const optionCourante = optionsTypes.find(o => o.id === typeSelectionne) || optionsTypes[0]

  const telechargerModele = () => {
    if (!optionCourante) return
    const blob = new Blob([optionCourante.modeleCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', optionCourante.nomFichierModele)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parseCSV = (content: string) => {
    const clean = content.replace(/^\uFEFF/, '').trim()
    const lines = clean.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length === 0) return { colonnes: [], donnees: [] }

    const separator = lines[0].includes(';') ? ';' : ','

    const parseLine = (line: string) => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === separator && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''))
    const records: any[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i])
      if (values.length === 0 || (values.length === 1 && !values[0])) continue
      const obj: Record<string, string> = {}
      headers.forEach((header, idx) => {
        let val = values[idx] !== undefined ? values[idx] : ''
        val = val.replace(/^["']|["']$/g, '')
        obj[header] = val
      })
      records.push(obj)
    }

    return { colonnes: headers, donnees: records }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setErreurLecture(null)
    setRapport(null)

    if (!file) return

    setFichierNom(file.name)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content)
          if (Array.isArray(parsed) && parsed.length > 0) {
            const cols = Object.keys(parsed[0])
            setColonnesApercu(cols)
            setLignesApercu(parsed.slice(0, 5))
            setDonneesCompletes(parsed)
            setTotalLignes(parsed.length)
          } else {
            throw new Error('Le fichier JSON doit contenir un tableau d\'objets non vide.')
          }
        } else {
          const { colonnes, donnees } = parseCSV(content)
          if (donnees.length === 0) {
            throw new Error('Aucune ligne de données détectée dans le fichier CSV.')
          }
          setColonnesApercu(colonnes)
          setLignesApercu(donnees.slice(0, 5))
          setDonneesCompletes(donnees)
          setTotalLignes(donnees.length)
        }
      } catch (err: any) {
        setErreurLecture(err.message || 'Erreur lors de la lecture du fichier.')
        setDonneesCompletes([])
        setLignesApercu([])
      }
    }

    reader.readAsText(file)
  }

  const lancerImport = async () => {
    if (!donneesCompletes.length) return
    setEnCours(true)
    setRapport(null)
    try {
      const res = await onImporter(typeSelectionne, donneesCompletes)
      setRapport(res)
    } catch (err: any) {
      setRapport({
        succes: 0,
        erreurs: donneesCompletes.length,
        details: [err.message || 'Erreur inattendue durant l\'importation']
      })
    } finally {
      setEnCours(false)
    }
  }

  const renderIcon = (type: TypeImportOption['icone']) => {
    switch (type) {
      case 'produits':
        return <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      case 'entreprises':
        return <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      case 'sites':
        return <Factory className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      case 'offres':
        return <ShoppingBasket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
      default:
        return <FileSpreadsheet className="h-5 w-5 text-primary" />
    }
  }

  return (
    <div className="bg-surface border border-surface-border rounded-xl shadow-xs p-6 space-y-6">
      {/* Entête */}
      <div className="border-b border-surface-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Assistant d'importation — {nomApplication}
            </h2>
            <p className="text-sm text-foreground-muted">
              {titreModule} : Chargez vos catalogues, entreprises adhérentes, sites et offres au format CSV ou JSON.
            </p>
          </div>
        </div>
      </div>

      {/* Étape 1 : Choix du type de données */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          1. Sélectionnez le type d'enregistrements à importer
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {optionsTypes.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setTypeSelectionne(opt.id)
                setDonneesCompletes([])
                setLignesApercu([])
                setFichierNom(null)
                setRapport(null)
              }}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                typeSelectionne === opt.id
                  ? 'border-primary bg-primary-soft/30 shadow-xs'
                  : 'border-surface-border bg-surface hover:border-foreground-muted/30'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {renderIcon(opt.icone)}
                <span className="font-medium text-foreground">{opt.titre}</span>
              </div>
              <p className="text-xs text-foreground-muted leading-relaxed">
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Étape 2 : Téléchargement du modèle & Sélection du fichier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <div className="p-4 rounded-xl border border-dashed border-surface-border bg-surface-muted/30 flex flex-col justify-center items-start gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Modèle prêt à l'emploi
          </span>
          <p className="text-sm text-foreground">
            Téléchargez le modèle CSV adapté aux contraintes de la plateforme PCAS.
          </p>
          <button
            type="button"
            onClick={telechargerModele}
            className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-border bg-surface hover:bg-surface-muted transition-colors text-foreground"
          >
            <Download className="h-4 w-4 text-primary" />
            Télécharger le modèle ({optionCourante?.nomFichierModele})
          </button>
        </div>

        <div className="p-4 rounded-xl border border-surface-border bg-surface-muted/10 flex flex-col justify-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            2. Fichier source (CSV ou JSON)
          </span>
          <input
            type="file"
            accept=".csv, application/json, text/csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-foreground-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
          />
          {fichierNom && (
            <p className="text-xs text-foreground-muted">
              Fichier chargé : <strong className="text-foreground">{fichierNom}</strong> ({totalLignes} ligne{totalLignes > 1 ? 's' : ''})
            </p>
          )}
          {erreurLecture && (
            <div className="flex items-center gap-2 text-xs text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{erreurLecture}</span>
            </div>
          )}
        </div>
      </div>

      {/* Étape 3 : Aperçu des données */}
      {lignesApercu.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              3. Aperçu des données détectées (5 premières lignes sur {totalLignes})
            </span>
          </div>
          <div className="overflow-x-auto border border-surface-border rounded-lg max-h-56">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-muted border-b border-surface-border text-foreground-muted sticky top-0">
                <tr>
                  {colonnesApercu.map((col, i) => (
                    <th key={i} className="px-3 py-2 font-medium capitalize whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border text-foreground">
                {lignesApercu.map((ligne, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/30">
                    {colonnesApercu.map((col, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 whitespace-nowrap text-foreground-muted font-mono text-[11px]">
                        {ligne[col] !== undefined ? String(ligne[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="button"
              disabled={enCours || !donneesCompletes.length}
              onClick={lancerImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow-xs hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
            >
              {enCours ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importation en cours...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  Importer les {totalLignes} enregistrement{totalLignes > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Rapport d'importation */}
      {rapport && (
        <div className={`p-4 rounded-xl border mt-4 ${
          rapport.erreurs === 0
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
        }`}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            {rapport.erreurs === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Importation terminée avec succès !
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Importation terminée avec des alertes
              </>
            )}
          </div>
          <p className="text-xs mt-1">
            <strong>{rapport.succes}</strong> enregistrement(s) importé(s) avec succès.
            {rapport.erreurs > 0 && <> <strong>{rapport.erreurs}</strong> ligne(s) ignorée(s) ou en erreur.</>}
          </p>

          {rapport.details && rapport.details.length > 0 && (
            <ul className="mt-2 text-xs list-disc list-inside space-y-0.5 opacity-90 max-h-36 overflow-y-auto">
              {rapport.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
