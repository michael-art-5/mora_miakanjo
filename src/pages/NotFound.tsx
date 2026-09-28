import { Link } from 'react-router'

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-5xl">Page introuvable</h1>
      <p className="mt-4 text-ink/70">Cette page n'existe pas ou a été déplacée.</p>
      <Link to="/" className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm text-cream hover:bg-gold hover:text-ink">
        Retour à l'accueil
      </Link>
    </section>
  )
}
