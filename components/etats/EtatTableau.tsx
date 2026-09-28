'use client'

import { useState } from 'react'
import { Columns3, Download, FileSpreadsheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Colonne = { libelle: string; nombre: boolean }

/**
 * Tableau d'un état, avec choix des colonnes, orientation, impression, PDF et CSV.
 * Les colonnes masquées ne sont ni imprimées ni exportées.
 */
export function EtatTableau({
  titre,
  sousTitre,
  colonnes,
  lignes,
  csv,
  totaux,
  orientationDefaut,
  nomFichier,
}: {
  titre: string
  sousTitre: string
  colonnes: Colonne[]
  /** Valeurs affichées */
  lignes: string[][]
  /** Valeurs brutes pour le CSV (nombres sans mise en forme) */
  csv: (string | number | null)[][]
  totaux: (string | null)[]
  orientationDefaut: 'portrait' | 'paysage'
  nomFichier: string
}) {
  const [visibles, setVisibles] = useState<boolean[]>(colonnes.map(() => true))
  const [orientation, setOrientation] = useState(orientationDefaut)
  const [enCours, setEnCours] = useState(false)
  const indices = colonnes.map((_, i) => i).filter((i) => visibles[i])
  const aTotaux = totaux.some((t) => t)

  async function pdf() {
    setEnCours(true)
    try {
      const { pdfEtat } = await import('@/lib/impression/pdf')
      await pdfEtat({
        titre,
        sousTitre,
        orientation,
        colonnes: indices.map((i) => ({ libelle: colonnes[i].libelle, nombre: colonnes[i].nombre })),
        lignes: lignes.map((l) => indices.map((i) => l[i])),
        totaux: aTotaux ? indices.map((i) => totaux[i] ?? '') : undefined,
        nomFichier: `${nomFichier}.pdf`,
      })
    } finally {
      setEnCours(false)
    }
  }

  function exporterCsv() {
    // Point-virgule et BOM : ouverture directe dans Excel en français (Windows et Mac).
    const echapper = (v: string | number | null) => {
      if (v === null) return ''
      const s = typeof v === 'number' ? String(v).replace('.', ',') : v
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const contenu = [indices.map((i) => colonnes[i].libelle), ...csv.map((l) => indices.map((i) => l[i]))].map((l) => l.map(echapper).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `${nomFichier}.csv`
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <style>{`@media print { @page { size: A4 ${orientation === 'paysage' ? 'landscape' : 'portrait'}; margin: 10mm; } }`}</style>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <details className="relative">
          <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-surface-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted">
            <Columns3 className="h-4 w-4" aria-hidden /> Colonnes ({indices.length}/{colonnes.length})
          </summary>
          <div className="absolute left-0 z-20 mt-1 w-64 space-y-1 rounded-lg border border-surface-border bg-surface p-3 shadow-lg">
            {colonnes.map((c, i) => (
              <label key={c.libelle} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={visibles[i]}
                  onChange={() => setVisibles((v) => v.map((x, j) => (j === i ? !x : x)))}
                  className="h-4 w-4 accent-primary"
                  disabled={visibles[i] && indices.length === 1}
                />
                {c.libelle}
              </label>
            ))}
          </div>
        </details>
        <div className="inline-flex rounded-lg border border-surface-border bg-surface p-1" role="group" aria-label="Orientation">
          {(['portrait', 'paysage'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientation(o)}
              aria-pressed={orientation === o}
              className={cn('rounded-md px-3 py-1.5 text-sm', orientation === o ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground')}
            >
              {o === 'portrait' ? 'Portrait' : 'Paysage'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Imprimer
        </Button>
        <Button type="button" variant="outline" onClick={exporterCsv}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden /> CSV / Excel
        </Button>
        <Button type="button" onClick={pdf} disabled={enCours}>
          <Download className="h-4 w-4" aria-hidden /> {enCours ? 'Création…' : 'PDF'}
        </Button>
      </div>

      <div className="mb-3 hidden print:block">
        <h1 className="text-lg font-bold">{titre}</h1>
        <p className="text-xs">{sousTitre}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-surface-muted text-foreground-muted">
              {indices.map((i) => (
                <th key={i} className={cn('px-3 py-2.5 font-medium', colonnes[i].nombre ? 'text-right' : 'text-left')}>
                  {colonnes[i].libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, n) => (
              <tr key={n} className="border-t border-surface-border">
                {indices.map((i) => (
                  <td key={i} className={cn('px-3 py-2', colonnes[i].nombre && 'text-right tabular-nums')}>
                    {l[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {aTotaux && (
            <tfoot>
              <tr className="border-t-2 border-surface-border font-semibold">
                {indices.map((i) => (
                  <td key={i} className={cn('px-3 py-2.5', colonnes[i].nombre && 'text-right tabular-nums')}>
                    {totaux[i]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-foreground-muted">{lignes.length} ligne(s)</p>
    </div>
  )
}
