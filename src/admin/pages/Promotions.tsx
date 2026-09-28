import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category, Promotion, Shop } from '../../lib/types'
import { api } from '../../lib/api'
import { discountLabel, formatDate } from '../../lib/format'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Loading, PageHeader, Select, Toggle, useApi, useToast } from '../ui'
import ProductPicker from '../ProductPicker'

type Form = Omit<Promotion, 'id' | 'running' | 'is_active'> & { id?: number; is_active: boolean }
const EMPTY: Form = { name: '', kind: 'percent', value: 10, scope: 'all', target: null, target_label: null, starts_at: null, ends_at: null, is_active: true }

export default function Promotions() {
  const toast = useToast()
  const { data, error, reload } = useApi<Promotion[]>('/api/admin/promotions')
  const { data: categories } = useApi<Category[]>('/api/admin/categories')
  const { data: shop } = useApi<Shop>('/api/admin/settings/shop')
  const [form, setForm] = useState<Form | null>(null)
  const cur = shop?.currency || 'Ar'

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await api(form!.id ? `/api/admin/promotions/${form!.id}` : '/api/admin/promotions', { method: form!.id ? 'PUT' : 'POST', body: form })
      toast(form!.id ? 'Promotion modifiée' : 'Promotion créée')
      setForm(null)
      reload()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  async function remove(p: Promotion) {
    if (!confirm(`Supprimer la promotion « ${p.name} » ?`)) return
    await api(`/api/admin/promotions/${p.id}`, { method: 'DELETE' })
    toast('Promotion supprimée')
    reload()
  }

  const scopeLabel = (p: Promotion) =>
    p.scope === 'all'
      ? 'Tout le catalogue'
      : p.scope === 'category'
        ? `Catégorie : ${categories?.find((c) => c.id === p.target)?.label ?? p.target}`
        : `Produit : ${p.target_label ?? 'supprimé'}`

  const period = (p: Promotion) =>
    p.starts_at && p.ends_at
      ? `Du ${formatDate(p.starts_at, false)} au ${formatDate(p.ends_at, false)}`
      : p.starts_at
        ? `À partir du ${formatDate(p.starts_at, false)}`
        : p.ends_at
          ? `Jusqu'au ${formatDate(p.ends_at, false)}`
          : 'Sans limite de date'

  return (
    <>
      <PageHeader
        title="Promotions"
        subtitle="Les remises s'appliquent automatiquement aux prix du site. En cas de cumul, la plus avantageuse l'emporte."
        actions={<Button onClick={() => setForm({ ...EMPTY })}><Plus size={16} /> Nouvelle promotion</Button>}
      />

      {form && (
        <Card className="mb-6">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-6">
            <div className="sm:col-span-3"><Field label="Nom *" hint="Affiché aux clients, ex. « Soldes d'été »"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
            <div className="sm:col-span-1">
              <Field label="Type">
                <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Form['kind'] })}>
                  <option value="percent">%</option>
                  <option value="fixed">{cur}</option>
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={form.kind === 'percent' ? 'Remise (%)' : `Remise (${cur})`}>
                <Input type="number" min={1} max={form.kind === 'percent' ? 90 : undefined} required value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="S'applique à">
                <Select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Form['scope'], target: null })}>
                  <option value="all">Tout le catalogue</option>
                  <option value="category">Une catégorie</option>
                  <option value="product">Un produit</option>
                </Select>
              </Field>
            </div>
            {form.scope === 'category' && (
              <div className="sm:col-span-4">
                <Field label="Catégorie">
                  <Select required value={form.target ?? ''} onChange={(e) => setForm({ ...form, target: e.target.value })}>
                    <option value="">Choisir…</option>
                    {categories?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </Field>
              </div>
            )}
            {form.scope === 'product' && (
              <div className="sm:col-span-4">
                <p className="text-sm font-medium">Produit</p>
                <div className="mt-1">
                  <ProductPicker
                    placeholder={form.target_label ? `Choisi : ${form.target_label} — rechercher pour changer` : 'Rechercher le produit…'}
                    onPick={(p) => setForm({ ...form, target: String(p.id), target_label: p.name })}
                  />
                </div>
                {form.target_label && <p className="mt-1 text-xs text-earth">Produit ciblé : {form.target_label}</p>}
              </div>
            )}
            <div className="sm:col-span-2"><Field label="Début" hint="Vide = immédiatement"><Input type="date" value={form.starts_at ?? ''} onChange={(e) => setForm({ ...form, starts_at: e.target.value || null })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Fin (incluse)" hint="Vide = sans fin"><Input type="date" value={form.ends_at ?? ''} onChange={(e) => setForm({ ...form, ends_at: e.target.value || null })} /></Field></div>
            <div className="flex items-end sm:col-span-2 sm:pb-6"><Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Activée" /></div>
            <div className="flex justify-end gap-2 sm:col-span-6">
              <Button type="button" variant="ghost" onClick={() => setForm(null)}>Annuler</Button>
              <Button>Enregistrer</Button>
            </div>
          </form>
        </Card>
      )}

      {!data.length ? (
        <Empty>Aucune promotion. Créez-en une pour afficher des prix barrés sur le site.</Empty>
      ) : (
        <div className="space-y-3">
          {data.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-4">
              <span className="rounded-lg bg-gold px-3 py-2 font-display text-lg font-bold text-ink">{discountLabel(p, cur)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-slate">{scopeLabel(p)} · {period(p)}</p>
              </div>
              {p.running ? <Badge tone="green">En cours</Badge> : p.is_active ? <Badge tone="blue">Programmée / terminée</Badge> : <Badge>Désactivée</Badge>}
              <div className="flex">
                <Button variant="ghost" onClick={() => setForm({ ...p, is_active: !!p.is_active })} aria-label="Modifier"><Pencil size={15} /></Button>
                <Button variant="ghost" onClick={() => remove(p)} aria-label="Supprimer"><Trash2 size={15} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
