import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { Button, Field, Input } from '../ui'

export default function Login({ onLogin }: { onLogin: (u: { id: number; username: string }) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onLogin(await api('/api/admin/login', { method: 'POST', body: { username, password } }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-cream p-8 shadow-xl">
        <img src="/logo-rond.png" alt="MORA MIAKANJO" className="mx-auto w-32" />
        <h1 className="mt-6 text-center font-display text-xl font-bold">Back office</h1>
        <p className="mt-1 text-center text-sm text-slate">Connectez-vous pour gérer la boutique.</p>
        <div className="mt-6 space-y-4">
          <Field label="Identifiant">
            <Input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="Mot de passe">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button disabled={busy} className="w-full py-2.5">
            {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
        </div>
      </form>
    </div>
  )
}
