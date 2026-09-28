import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAuth } from '../AdminApp'
import { Button, Card, Field, Input, PageHeader, useToast } from '../ui'

export default function Account() {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.next !== form.confirm) return toast('Les deux nouveaux mots de passe ne correspondent pas', 'error')
    setBusy(true)
    try {
      await api('/api/admin/password', { method: 'POST', body: form })
      toast('Mot de passe modifié')
      setForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Mon compte" subtitle={`Identifiant : ${user.username}`} />
      <Card className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Changer le mot de passe</h2>
          <Field label="Mot de passe actuel">
            <Input type="password" autoComplete="current-password" required value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </Field>
          <Field label="Nouveau mot de passe" hint="10 caractères minimum">
            <Input type="password" autoComplete="new-password" minLength={10} required value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </Field>
          <Field label="Confirmer le nouveau mot de passe">
            <Input type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </Field>
          <Button disabled={busy}>{busy ? 'Enregistrement…' : 'Modifier le mot de passe'}</Button>
        </form>
      </Card>
    </>
  )
}
