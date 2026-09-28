import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Order, OrderStatus, Product, Shop } from '../../lib/types'
import { api } from '../../lib/api'
import { formatPrice } from '../../lib/format'
import { Button, Card, Field, Input, PageHeader, Select, Textarea, useApi, useToast } from '../ui'
import ProductPicker from '../ProductPicker'
import { ORDER_SOURCES, ORDER_STATUS } from '../constants'

type Line = { product: Product; size: string; color: string; quantity: number; unit_price: number }

// Saisie manuelle d'une commande (boutique, téléphone, WhatsApp…)
export default function OrderNew() {
  const navigate = useNavigate()
  const toast = useToast()
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const [form, setForm] = useState({ customer_name: '', phone: '', email: '', message: '', admin_note: '', source: 'boutique', status: 'confirmee' as OrderStatus })
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const cur = shop?.currency || 'Ar'

  const addLine = (p: Product) =>
    setLines([...lines, { product: p, size: p.sizes[0] ?? '', color: p.colors[0] ?? '', quantity: 1, unit_price: p.final_price }])
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const items = lines.map(({ product, ...l }) => ({ ...l, product_id: product.id }))
      const order = await api<Order>('/api/admin/orders', { method: 'POST', body: { ...form, items } })
      toast(`Commande ${order.reference} créée`)
      navigate(`/admin/commandes/${order.id}`)
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <Link to="/admin/commandes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
        <ArrowLeft size={16} /> Commandes
      </Link>
      <PageHeader title="Nouvelle commande" subtitle="Pour une vente en boutique ou une commande reçue par téléphone, WhatsApp ou réseaux sociaux." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-display font-semibold">Articles</h2>
          <ProductPicker onPick={addLine} placeholder="Ajouter un article : tapez son nom…" />
          {lines.length === 0 && <p className="text-sm text-slate">Ajoutez au moins un article.</p>}
          {lines.map((l, i) => {
            const p = l.product
            return (
              <div key={i} className="grid grid-cols-2 gap-3 rounded-lg bg-cream p-3 sm:grid-cols-12">
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-sm font-medium">Produit</p>
                  <p className="mt-2.5 text-sm">{p.name}</p>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Taille">
                    <Select value={l.size} onChange={(e) => setLine(i, { size: e.target.value })}>
                      <option value="">—</option>
                      {p.sizes.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Coloris">
                    <Select value={l.color} onChange={(e) => setLine(i, { color: e.target.value })}>
                      <option value="">—</option>
                      {p.colors.map((c) => <option key={c}>{c}</option>)}
                    </Select>
                  </Field>
                </div>
                <div className="sm:col-span-1">
                  <Field label="Qté">
                    <Input type="number" min={1} max={99} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) || 1 })} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={`Prix (${cur})`}>
                    <Input type="number" min={0} value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) || 0 })} />
                  </Field>
                </div>
                <div className="flex items-end justify-end sm:col-span-1">
                  <Button type="button" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Retirer">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            )
          })}
          <p className="text-right font-display text-lg font-bold">Total : {formatPrice(total, cur)}</p>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-display font-semibold">Client</h2>
          <Field label="Nom *"><Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Origine">
            <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {Object.entries(ORDER_SOURCES).filter(([k]) => k !== 'site').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}>
              {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Note interne"><Textarea rows={2} value={form.admin_note} onChange={(e) => setForm({ ...form, admin_note: e.target.value })} /></Field>
          <Button disabled={busy || !lines.length} className="w-full">{busy ? 'Enregistrement…' : 'Créer la commande'}</Button>
        </Card>
      </div>
    </form>
  )
}
