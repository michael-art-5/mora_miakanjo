import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useSiteData } from '../site/SiteData'
import { api } from '../lib/api'
import { formatPrice } from '../lib/format'
import type { Paged, Product } from '../lib/types'
import ProductCard from '../components/ProductCard'

const PAGE_SIZE = 24

type Facets = { sizes: string[]; colors: string[]; price_min: number; price_max: number }

const SORTS: [string, string][] = [
  ['pertinence', 'Sélection de la boutique'],
  ['recents', 'Plus récents'],
  ['prix_asc', 'Prix croissant'],
  ['prix_desc', 'Prix décroissant'],
  ['nom', 'Nom (A → Z)'],
]

// Critères transmis à l'API ; ils sont aussi conservés dans l'adresse de la page (lien partageable)
const KEYS = ['q', 'prix_min', 'prix_max', 'taille', 'coloris', 'promo', 'nouveau', 'dispo', 'tri'] as const

export default function Collection() {
  const { category } = useParams()
  const { categories, shop } = useSiteData()
  const current = categories.find((c) => c.id === category)
  const [params, setParams] = useSearchParams()
  const [facets, setFacets] = useState<Facets | null>(null)
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Champs saisis au clavier : appliqués après une courte pause
  const [text, setText] = useState(params.get('q') ?? '')
  const [minPrice, setMinPrice] = useState(params.get('prix_min') ?? '')
  const [maxPrice, setMaxPrice] = useState(params.get('prix_max') ?? '')

  const get = (k: (typeof KEYS)[number]) => params.get(k) ?? ''
  const set = (patch: Partial<Record<(typeof KEYS)[number], string>>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next, { replace: true })
  }

  useEffect(() => {
    api<Facets>('/api/public/filters').then(setFacets).catch(() => {})
  }, [])

  // Recherche et prix : appliqués 350 ms après la dernière frappe
  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() !== get('q') || minPrice !== get('prix_min') || maxPrice !== get('prix_max'))
        set({ q: text.trim(), prix_min: minPrice, prix_max: maxPrice })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, minPrice, maxPrice])

  // Si l'adresse change (lien de l'en-tête, retour arrière), on resynchronise les champs
  // (sans toucher à une saisie en cours équivalente, pour ne pas effacer l'espace qu'on vient de taper)
  useEffect(() => {
    const q = params.get('q') ?? ''
    setText((t) => (t.trim() === q ? t : q))
    setMinPrice(params.get('prix_min') ?? '')
    setMaxPrice(params.get('prix_max') ?? '')
  }, [params])

  const criteria = KEYS.map((k) => `${k}=${params.get(k) ?? ''}`).join('&') + `&cat=${current?.id ?? ''}`

  // Tout changement de critère repart de la première page
  useEffect(() => {
    setItems([])
    setPage(1)
  }, [criteria])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
    if (current) query.set('category', current.id)
    for (const k of KEYS) if (params.get(k)) query.set(k, params.get(k)!)
    api<Paged<Product>>(`/api/public/products?${query}`)
      .then((res) => {
        if (cancelled) return
        setItems((prev) => (page === 1 ? res.rows : [...prev, ...res.rows]))
        setTotal(res.total)
        setError('')
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, criteria])

  // Filtres actifs, affichés sous forme d'étiquettes retirables
  const active: { label: string; clear: () => void }[] = []
  if (get('q')) active.push({ label: `« ${get('q')} »`, clear: () => set({ q: '' }) })
  if (get('prix_min')) active.push({ label: `Dès ${formatPrice(Number(get('prix_min')), shop.currency)}`, clear: () => set({ prix_min: '' }) })
  if (get('prix_max')) active.push({ label: `Jusqu'à ${formatPrice(Number(get('prix_max')), shop.currency)}`, clear: () => set({ prix_max: '' }) })
  if (get('taille')) active.push({ label: `Taille ${get('taille')}`, clear: () => set({ taille: '' }) })
  if (get('coloris')) active.push({ label: get('coloris'), clear: () => set({ coloris: '' }) })
  if (get('promo')) active.push({ label: 'En promotion', clear: () => set({ promo: '' }) })
  if (get('nouveau')) active.push({ label: 'Nouveautés', clear: () => set({ nouveau: '' }) })
  if (get('dispo')) active.push({ label: 'Disponibles', clear: () => set({ dispo: '' }) })
  const resetAll = () => setParams(new URLSearchParams(), { replace: true })

  const tabClass = (on: boolean) =>
    `rounded-full border px-4 py-2 text-sm transition-colors ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 hover:border-ink'}`
  const chip = (on: boolean) =>
    `rounded-md border px-2.5 py-1.5 text-xs transition-colors ${on ? 'border-ink bg-ink text-cream' : 'border-ink/20 bg-white hover:border-ink'}`
  const suffix = params.toString() ? `?${params}` : ''

  const filters = (
    <div className="space-y-6">
      <FilterBlock title="Trier par">
        <select
          value={get('tri') || 'pertinence'}
          onChange={(e) => set({ tri: e.target.value === 'pertinence' ? '' : e.target.value })}
          className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-earth"
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </FilterBlock>

      <FilterBlock title={`Prix (${shop.currency})`}>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
            placeholder={facets ? String(facets.price_min) : 'Min'} aria-label="Prix minimum"
            className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-earth"
          />
          <span className="text-ink/40">–</span>
          <input
            type="number" min={0} inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={facets ? String(facets.price_max) : 'Max'} aria-label="Prix maximum"
            className="w-full rounded-md border border-ink/20 bg-white px-3 py-2 text-sm outline-none focus:border-earth"
          />
        </div>
      </FilterBlock>

      {!!facets?.sizes.length && (
        <FilterBlock title="Taille">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => (
              <button key={s} onClick={() => set({ taille: get('taille') === s ? '' : s })} className={chip(get('taille') === s)}>
                {s}
              </button>
            ))}
          </div>
        </FilterBlock>
      )}

      {!!facets?.colors.length && (
        <FilterBlock title="Coloris">
          <div className="flex flex-wrap gap-1.5">
            {facets.colors.map((c) => (
              <button key={c} onClick={() => set({ coloris: get('coloris') === c ? '' : c })} className={chip(get('coloris') === c)}>
                {c}
              </button>
            ))}
          </div>
        </FilterBlock>
      )}

      <FilterBlock title="Affiner">
        {([
          ['promo', 'En promotion'],
          ['nouveau', 'Nouveautés'],
          ['dispo', 'Disponibles uniquement'],
        ] as const).map(([k, label]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={!!get(k)} onChange={(e) => set({ [k]: e.target.checked ? '1' : '' })} className="h-4 w-4 accent-[#1b2438]" />
            {label}
          </label>
        ))}
      </FilterBlock>

      {active.length > 0 && (
        <button onClick={resetAll} className="text-sm text-earth underline">
          Réinitialiser les filtres
        </button>
      )}
    </div>
  )

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-4xl">{current ? current.label : 'Toute la collection'}</h1>
      <p className="mt-2 text-ink/70">{current ? current.blurb : 'Retrouvez toutes nos pièces.'}</p>

      {/* Barre de recherche */}
      <div className="mt-8 flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Rechercher : robe, lin, chemise, raphia…"
            aria-label="Rechercher un produit"
            className="w-full rounded-full border border-ink/20 bg-white py-3 pl-11 pr-4 outline-none focus:border-earth focus:ring-2 focus:ring-gold/30"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white px-4 text-sm md:hidden"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal size={16} /> Filtres{active.length > 0 && <span className="rounded-full bg-gold px-1.5 text-xs font-semibold">{active.length}</span>}
        </button>
      </div>

      {/* Catégories : conservent les autres critères */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/collection${suffix}`} className={tabClass(!current)}>
          Tout
        </Link>
        {categories.map((c) => (
          <Link key={c.id} to={`/collection/${c.id}${suffix}`} className={tabClass(current?.id === c.id)}>
            {c.label}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} rounded-2xl bg-sand/40 p-5 md:block md:bg-transparent md:p-0`}>{filters}</aside>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-ink/60">{loading && !items.length ? 'Recherche…' : `${total} article(s)`}</p>
            {active.map((a) => (
              <button key={a.label} onClick={a.clear} className="inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-xs hover:bg-gold/40">
                {a.label} <X size={12} />
              </button>
            ))}
          </div>
          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

          {!loading && !error && total === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-10 text-center">
              <p className="font-display text-xl">Aucun article ne correspond</p>
              <p className="mt-2 text-sm text-ink/60">Essayez un autre mot ou retirez un filtre.</p>
              {active.length > 0 && (
                <button onClick={resetAll} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm text-cream hover:bg-gold hover:text-ink">
                  Voir tous les articles
                </button>
              )}
            </div>
          ) : (
            <div className={`mt-4 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 ${loading && items.length ? 'opacity-60' : ''}`}>
              {items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {items.length < total && (
            <div className="mt-10 text-center">
              <button
                onClick={() => setPage(page + 1)}
                disabled={loading}
                className="rounded-full border border-ink px-6 py-3 text-sm transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
              >
                {loading ? 'Chargement…' : `Voir plus (${total - items.length} restant${total - items.length > 1 ? 's' : ''})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-display text-sm font-semibold">{title}</p>
      {children}
    </div>
  )
}
