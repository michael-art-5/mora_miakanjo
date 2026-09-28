import { useState } from 'react'
import { Mail, MessageCircle, Phone, Trash2 } from 'lucide-react'
import type { Message, MessageStatus, Paged } from '../../lib/types'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, Pager, useApi, useToast } from '../ui'
import { MESSAGE_STATUS, MessageStatusBadge } from '../constants'

export default function Messages() {
  const toast = useToast()
  const [filter, setFilterState] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const { data, setData, error, loading } = useApi<Paged<Message>>(`/api/admin/messages?status=${filter}&page=${pageNum}&size=25`)
  const setFilter = (v: string) => {
    setFilterState(v)
    setPageNum(1)
  }
  // Applique une modification à la liste de la page courante
  const patchRows = (fn: (rows: Message[]) => Message[]) => setData((d) => (d ? { ...d, rows: fn(d.rows) } : d))
  const [openId, setOpenId] = useState<number | null>(null)

  async function setStatus(m: Message, status: MessageStatus, silent = false) {
    const updated = await api<Message>(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { status } })
    patchRows((rows) => rows.map((x) => (x.id === m.id ? updated : x)).filter((x) => filter || x.status !== 'archive'))
    if (!silent) toast(`Message : ${MESSAGE_STATUS[status].label}`)
  }

  async function remove(m: Message) {
    if (!confirm(`Supprimer définitivement le message de ${m.name} ?`)) return
    await api(`/api/admin/messages/${m.id}`, { method: 'DELETE' })
    patchRows((rows) => rows.filter((x) => x.id !== m.id))
    toast('Message supprimé')
  }

  function open(m: Message) {
    setOpenId(openId === m.id ? null : m.id)
    if (m.status === 'nouveau') setStatus(m, 'lu', true)
  }

  const tabs: [string, string][] = [['', 'Boîte de réception'], ['nouveau', 'Non lus'], ['traite', 'Traités'], ['archive', 'Archivés']]

  return (
    <>
      <PageHeader title="Messages" subtitle="Demandes envoyées depuis la page Contact du site." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-full px-3 py-1.5 text-sm ${filter === v ? 'bg-ink text-cream' : 'bg-white text-slate hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {error ? (
        <ErrorBox message={error} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.rows.length ? (
        <Empty>Aucun message.</Empty>
      ) : (
        <div className="space-y-2">
          {data.rows.map((m) => {
            const digits = m.phone.replace(/\D/g, '')
            return (
              <Card key={m.id} className={`p-0 ${m.status === 'nouveau' ? 'border-gold' : ''}`}>
                <button onClick={() => open(m)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${m.status === 'nouveau' ? 'font-semibold' : 'font-medium'}`}>
                      {m.name} {m.subject && <span className="font-normal text-slate">— {m.subject}</span>}
                    </p>
                    {openId !== m.id && <p className="truncate text-xs text-slate">{m.body}</p>}
                  </div>
                  <span className="hidden shrink-0 text-xs text-slate sm:inline">{formatDate(m.created_at)}</span>
                  <MessageStatusBadge status={m.status} />
                </button>
                {openId === m.id && (
                  <div className="border-t border-ink/5 px-5 py-4">
                    <p className="whitespace-pre-line text-sm">{m.body}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {m.email && (
                        <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re : ' + (m.subject || 'votre message'))}`}>
                          <Button variant="secondary"><Mail size={15} /> Répondre par e-mail</Button>
                        </a>
                      )}
                      {digits && (
                        <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
                          <Button variant="secondary"><MessageCircle size={15} /> WhatsApp</Button>
                        </a>
                      )}
                      {m.phone && (
                        <a href={`tel:${m.phone}`}>
                          <Button variant="secondary"><Phone size={15} /> {m.phone}</Button>
                        </a>
                      )}
                      <div className="flex-1" />
                      {m.status !== 'traite' && <Button variant="ghost" onClick={() => setStatus(m, 'traite')}>Marquer traité</Button>}
                      {m.status !== 'archive' && <Button variant="ghost" onClick={() => setStatus(m, 'archive')}>Archiver</Button>}
                      <Button variant="ghost" onClick={() => remove(m)} aria-label="Supprimer"><Trash2 size={15} /></Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
          <Pager page={data.page} size={data.size} total={data.total} onPage={setPageNum} />
        </div>
      )}
    </>
  )
}
