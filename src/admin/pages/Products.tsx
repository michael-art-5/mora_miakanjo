import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Pencil, Plus, Search } from 'lucide-react'
import type { Category, Paged, Product, Shop } from '../../lib/types'
import { api } from '../../lib/api'
import { discountLabel, formatPrice } from '../../lib/format'
import ProductVisual from '../../components/ProductVisual'
import { Badge, Button, Empty, ErrorBox, Input, Loading, PageHeader, Pager, Select, Toggle, useApi, useToast } from '../ui'

type Flag = 'is_published' | 'is_featured' | 'is_new' | 'in_stock'

export default function Products() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('')
  const [pageNum, setPageNum] = useState(1)
  // Recherche côté serveur, déclenchée après une courte pause de saisie
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q)
      setPageNum(1)
    }, 300)
    return () => clearTimeout(t)
  }, [q])
  const params = new URLSearchParams({ page: String(pageNum), size: '25', ...(search && { q: search }), ...(cat && { category: cat }) })
  const { data, setData, error } = useApi<Paged<Product>>(`/api/admin/products?${params}`)
  const { data: categories } = useApi<Category[]>('/api/admin/categories')
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const cur = shop?.currency || 'Ar'

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  async function flip(p: Product, key: Flag) {
    try {
      const updated = await api<Product>(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { [key]: !p[key] } })
      setData((d) => (d ? { ...d, rows: d.rows.map((x) => (x.id === p.id ? updated : x)) } : d))
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const list = data.rows
  const catLabel = (id: string | null) => categories?.find((c) => c.id === id)?.label ?? '—'

  return (
    <>
      <PageHeader
        title="Produits"
        subtitle="Gérez le catalogue : prix, visibilité, mise à la une et disponibilité."
        actions={
          <Link to="/admin/produits/nouveau">
            <Button><Plus size={16} /> Ajouter un produit</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate" />
          <Input placeholder="Rechercher un produit…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={cat} onChange={(e) => { setCat(e.target.value); setPageNum(1) }} className="w-auto">
          <option value="">Toutes les catégories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>

      {!list.length ? (
        <Empty>Aucun produit.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-slate">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3 text-right">Prix</th>
                <th className="px-3 py-3 text-center">En ligne</th>
                <th className="px-3 py-3 text-center">À la une</th>
                <th className="px-3 py-3 text-center">Nouveau</th>
                <th className="px-3 py-3 text-center">En stock</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {list.map((p) => (
                <tr key={p.id} className={`hover:bg-cream ${p.is_published ? '' : 'text-slate'}`}>
                  <td className="px-4 py-3">
                    <Link to={`/admin/produits/${p.id}`} className="flex items-center gap-3 hover:text-earth">
                      <ProductVisual product={p} className="h-12 w-10 shrink-0 rounded-md" />
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">{catLabel(p.category_id)}</td>
                  <td className="px-4 py-3 text-right">
                    {p.promotion ? (
                      <div>
                        <span className="font-medium text-earth">{formatPrice(p.final_price, cur)}</span>{' '}
                        <Badge tone="gold">{discountLabel(p.promotion, cur)}</Badge>
                        <p className="text-xs text-slate line-through">{formatPrice(p.price, cur)}</p>
                      </div>
                    ) : (
                      formatPrice(p.price, cur)
                    )}
                  </td>
                  {(['is_published', 'is_featured', 'is_new', 'in_stock'] as Flag[]).map((k) => (
                    <td key={k} className="px-3 py-3 text-center">
                      <Toggle checked={p[k]} onChange={() => flip(p, k)} label={undefined} />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Link to={`/admin/produits/${p.id}`} className="inline-flex rounded-lg p-2 text-slate hover:bg-ink/5 hover:text-ink" aria-label="Modifier">
                      <Pencil size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={data.page} size={data.size} total={data.total} onPage={setPageNum} />
    </>
  )
}
