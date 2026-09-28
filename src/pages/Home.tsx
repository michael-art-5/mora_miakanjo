import { Link } from 'react-router'
import { ArrowRight, Store, Sparkles, Truck } from 'lucide-react'
import { useSiteData } from '../site/SiteData'
import ProductCard from '../components/ProductCard'
import type { Product } from '../lib/types'

function ProductRow({ title, products }: { title: string; products: Product[] }) {
  if (!products.length) return null
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <div className="flex items-end justify-between">
        <h2 className="font-display text-3xl">{title}</h2>
        <Link to="/collection" className="text-sm text-earth hover:underline">
          Tout voir
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const { shop, home, categories, featured, new_arrivals } = useSiteData()
  const newArrivals = new_arrivals.slice(0, 4)

  return (
    <>
      {/* Bannière */}
      <section className="bg-sand/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div>
            {home.hero_eyebrow && <p className="text-sm uppercase tracking-[0.2em] text-earth">{home.hero_eyebrow}</p>}
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl md:text-6xl">
              {home.hero_title}
              {home.hero_highlight && (
                <>
                  <br />
                  <em className="text-earth">{home.hero_highlight}</em>
                </>
              )}
            </h1>
            {home.hero_text && <p className="mt-6 max-w-md text-ink/70">{home.hero_text}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/collection"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm text-cream transition-colors hover:bg-gold hover:text-ink"
              >
                {home.hero_cta || 'Découvrir la collection'} <ArrowRight size={16} />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center rounded-full border border-ink px-6 py-3 text-sm transition-colors hover:bg-ink hover:text-cream"
              >
                Nous rendre visite
              </Link>
            </div>
          </div>
          <img src="/logo-rond.png" alt={shop.name} className="mx-auto w-full max-w-sm drop-shadow-2xl" />
        </div>
      </section>
      <div className="motif-textile h-4" aria-hidden="true" />

      {/* Catégories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl">Nos univers</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/collection/${c.id}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl p-6 text-white"
              style={{ background: c.color }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="relative">
                <p className="font-display text-2xl">{c.label}</p>
                <p className="text-sm text-white/80">{c.blurb}</p>
              </div>
              <ArrowRight className="relative ml-auto transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <ProductRow title={home.featured_title || 'À la une'} products={featured} />
      <ProductRow title={home.new_title || 'Nouveautés'} products={newArrivals} />

      {/* Engagements */}
      <section className="border-t border-ink/10 bg-white/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          {[
            { icon: Sparkles, title: 'Qualité choisie', text: 'Des matières sélectionnées pour durer.' },
            { icon: Store, title: 'En boutique', text: 'Venez essayer vos pièces préférées.' },
            { icon: Truck, title: 'Commande facile', text: 'Réservez en ligne, nous vous rappelons.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon className="shrink-0 text-earth" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-ink/70">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
