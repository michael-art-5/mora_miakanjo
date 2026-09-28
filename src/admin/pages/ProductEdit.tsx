import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, ImagePlus, Trash2, X } from 'lucide-react'
import type { Category, Product, Shop } from '../../lib/types'
import { api } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import ProductVisual from '../../components/ProductVisual'
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Select, TagInput, Textarea, Toggle, useApi, useToast } from '../ui'

type Form = Omit<Product, 'id' | 'slug' | 'final_price' | 'promotion' | 'created_at' | 'updated_at'>

const EMPTY: Form = {
  name: '',
  category_id: null,
  price: 0,
  description: '',
  sizes: [],
  colors: [],
  image: null,
  tone: '#c49a5c',
  is_new: true,
  is_featured: false,
  is_published: true,
  in_stock: true,
  sort: 0,
}

export default function ProductEdit() {
  const { id } = useParams()
  const isNew = id === 'nouveau'
  const navigate = useNavigate()
  const toast = useToast()
  const { data: product, error } = useApi<Product>(isNew ? null : `/api/admin/products/${id}`)
  const { data: categories } = useApi<Category[]>('/api/admin/categories')
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cur = shop?.currency || 'Ar'

  useEffect(() => {
    if (product) setForm(product)
  }, [product])

  if (!isNew && error) return <ErrorBox message={error} />
  if (!isNew && !product) return <Loading />

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('image', file)
      const { url } = await api<{ url: string }>('/api/admin/upload', { method: 'POST', body })
      set({ image: url })
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const saved = await api<Product>(isNew ? '/api/admin/products' : `/api/admin/products/${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: form,
      })
      toast(isNew ? 'Produit ajouté' : 'Modifications enregistrées')
      if (isNew) navigate(`/admin/produits/${saved.id}`, { replace: true })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement « ${form.name} » ? Les commandes passées conservent leur historique.`)) return
    await api(`/api/admin/products/${id}`, { method: 'DELETE' })
    toast('Produit supprimé')
    navigate('/admin/produits')
  }

  return (
    <form onSubmit={submit}>
      <Link to="/admin/produits" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
        <ArrowLeft size={16} /> Produits
      </Link>
      <PageHeader
        title={isNew ? 'Nouveau produit' : form.name || 'Produit'}
        actions={
          <>
            {!isNew && product?.is_published && (
              <a href={`/produit/${product.slug}`} target="_blank" rel="noreferrer">
                <Button type="button" variant="secondary"><ExternalLink size={16} /> Voir sur le site</Button>
              </a>
            )}
            <Button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <Field label="Nom du produit *">
              <Input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Textarea rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tailles disponibles" hint="Entrée ou virgule pour ajouter (ex. S, M, L)">
                <TagInput value={form.sizes} onChange={(sizes) => set({ sizes })} placeholder="S, M, L…" />
              </Field>
              <Field label="Coloris disponibles" hint="Entrée ou virgule pour ajouter">
                <TagInput value={form.colors} onChange={(colors) => set({ colors })} placeholder="Noir, Blanc…" />
              </Field>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display font-semibold">Prix et classement</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={`Prix (${cur}) *`}>
                <Input type="number" min={0} step={500} required value={form.price} onChange={(e) => set({ price: Number(e.target.value) })} />
              </Field>
              <Field label="Catégorie">
                <Select value={form.category_id ?? ''} onChange={(e) => set({ category_id: e.target.value || null })}>
                  <option value="">Sans catégorie</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Ordre d'affichage" hint="Les plus petits en premier">
                <Input type="number" value={form.sort} onChange={(e) => set({ sort: Number(e.target.value) })} />
              </Field>
            </div>
            {product?.promotion && (
              <p className="rounded-lg bg-gold/15 p-3 text-sm">
                Promotion en cours : <strong>{product.promotion.name}</strong> — prix affiché{' '}
                <strong>{formatPrice(product.final_price, cur)}</strong>. Gérez-la dans{' '}
                <Link to="/admin/promotions" className="text-earth underline">Promotions</Link>.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-display font-semibold">Photo</h2>
            <div className="relative">
              <ProductVisual product={form} className="aspect-[3/4] w-full rounded-lg" />
              {form.image && (
                <button type="button" onClick={() => set({ image: null })} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow" aria-label="Retirer la photo">
                  <X size={14} />
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
            />
            <Button type="button" variant="secondary" className="w-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={16} /> {uploading ? 'Envoi…' : form.image ? 'Changer la photo' : 'Ajouter une photo'}
            </Button>
            <p className="text-xs text-slate">JPG, PNG ou WebP, 5 Mo maximum. Format portrait (3:4) conseillé.</p>
            {!form.image && (
              <Field label="Couleur du visuel de remplacement">
                <Input type="color" value={form.tone} onChange={(e) => set({ tone: e.target.value })} className="h-10 p-1" />
              </Field>
            )}
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display font-semibold">Visibilité</h2>
            <Toggle checked={form.is_published} onChange={(v) => set({ is_published: v })} label="Visible sur le site" />
            <Toggle checked={form.is_featured} onChange={(v) => set({ is_featured: v })} label="Mis à la une (page d'accueil)" />
            <Toggle checked={form.is_new} onChange={(v) => set({ is_new: v })} label="Badge « Nouveau »" />
            <Toggle checked={form.in_stock} onChange={(v) => set({ in_stock: v })} label="En stock (réservable)" />
          </Card>

          {!isNew && (
            <Button type="button" variant="danger" className="w-full" onClick={remove}>
              <Trash2 size={16} /> Supprimer le produit
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
