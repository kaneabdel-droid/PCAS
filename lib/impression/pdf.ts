// Génération des PDF dans le navigateur (jsPDF). Chargé à la demande, uniquement au clic sur « Télécharger PDF ».

import type { ModeleDocument } from '@/lib/impression/modele'
import { enregistrerPdf } from '@/lib/natif'
import { textePdf } from '@/lib/impression/modele'

const VERT: [number, number, number] = [46, 110, 62]
const GRIS: [number, number, number] = [110, 110, 110]

function formatImage(dataUrl: string) {
  if (dataUrl.startsWith('data:image/png')) return 'PNG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'JPEG'
}

/** Document A4 portrait : même contenu que la feuille HTML. */
export async function pdfDocument(modele: ModeleDocument, logos: (string | null)[], qr: string | null) {
  const { jsPDF, GState } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const t = textePdf
  const marge = 15
  const largeur = 210 - 2 * marge
  let y = marge

  if (modele.filigrane) {
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.07 }))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(90)
    doc.text(modele.filigrane, 105, 170, { align: 'center', angle: 30 })
    doc.restoreGraphicsState()
  }

  // En-tête : logo et nom de l'émetteur à gauche, titre et numéro à droite
  if (logos[0]) doc.addImage(logos[0], formatImage(logos[0]), marge, y, 18, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(t(modele.parties[0]?.nom ?? ''), marge + (logos[0] ? 21 : 0), y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS)
  doc.text(t(modele.parties[0]?.lignes[0] ?? ''), marge + (logos[0] ? 21 : 0), y + 12)
  doc.setTextColor(...VERT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(t(modele.titre.toUpperCase()), 210 - marge, y + 6, { align: 'right' })
  doc.setTextColor(0)
  doc.setFont('courier', 'normal')
  doc.setFontSize(10)
  doc.text(t(modele.numero), 210 - marge, y + 12, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRIS)
  doc.text(t(`du ${modele.date}`), 210 - marge, y + 16, { align: 'right' })
  y += 22
  doc.setDrawColor(...VERT)
  doc.setLineWidth(0.6)
  doc.line(marge, y, 210 - marge, y)
  y += 6

  // Parties
  const nb = modele.parties.length
  const largeurPartie = (largeur - (nb - 1) * 4) / nb
  let hauteurParties = 0
  modele.parties.forEach((p, i) => {
    const x = marge + i * (largeurPartie + 4)
    let yy = y + 5
    doc.setTextColor(...GRIS)
    doc.setFontSize(7)
    doc.text(t(p.role.toUpperCase()), x + 3, yy)
    yy += 5
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const nom = doc.splitTextToSize(t(p.nom), largeurPartie - 6)
    doc.text(nom, x + 3, yy)
    yy += nom.length * 4.2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRIS)
    for (const l of p.lignes) {
      const morceaux = doc.splitTextToSize(t(l), largeurPartie - 6)
      doc.text(morceaux, x + 3, yy)
      yy += morceaux.length * 3.6
    }
    hauteurParties = Math.max(hauteurParties, yy - y + 2)
  })
  doc.setDrawColor(220)
  doc.setLineWidth(0.2)
  modele.parties.forEach((_, i) => doc.roundedRect(marge + i * (largeurPartie + 4), y, largeurPartie, hauteurParties, 1.5, 1.5))
  y += hauteurParties + 6

  // Informations
  doc.setFontSize(8.5)
  modele.infos.forEach(([cle, valeur], i) => {
    const x = i % 2 === 0 ? marge : marge + largeur / 2
    if (i % 2 === 0 && i > 0) y += 5
    doc.setTextColor(...GRIS)
    doc.text(t(`${cle} :`), x, y)
    doc.setTextColor(0)
    doc.text(doc.splitTextToSize(t(valeur), largeur / 2 - 38)[0] ?? '', x + 36, y)
  })
  y += modele.infos.length ? 8 : 0

  // Lignes
  if (modele.colonnes.length) {
    autoTable(doc, {
      startY: y,
      head: [modele.colonnes.map((c) => t(c.libelle))],
      body: modele.lignes.map((l) => l.map(t)),
      margin: { left: marge, right: marge },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8 },
      headStyles: { fillColor: VERT, textColor: 255, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(modele.colonnes.map((c, i) => [i, { halign: c.nombre ? 'right' : 'left' }])),
      didParseCell: (d) => {
        if (d.section === 'head' && modele.colonnes[d.column.index]?.nombre) d.cell.styles.halign = 'right'
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }

  // Totaux et montant en lettres
  modele.totaux.forEach(([cle, valeur], i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.setFontSize(i === 0 ? 11 : 8.5)
    doc.text(t(cle), 210 - marge - 70, y + 4)
    doc.text(t(valeur), 210 - marge, y + 4, { align: 'right' })
    y += i === 0 ? 7 : 5
  })
  if (modele.enLettres) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    const lettres = doc.splitTextToSize(t(modele.enLettres), largeur)
    doc.text(lettres, marge, y + 3)
    y += lettres.length * 4 + 4
  }
  doc.setFont('helvetica', 'normal')

  // Blocs
  for (const b of modele.blocs) {
    if (y > 250) {
      doc.addPage()
      y = marge
    }
    doc.setFontSize(7)
    doc.setTextColor(...GRIS)
    doc.text(t(b.titre.toUpperCase()), marge, y + 3)
    y += 7.5
    doc.setFontSize(8.5)
    doc.setTextColor(0)
    for (const l of b.lignes) {
      const morceaux = doc.splitTextToSize(t(l), largeur)
      doc.text(morceaux, marge, y)
      y += morceaux.length * 4
    }
    y += 3
  }

  // Visas
  if (modele.visas.length) {
    if (y > 235) {
      doc.addPage()
      y = marge
    }
    const nv = modele.visas.length
    const lv = (largeur - (nv - 1) * 4) / nv
    doc.setLineDashPattern([1, 1], 0)
    doc.setDrawColor(180)
    modele.visas.forEach((v, i) => {
      const x = marge + i * (lv + 4)
      doc.rect(x, y + 2, lv, 22)
      doc.setFontSize(7)
      doc.setTextColor(...GRIS)
      doc.text(t(v.toUpperCase()), x + 2, y + 6)
    })
    doc.setLineDashPattern([], 0)
    y += 28
  }

  // Pied : QR code et mentions
  const yPied = Math.max(y + 4, 297 - marge - 30)
  if (yPied + 28 > 297 - marge) doc.addPage()
  const yq = Math.min(yPied, 297 - marge - 30)
  if (qr && modele.qr) {
    doc.addImage(qr, 'PNG', marge, yq, 26, 26)
    doc.setFontSize(7.5)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('Document vérifiable', marge + 29, yq + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRIS)
    doc.text(doc.splitTextToSize(t('Scannez ce code pour vérifier son authenticité et le suivi de la commande sur PCAS.'), 60), marge + 29, yq + 9)
    doc.setFont('courier', 'normal')
    doc.setFontSize(6.5)
    doc.text(doc.splitTextToSize(modele.qr.url, 62), marge + 29, yq + 19)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...GRIS)
  const pied = [...(modele.mentions ? [modele.mentions] : []), 'PCAS — Plateforme de Commercialisation Agricole du Sénégal']
  doc.text(doc.splitTextToSize(t(pied.join('\n')), 80), 210 - marge, yq + 22, { align: 'right' })

  await enregistrerPdf(doc, modele.nomFichier)
}

/** État tabulaire (liste) : portrait ou paysage, en-tête avec titre et période, pagination. */
export async function pdfEtat(options: {
  titre: string
  sousTitre: string
  orientation: 'portrait' | 'paysage'
  colonnes: { libelle: string; nombre?: boolean }[]
  lignes: string[][]
  totaux?: string[]
  nomFichier: string
}) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: options.orientation === 'paysage' ? 'landscape' : 'portrait' })
  const largeurPage = doc.internal.pageSize.getWidth()
  const t = textePdf
  doc.setTextColor(...VERT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(t(options.titre), 12, 15)
  doc.setTextColor(...GRIS)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(t(options.sousTitre), 12, 20)
  doc.text(t(`Édité le ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} — PCAS`), largeurPage - 12, 15, { align: 'right' })
  autoTable(doc, {
    startY: 25,
    head: [options.colonnes.map((c) => t(c.libelle))],
    body: options.lignes.map((l) => l.map(t)),
    foot: options.totaux ? [options.totaux.map(t)] : undefined,
    margin: { left: 12, right: 12 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.4 },
    headStyles: { fillColor: VERT, textColor: 255 },
    footStyles: { fillColor: [235, 240, 236], textColor: 0, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(options.colonnes.map((c, i) => [i, { halign: c.nombre ? 'right' : 'left' }])),
    didParseCell: (d) => {
      if (d.section !== 'body' && options.colonnes[d.column.index]?.nombre) d.cell.styles.halign = 'right'
    },
    didDrawPage: (d) => {
      doc.setFontSize(7)
      doc.setTextColor(...GRIS)
      doc.text(`Page ${d.pageNumber}`, largeurPage - 12, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
    },
  })
  await enregistrerPdf(doc, options.nomFichier)
}
