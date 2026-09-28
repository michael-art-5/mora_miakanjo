import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { api } from '../lib/api'

// ---------- Chargement de données ----------
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!path) return
    setLoading(true)
    api<T>(path)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [path])

  useEffect(reload, [reload])
  return { data, setData, error, loading, reload }
}

// ---------- Notifications ----------
type Toast = { id: number; text: string; kind: 'ok' | 'error' }
const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastContext value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'ok' ? 'bg-ink' : 'bg-red-700'}`}
          >
            {t.kind === 'ok' ? <CheckCircle2 size={16} className="text-gold" /> : <AlertCircle size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
export const useToast = () => useContext(ToastContext)

// ---------- Mise en page ----------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink/10 bg-white p-5 shadow-sm ${className}`}>{children}</div>
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-slate">Chargement…</p>
}

export function ErrorBox({ message }: { message: string }) {
  return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{message}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-ink/20 p-10 text-center text-sm text-slate">{children}</p>
}

// ---------- Formulaires ----------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }
export function Button({ variant = 'primary', className = '', ...props }: BtnProps) {
  const styles = {
    primary: 'bg-ink text-cream hover:bg-gold hover:text-ink',
    secondary: 'border border-ink/20 bg-white hover:border-ink',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-slate hover:bg-ink/5 hover:text-ink',
  }[variant]
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  )
}

const fieldClass = 'mt-1 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate">{hint}</span>}
    </label>
  )
}

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />
export const Textarea = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`${fieldClass} ${props.className ?? ''}`} />
)
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-gold' : 'bg-ink/20'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span>{label}</span>}
    </button>
  )
}

// Saisie d'une liste de valeurs (tailles, coloris) séparées par des virgules
export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  return (
    <div className={`${fieldClass} flex flex-wrap items-center gap-1.5`}>
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-sand px-2 py-0.5 text-xs">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Retirer ${v}`}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
        className="min-w-24 flex-1 bg-transparent outline-none"
      />
    </div>
  )
}

// Pagination « Précédent / Suivant » avec le nombre total de résultats
export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size))
  if (total <= size) return total ? <p className="mt-3 text-right text-xs text-slate">{total} résultat(s)</p> : null
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-slate">
        {(page - 1) * size + 1}–{Math.min(page * size, total)} sur {total.toLocaleString('fr-FR')}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Précédent</Button>
        <span className="text-slate">Page {page} / {pages}</span>
        <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Suivant</Button>
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'navy' | 'green' | 'red' | 'blue' | 'earth' }) {
  const styles = {
    neutral: 'bg-ink/5 text-slate',
    gold: 'bg-gold/20 text-earth',
    navy: 'bg-ink text-cream',
    green: 'bg-emerald-50 text-emerald-800',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-sky-50 text-sky-800',
    earth: 'bg-earth/10 text-earth',
  }[tone]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>{children}</span>
}
