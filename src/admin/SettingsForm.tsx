import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../lib/api'
import { Button, Card, ErrorBox, Field, Input, Loading, Textarea, useApi, useToast } from './ui'

export type FieldDef = { key: string; label: string; hint?: string; multiline?: number; type?: string; wide?: boolean }

// Formulaire générique pour un groupe de réglages (boutique, accueil, à propos)
export default function SettingsForm({ settingKey, title, fields, children }: { settingKey: string; title: string; fields: FieldDef[]; children?: ReactNode }) {
  const toast = useToast()
  const { data, error } = useApi<Record<string, string>>(`/api/admin/settings/${settingKey}`)
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (data) setValues(data)
  }, [data])

  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      setValues(await api(`/api/admin/settings/${settingKey}`, { method: 'PUT', body: values }))
      toast('Modifications enregistrées — visibles immédiatement sur le site')
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6">
      <form onSubmit={submit}>
        <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
        {children}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={f.wide || f.multiline ? 'sm:col-span-2' : ''}>
              <Field label={f.label} hint={f.hint}>
                {f.multiline ? (
                  <Textarea rows={f.multiline} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : (
                  <Input type={f.type ?? 'text'} value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                )}
              </Field>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Card>
  )
}
