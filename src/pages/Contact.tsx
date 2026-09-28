import { useState, type FormEvent } from 'react'
import { CheckCircle2, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { useSiteData } from '../site/SiteData'
import { api } from '../lib/api'

const input = 'mt-1 w-full rounded-md border border-ink/20 bg-cream px-3 py-2 outline-none focus:border-earth'

export default function Contact() {
  const { shop } = useSiteData()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '', website: '' })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      await api('/api/public/messages', { method: 'POST', body: form })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const infos = [
    { icon: MapPin, label: shop.address },
    { icon: Clock, label: shop.hours },
    { icon: Phone, label: shop.phone },
    { icon: Mail, label: shop.email },
  ].filter((i) => i.label)

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-2">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">Contactez-nous</h1>
        <p className="mt-4 text-ink/70">
          Une question sur un article, une taille ou une disponibilité ? Écrivez-nous ou passez nous voir.
        </p>
        <ul className="mt-8 space-y-4">
          {infos.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <Icon size={18} className="text-earth" /> {label}
            </li>
          ))}
        </ul>
      </div>

      {sent ? (
        <div className="rounded-2xl bg-sand p-8">
          <CheckCircle2 className="text-earth" size={36} />
          <p className="mt-4 font-display text-2xl font-semibold">Message envoyé, merci !</p>
          <p className="mt-2 text-ink/70">Nous vous répondons dans les meilleurs délais.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-sand p-6 sm:p-8">
          <label className="block">
            <span className="text-sm font-medium">Votre nom *</span>
            <input required className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">E-mail</span>
              <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Téléphone</span>
              <input type="tel" className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Sujet</span>
            <input className={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Message *</span>
            <textarea required rows={5} className={input} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>
          <input tabIndex={-1} autoComplete="off" className="hidden" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            disabled={sending}
            className="w-full rounded-full bg-ink px-6 py-3 text-cream transition-colors hover:bg-gold hover:text-ink disabled:opacity-60"
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
          <p className="text-xs text-ink/60">Indiquez au moins un e-mail ou un téléphone pour que nous puissions vous répondre.</p>
        </form>
      )}
    </section>
  )
}
