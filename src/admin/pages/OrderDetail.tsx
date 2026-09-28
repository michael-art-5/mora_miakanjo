import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Mail, MessageCircle, Phone, Trash2 } from 'lucide-react'
import type { Order, OrderStatus, Shop } from '../../lib/types'
import { api } from '../../lib/api'
import { formatDate, formatPrice } from '../../lib/format'
import { Button, Card, ErrorBox, Loading, PageHeader, Textarea, useApi, useToast } from '../ui'
import { ORDER_SOURCES, ORDER_STATUS, OrderStatusBadge } from '../constants'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: order, setData, error } = useApi<Order>(`/api/admin/orders/${id}`)
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const [note, setNote] = useState('')
  const cur = shop?.currency || 'Ar'

  useEffect(() => {
    if (order) setNote(order.admin_note)
  }, [order])

  if (error) return <ErrorBox message={error} />
  if (!order) return <Loading />

  async function update(body: Partial<Order>, message: string) {
    try {
      setData(await api<Order>(`/api/admin/orders/${id}`, { method: 'PATCH', body }))
      toast(message)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement la commande ${order!.reference} ?`)) return
    await api(`/api/admin/orders/${id}`, { method: 'DELETE' })
    toast('Commande supprimée')
    navigate('/admin/commandes')
  }

  const phoneDigits = order.phone.replace(/\D/g, '')

  return (
    <>
      <Link to="/admin/commandes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate hover:text-ink">
        <ArrowLeft size={16} /> Commandes
      </Link>
      <PageHeader
        title={`Commande ${order.reference}`}
        subtitle={`Reçue le ${formatDate(order.created_at)} · ${ORDER_SOURCES[order.source] ?? order.source}`}
        actions={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-display font-semibold">Articles</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink/5">
                {order.items?.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <p className="font-medium">{it.product_name}</p>
                      <p className="text-xs text-slate">{[it.size && `Taille ${it.size}`, it.color].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="py-2.5 text-right text-slate">{it.quantity} × {formatPrice(it.unit_price, cur)}</td>
                    <td className="py-2.5 text-right font-medium">{formatPrice(it.quantity * it.unit_price, cur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink/10">
                  <td className="pt-3 font-semibold" colSpan={2}>Total</td>
                  <td className="pt-3 text-right font-display text-lg font-bold">{formatPrice(order.total, cur)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          {order.message && (
            <Card>
              <h2 className="mb-2 font-display font-semibold">Message du client</h2>
              <p className="whitespace-pre-line text-sm">{order.message}</p>
            </Card>
          )}

          <Card>
            <h2 className="mb-2 font-display font-semibold">Note interne</h2>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible uniquement par l'équipe" />
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" disabled={note === order.admin_note} onClick={() => update({ admin_note: note }, 'Note enregistrée')}>
                Enregistrer la note
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-display font-semibold">Client</h2>
            <p className="font-medium">{order.customer_name}</p>
            <div className="mt-3 space-y-2 text-sm">
              {order.phone && (
                <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-earth hover:underline"><Phone size={15} /> {order.phone}</a>
              )}
              {phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, votre commande ${order.reference} chez ${shop?.name ?? 'nous'}…`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-earth hover:underline"
                >
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
              {order.email && (
                <a href={`mailto:${order.email}?subject=${encodeURIComponent(`Votre commande ${order.reference}`)}`} className="flex items-center gap-2 text-earth hover:underline">
                  <Mail size={15} /> {order.email}
                </a>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display font-semibold">Changer le statut</h2>
            <div className="flex flex-col gap-2">
              {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={order.status === s}
                  onClick={() => update({ status: s }, `Statut : ${ORDER_STATUS[s].label}`)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    order.status === s ? 'border-gold bg-gold/15 font-medium' : 'border-ink/10 hover:border-ink/40'
                  }`}
                >
                  {ORDER_STATUS[s].label}
                </button>
              ))}
            </div>
          </Card>

          <Button variant="danger" className="w-full" onClick={remove}>
            <Trash2 size={16} /> Supprimer la commande
          </Button>
        </div>
      </div>
    </>
  )
}
