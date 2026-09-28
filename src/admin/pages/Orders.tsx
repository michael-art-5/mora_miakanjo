import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus, Search, X } from 'lucide-react'
import type { Order, OrderStatus, Paged, Shop } from '../../lib/types'
import { formatDate, formatPrice } from '../../lib/format'
import { Button, Empty, ErrorBox, Input, Loading, PageHeader, Pager, useApi } from '../ui'
import { ORDER_SOURCES, ORDER_STATUS, OrderStatusBadge } from '../constants'

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const status = params.get('statut') || ''
  const search = params.get('q') || ''
  const client = params.get('client') || ''
  const pageNum = Number(params.get('page')) || 1
  const [q, setQ] = useState(search)
  const query = new URLSearchParams({ page: String(pageNum), size: '25', ...(status && { status }), ...(search && { q: search }), ...(client && { customer: client }) })
  const { data, error, loading } = useApi<Paged<Order>>(`/api/admin/orders?${query}`)
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const cur = shop?.currency || 'Ar'

  // Met à jour les filtres dans l'adresse (page 1 à chaque changement de filtre)
  const update = (patch: Record<string, string>) => {
    const next = { statut: status, q: search, client, page: '', ...patch }
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)))
  }

  const tab = (value: string, label: string) => (
    <button
      key={value}
      onClick={() => update({ statut: value })}
      className={`rounded-full px-3 py-1.5 text-sm ${status === value ? 'bg-ink text-cream' : 'bg-white text-slate hover:text-ink'}`}
    >
      {label}
    </button>
  )

  return (
    <>
      <PageHeader
        title="Commandes"
        subtitle="Réservations reçues sur le site et commandes saisies en boutique."
        actions={
          <Link to="/admin/commandes/nouvelle">
            <Button><Plus size={16} /> Nouvelle commande</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tab('', 'Toutes')}
        {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => tab(s, ORDER_STATUS[s].label))}
        <form
          className="relative ml-auto w-full sm:w-64"
          onSubmit={(e) => {
            e.preventDefault()
            update({ q })
          }}
        >
          <Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate" />
          <Input placeholder="Nom, téléphone, référence…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </form>
      </div>
      {client && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-gold/15 px-3 py-1 text-sm">
          Commandes d'un client
          <button onClick={() => update({ client: '' })} aria-label="Retirer le filtre"><X size={14} /></button>
        </p>
      )}

      {error ? (
        <ErrorBox message={error} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty>Aucune commande{status || search || client ? ' pour ces critères' : ''}.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Origine</th>
                  <th className="px-4 py-3 text-right">Articles</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {data.rows.map((o) => (
                  <tr key={o.id} className="hover:bg-cream">
                    <td className="px-4 py-3">
                      <Link to={`/admin/commandes/${o.id}`} className="font-medium text-earth hover:underline">{o.reference}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.customer_name}</p>
                      <p className="text-xs text-slate">{o.phone || o.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 text-slate">{ORDER_SOURCES[o.source] ?? o.source}</td>
                    <td className="px-4 py-3 text-right">{o.items_count}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(o.total, cur)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} size={data.size} total={data.total} onPage={(p) => update({ page: String(p) })} />
        </>
      )}
    </>
  )
}
