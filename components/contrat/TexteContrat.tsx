import { Fragment } from 'react'

/**
 * Affiche le texte d'un contrat d'engagement (sous-ensemble de Markdown utilisé par les modèles : titres « ### »,
 * lignes d'article en gras, listes numérotées, **gras**) après remplacement des marqueurs {{…}}.
 * Un marqueur non renseigné s'affiche comme un blanc à compléter.
 */
export function TexteContrat({ contenu, valeurs }: { contenu: string; valeurs: Record<string, string | null | undefined> }) {
  const texte = contenu.replace(/\{\{(\w+)\}\}/g, (_, cle: string) => valeurs[cle]?.trim() || '………………')
  const blocs = texte.split(/\n{2,}/)
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      {blocs.map((bloc, i) => {
        if (bloc.startsWith('### ')) {
          return (
            <h3 key={i} className="pt-4 font-heading text-base font-semibold uppercase tracking-wide text-primary">
              {bloc.slice(4)}
            </h3>
          )
        }
        const lignes = bloc.split('\n')
        return (
          <div key={i} className="space-y-1 break-inside-avoid">
            {lignes.map((ligne, j) => {
              const liste = ligne.match(/^(\d+)\.\s+(.*)$/)
              if (liste) {
                return (
                  <p key={j} className="pl-6 -indent-4">
                    {liste[1]}. <EnLigne texte={liste[2]} />
                  </p>
                )
              }
              return (
                <p key={j}>
                  <EnLigne texte={ligne} />
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function EnLigne({ texte }: { texte: string }) {
  const morceaux = texte.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {morceaux.map((m, i) =>
        m.startsWith('**') && m.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {m.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{m}</Fragment>
        )
      )}
    </>
  )
}
