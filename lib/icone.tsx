import { ImageResponse } from 'next/og'

/**
 * Icône PNG de l'application (installation PWA sur Windows, Mac, Android ; écran d'accueil iOS), générée à la taille demandée.
 * `marge` : icône « maskable » (Android découpe l'icône en cercle ou en goutte : le dessin doit rester dans la zone sûre).
 */
export function iconePng(taille: number, marge = false) {
  const echelle = marge ? 0.72 : 1
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${taille * echelle}" height="${taille * echelle}">
<circle cx="44" cy="19" r="7" fill="#E39A45"/>
<path d="M32 52V31" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
<path d="M32 36c-9 0-14-6-14-14 9 0 14 6 14 14Z" fill="#FFFFFF"/>
<path d="M32 31c0-7 5-12 13-12 0 8-5 12-13 12Z" fill="#CDE8D3"/>
<path d="M16 52h32" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/></svg>`
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2E6E3E',
          borderRadius: marge ? 0 : taille * 0.22,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={taille * echelle} height={taille * echelle} alt="" />
      </div>
    ),
    { width: taille, height: taille }
  )
}
