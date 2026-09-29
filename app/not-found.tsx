import Link from 'next/link'
import { SearchX } from 'lucide-react'

/** Page introuvable, ou document auquel le compte connecté n'a pas accès (même réponse : rien n'est divulgué). */
export default function PageIntrouvable() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface p-6 text-center">
        <SearchX className="mx-auto h-10 w-10 text-foreground-muted" aria-hidden />
        <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
          Cette page n’existe pas, ou votre compte n’y a pas accès.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Retour à l’accueil
        </Link>
      </div>
    </main>
  )
}
