import { useState } from 'react'
import { Link } from 'react-router'
import { Search } from 'lucide-react'
import type { Client, Paged, Shop } from '../../lib/types'
import { formatDate, formatPrice } from '../../lib/format'
import { Empty, ErrorBox, Input, Loading, PageHeader, Pager, useApi } from '../ui'

export default function Clients() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const { data, error, loading } = useApi<Paged<Client>>(`/api/admin/clients?page=${pageNum}&size=25&q=${encodeURIComponent(search)}`)
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const cur = shop?.currency || 'Ar'

  return (
    <>
      <PageHeader title="Clients" subtitle="Une fiche par client, créée automatiquement à chaque commande ou message." />
      <form
        className="relative mb-4 w-full sm:w-72"
        onSubmit={(e) => {
          e.preventDefault()
          setSearch(q)
          setPageNum(1)
        }}
      >
        <Search size={16} className="absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate" />
        <Input placeholder="Nom, e-mail, téléphone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </form>
      {error ? (
        <ErrorBox message={error} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty>Aucun client{search ? ' pour cette recherche' : ' pour le moment'}.</Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-ink/10 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3 text-right">Commandes</th>
                  <th className="px-4 py-3 text-right">Total dépensé</th>
                  <th className="px-4 py-3 text-right">Messages</th>
                  <th className="px-4 py-3">Dernier contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {data.rows.map((c) => (
                  <tr key={c.id} className="hover:bg-cream">
                    <td className="px-4 py-3 font-medium">
                      {c.orders > 0 ? (
                        <Link to={`/admin/commandes?client=${c.id}`} className="hover:text-earth">{c.name}</Link>
                      ) : (
                        c.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {c.phone && <p>{c.phone}</p>}
                      {c.email && <p>{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">{c.orders}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(c.spent, cur)}</td>
                    <td className="px-4 py-3 text-right">{c.messages}</td>
                    <td className="px-4 py-3 text-slate">{formatDate(c.last_contact, false)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} size={data.size} total={data.total} onPage={setPageNum} />
        </>
      )}
    </>
  )
}
