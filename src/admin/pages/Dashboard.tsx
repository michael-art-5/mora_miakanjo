import { Link } from 'react-router'
import { BadgePercent, Mail, Package, ShoppingBag, TrendingUp, Clock } from 'lucide-react'
import type { Dashboard as DashboardData, Shop } from '../../lib/types'
import { formatDate, formatPrice } from '../../lib/format'
import { Card, ErrorBox, Loading, PageHeader, useApi, Empty } from '../ui'
import { MessageStatusBadge, OrderStatusBadge } from '../constants'

export default function Dashboard() {
  const { data, error } = useApi<DashboardData>('/api/admin/dashboard')
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const cur = shop?.currency || 'Ar'

  const stats = [
    { label: 'Nouvelles commandes', value: data.orders_new, icon: ShoppingBag, to: '/admin/commandes?statut=nouvelle', highlight: data.orders_new > 0 },
    { label: 'Commandes en cours', value: data.orders_in_progress, icon: Clock, to: '/admin/commandes' },
    { label: 'Messages non lus', value: data.messages_new, icon: Mail, to: '/admin/messages', highlight: data.messages_new > 0 },
    { label: 'Ventes du mois', value: formatPrice(data.revenue_month, cur), icon: TrendingUp, to: '/admin/commandes' },
    { label: 'Produits en ligne', value: `${data.products_published} / ${data.products_total}`, icon: Package, to: '/admin/produits' },
    { label: 'Promotions actives', value: data.promotions_running, icon: BadgePercent, to: '/admin/promotions' },
  ]

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité de la boutique." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, to, highlight }) => (
          <Link key={label} to={to} className={`rounded-xl border p-4 shadow-sm transition-colors hover:border-gold ${highlight ? 'border-gold bg-gold/10' : 'border-ink/10 bg-white'}`}>
            <Icon size={20} className="text-earth" />
            <p className="mt-3 font-display text-2xl font-bold">{value}</p>
            <p className="text-sm text-slate">{label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-semibold">Dernières commandes</h2>
            <Link to="/admin/commandes" className="text-sm text-earth hover:underline">Tout voir</Link>
          </div>
          {data.recent_orders.length === 0 ? (
            <Empty>Aucune commande pour le moment.</Empty>
          ) : (
            <ul className="divide-y divide-ink/5">
              {data.recent_orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-earth">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.customer_name}</p>
                      <p className="text-xs text-slate">{o.reference} · {formatDate(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm">{formatPrice(o.total, cur)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display font-semibold">Derniers messages</h2>
            <Link to="/admin/messages" className="text-sm text-earth hover:underline">Tout voir</Link>
          </div>
          {data.recent_messages.length === 0 ? (
            <Empty>Aucun message.</Empty>
          ) : (
            <ul className="divide-y divide-ink/5">
              {data.recent_messages.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <MessageStatusBadge status={m.status} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate">{m.subject ? `${m.subject} — ` : ''}{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
