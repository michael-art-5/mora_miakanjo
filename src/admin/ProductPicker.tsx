import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { Product } from '../lib/types'
import { api } from '../lib/api'
import ProductVisual from '../components/ProductVisual'
import { Input } from './ui'

// Recherche de produit côté serveur : adapté à un catalogue de grande taille
export default function ProductPicker({
  onPick,
  placeholder = 'Rechercher un produit…',
  publishedOnly = false,
  exclude = [],
}: {
  onPick: (p: Product) => void
  placeholder?: string
  publishedOnly?: boolean
  exclude?: number[]
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, ...(publishedOnly ? { published: '1' } : {}) })
      api<Product[]>(`/api/admin/products/lookup?${params}`).then(setResults).catch(() => setResults([]))
    }, 200)
    return () => clearTimeout(t)
  }, [q, open, publishedOnly])

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const list = results.filter((p) => !exclude.includes(p.id))

  return (
    <div ref={box} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate" />
      <Input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-ink/10 bg-white py-1 shadow-lg">
          {list.length === 0 && <li className="px-3 py-2 text-sm text-slate">Aucun produit trouvé</li>}
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(p)
                  setOpen(false)
                  setQ('')
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-cream"
              >
                <ProductVisual product={p} className="h-9 w-7 shrink-0 rounded" />
                <span className="flex-1">{p.name}</span>
                {!p.is_published && <span className="text-xs text-slate">masqué</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
