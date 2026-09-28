import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category } from '../../lib/types'
import { api } from '../../lib/api'
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, useApi, useToast } from '../ui'

type Form = { id?: string; label: string; blurb: string; color: string; sort: number }
const EMPTY: Form = { label: '', blurb: '', color: '#1b2438', sort: 0 }

export default function Categories() {
  const toast = useToast()
  const { data, error, reload } = useApi<Category[]>('/api/admin/categories')
  const [form, setForm] = useState<Form | null>(null)

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await api(form!.id ? `/api/admin/categories/${form!.id}` : '/api/admin/categories', { method: form!.id ? 'PUT' : 'POST', body: form })
      toast(form!.id ? 'Catégorie modifiée' : 'Catégorie ajoutée')
      setForm(null)
      reload()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function remove(c: Category) {
    const warn = c.products_count ? ` Ses ${c.products_count} produit(s) seront « sans catégorie ».` : ''
    if (!confirm(`Supprimer la catégorie « ${c.label} » ?${warn}`)) return
    await api(`/api/admin/categories/${c.id}`, { method: 'DELETE' })
    toast('Catégorie supprimée')
    reload()
  }

  return (
    <>
      <PageHeader
        title="Catégories"
        subtitle="Les univers affichés sur la page d'accueil et dans les filtres de la collection."
        actions={<Button onClick={() => setForm({ ...EMPTY, sort: data.length + 1 })}><Plus size={16} /> Ajouter</Button>}
      />

      {form && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-12">
            <div className="sm:col-span-3"><Field label="Nom *"><Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field></div>
            <div className="sm:col-span-5"><Field label="Description courte"><Input value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Couleur"><Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 p-1" /></Field></div>
            <div className="sm:col-span-2"><Field label="Ordre"><Input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} /></Field></div>
            <div className="flex justify-end gap-2 sm:col-span-12">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
              <Button>Enregistrer</Button>
            </div>
          </form>
        </Card>
      )}

      {!data.length ? (
        <Empty>Aucune catégorie.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="flex items-start gap-4">
              <span className="mt-1 h-10 w-10 shrink-0 rounded-lg" style={{ background: c.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold">{c.label}</p>
                <p className="text-sm text-slate">{c.blurb}</p>
                <p className="mt-1 text-xs text-slate">{c.products_count} produit(s) · ordre {c.sort}</p>
              </div>
              <div className="flex">
                <Button variant="ghost" onClick={() => setForm({ ...c })} aria-label="Modifier"><Pencil size={15} /></Button>
                <Button variant="ghost" onClick={() => remove(c)} aria-label="Supprimer"><Trash2 size={15} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
