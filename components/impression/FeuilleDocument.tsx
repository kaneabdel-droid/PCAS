/* eslint-disable @next/next/no-img-element -- logos et QR en données intégrées : ils doivent s'imprimer tels quels */
import type { ModeleDocument } from '@/lib/impression/modele'

/**
 * Document A4 prêt à imprimer (ou à enregistrer en PDF depuis la boîte d'impression du navigateur).
 * Couleurs fixes (pas les thèmes de l'application) : un document imprimé est toujours noir sur blanc.
 */
export function FeuilleDocument({ modele, logos, qr }: { modele: ModeleDocument; logos: (string | null)[]; qr: string | null }) {
  return (
    <article className="feuille-a4 relative mx-auto bg-white p-[14mm] text-[12px] leading-snug text-[#111] shadow-xl print:shadow-none">
      {modele.filigrane && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-30 select-none text-[110px] font-bold tracking-widest text-[#111]/[0.06]">{modele.filigrane}</span>
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-6 border-b-2 border-[#2E6E3E] pb-4">
        <div className="flex items-center gap-3">
          {logos[0] && <img src={logos[0]} alt="" className="h-16 w-16 object-contain" />}
          <div>
            <p className="text-base font-bold">{modele.parties[0]?.nom}</p>
            <p className="text-[11px] text-[#555]">{modele.parties[0]?.lignes[0]}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-[#2E6E3E]">{modele.titre}</h1>
          <p className="mt-1 font-mono text-sm">{modele.numero}</p>
          <p className="text-[11px] text-[#555]">du {modele.date}</p>
        </div>
      </div>

      <section className={`mb-5 grid gap-4 ${modele.parties.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {modele.parties.map((p, i) => (
          <div key={i} className="rounded-md border border-[#ddd] p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#777]">{p.role}</p>
            <div className="flex items-start gap-2">
              {logos[i] && i > 0 && <img src={logos[i]!} alt="" className="h-10 w-10 shrink-0 object-contain" />}
              <div>
                <p className="font-semibold">{p.nom}</p>
                {p.lignes.map((l, j) => (
                  <p key={j} className="text-[11px] text-[#555]">
                    {l}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {modele.infos.length > 0 && (
        <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1.5">
          {modele.infos.map(([cle, valeur]) => (
            <div key={cle} className="flex gap-2">
              <dt className="shrink-0 text-[#777]">{cle} :</dt>
              <dd className="font-medium">{valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      {modele.colonnes.length > 0 && (
        <table className="mb-4 w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {modele.colonnes.map((c) => (
                <th key={c.libelle} className={`bg-[#2E6E3E] px-2 py-1.5 font-semibold text-white ${c.nombre ? 'text-right' : 'text-left'}`}>
                  {c.libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modele.lignes.map((ligne, i) => (
              <tr key={i} className="break-inside-avoid border-b border-[#e5e5e5]">
                {ligne.map((cellule, j) => (
                  <td key={j} className={`px-2 py-1.5 ${modele.colonnes[j]?.nombre ? 'text-right tabular-nums' : ''}`}>
                    {cellule}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modele.totaux.length > 0 && (
        <div className="mb-2 ml-auto w-72">
          {modele.totaux.map(([cle, valeur], i) => (
            <p key={cle} className={`flex justify-between gap-4 py-1 ${i === 0 ? 'border-t-2 border-[#111] text-base font-bold' : 'text-[11px]'}`}>
              <span>{cle}</span>
              <span className="tabular-nums">{valeur}</span>
            </p>
          ))}
        </div>
      )}
      {modele.enLettres && <p className="mb-5 italic">{modele.enLettres}</p>}

      {modele.blocs.map((b) => (
        <section key={b.titre} className="mb-4 break-inside-avoid">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#777]">{b.titre}</p>
          {b.lignes.map((l, i) => (
            <p key={i} className="whitespace-pre-line">
              {l}
            </p>
          ))}
        </section>
      ))}

      {modele.visas.length > 0 && (
        <section className={`mb-6 mt-6 grid gap-4 break-inside-avoid ${modele.visas.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {modele.visas.map((v) => (
            <div key={v} className="h-24 rounded-md border border-dashed border-[#bbb] p-2 text-[10px] uppercase tracking-wide text-[#777]">
              {v}
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 flex items-end justify-between gap-6 border-t border-[#ddd] pt-3 text-[10px] text-[#666] break-inside-avoid">
        {qr && modele.qr ? (
          <div className="flex items-center gap-3">
            <img src={qr} alt="" className="h-24 w-24" />
            <div className="max-w-56">
              <p className="font-semibold text-[#111]">Document vérifiable</p>
              <p>Scannez ce code pour vérifier son authenticité et le suivi de la commande sur PCAS.</p>
              <p className="mt-1 break-all font-mono">{modele.qr.url}</p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <div className="max-w-72 text-right">
          {modele.mentions && <p className="whitespace-pre-line">{modele.mentions}</p>}
          <p className="mt-1">PCAS — Plateforme de Commercialisation Agricole du Sénégal</p>
        </div>
      </div>
    </article>
  )
}
