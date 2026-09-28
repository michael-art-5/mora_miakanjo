import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, CheckCircle2, MessageCircle, Minus, Plus } from 'lucide-react'
import { useSiteData } from '../site/SiteData'
import { api } from '../lib/api'
import { discountLabel, formatPrice } from '../lib/format'
import type { Product } from '../lib/types'
import ProductVisual from '../components/ProductVisual'
import ProductCard from '../components/ProductCard'
import Price from '../components/Price'
import NotFound from './NotFound'

const input = 'mt-1 w-full rounded-md border border-ink/20 bg-cream px-3 py-2 outline-none focus:border-earth'

type Detail = { product: Product; related: Product[] }

export default function ProductPage() {
  const { id } = useParams()
  // La clé réinitialise le formulaire quand on passe d'un produit à l'autre
  return <ProductDetail key={id} slug={id ?? ''} />
}

function ProductDetail({ slug }: { slug: string }) {
  const { shop, categories } = useSiteData()
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined)
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', message: '', website: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ reference: string; total: number } | null>(null)

  useEffect(() => {
    api<Detail>(`/api/public/products/${encodeURIComponent(slug)}`)
      .then(setDetail)
      .catch(() => setDetail(null))
  }, [slug])

  if (detail === undefined) return <p className="py-24 text-center text-sm text-ink/60">Chargement…</p>
  if (!detail) return <NotFound />
  const { product, related } = detail

  const category = categories.find((c) => c.id === product.category_id)
  const needsSize = product.sizes.length > 1
  const needsColor = product.colors.length > 1

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (needsSize && !size) return setError('Choisissez une taille.')
    if (needsColor && !color) return setError('Choisissez un coloris.')
    setSending(true)
    try {
      const res = await api<{ reference: string; total: number }>('/api/public/orders', {
        method: 'POST',
        body: {
          ...form,
          items: [
            {
              product_id: product.id,
              size: size || product.sizes[0] || '',
              color: color || product.colors[0] || '',
              quantity,
            },
          ],
        },
      })
      setDone(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const whatsappLink = shop.whatsapp
    ? `https://wa.me/${shop.whatsapp}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par « ${product.name} »${size ? ` en taille ${size}` : ''}.`)}`
    : null

  const choice = (active: boolean) =>
    `min-w-12 rounded-md border px-3 py-2 text-sm transition-colors ${active ? 'border-ink bg-ink text-cream' : 'border-ink/20 hover:border-ink'}`

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        to={category ? `/collection/${category.id}` : '/collection'}
        className="inline-flex items-center gap-2 text-sm text-ink/70 hover:text-earth"
      >
        <ArrowLeft size={16} /> {category?.label ?? 'Collection'}
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="relative">
          <ProductVisual product={product} className="aspect-[3/4] w-full rounded-xl" />
          {product.promotion && (
            <span className="absolute left-4 top-4 rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-ink">
              {discountLabel(product.promotion, shop.currency)}
            </span>
          )}
        </div>

        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{product.name}</h1>
          <p className="mt-3">
            <Price product={product} currency={shop.currency} large />
          </p>
          {product.promotion && <p className="mt-1 text-sm text-earth">{product.promotion.name}</p>}
          <p className="mt-6 whitespace-pre-line leading-relaxed text-ink/80">{product.description}</p>

          {!product.in_stock ? (
            <p className="mt-8 rounded-lg bg-sand/60 p-4 text-sm">
              Cet article est actuellement épuisé. <Link to="/contact" className="text-earth underline">Contactez-nous</Link> pour
              connaître la date de retour.
            </p>
          ) : done ? (
            <div className="mt-8 rounded-2xl bg-sand/60 p-6">
              <CheckCircle2 className="text-earth" size={32} />
              <p className="mt-3 font-display text-xl font-semibold">Réservation enregistrée !</p>
              <p className="mt-2 text-sm text-ink/80">
                Votre référence : <strong>{done.reference}</strong> ({formatPrice(done.total, shop.currency)}). Nous vous
                contactons rapidement pour confirmer la disponibilité et le retrait en boutique.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-6">
              {product.sizes.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Taille</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.sizes.map((s) => (
                      <button type="button" key={s} onClick={() => setSize(s)} className={choice(size === s || !needsSize)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {product.colors.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Coloris</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.colors.map((c) => (
                      <button type="button" key={c} onClick={() => setColor(c)} className={choice(color === c || !needsColor)}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium">Quantité</p>
                <div className="mt-2 inline-flex items-center rounded-md border border-ink/20">
                  <button type="button" className="p-2" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Moins">
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center">{quantity}</span>
                  <button type="button" className="p-2" onClick={() => setQuantity(Math.min(20, quantity + 1))} aria-label="Plus">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <fieldset className="space-y-3 rounded-2xl bg-sand/50 p-5">
                <legend className="px-1 font-display font-semibold">Réserver cet article</legend>
                <label className="block text-sm">
                  Votre nom *
                  <input required className={input} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    Téléphone *
                    <input required type="tel" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="block text-sm">
                    E-mail
                    <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                </div>
                <label className="block text-sm">
                  Message (facultatif)
                  <textarea rows={2} className={input} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </label>
                {/* Champ piège invisible pour les robots */}
                <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                {error && <p className="text-sm text-red-700">{error}</p>}
                <button
                  disabled={sending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 font-semibold text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-60"
                >
                  {sending ? 'Envoi…' : `Réserver — ${formatPrice(product.final_price * quantity, shop.currency)}`}
                </button>
                <p className="text-xs text-ink/60">Aucun paiement en ligne : vous réglez au retrait en boutique.</p>
              </fieldset>

              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-earth hover:underline">
                  <MessageCircle size={16} /> Une question ? Écrivez-nous sur WhatsApp
                </a>
              )}
            </form>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="font-display text-2xl">Vous aimerez aussi</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
