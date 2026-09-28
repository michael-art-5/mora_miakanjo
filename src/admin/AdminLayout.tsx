import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import {
  BadgePercent,
  ExternalLink,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Package,
  ShoppingBag,
  Store,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from './AdminApp'

type Counts = { orders: number; messages: number }

const sections = [
  {
    title: 'Ventes',
    items: [
      { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/admin/commandes', label: 'Commandes', icon: ShoppingBag, count: 'orders' as const },
      { to: '/admin/messages', label: 'Messages', icon: Mail, count: 'messages' as const },
      { to: '/admin/clients', label: 'Clients', icon: Users },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { to: '/admin/produits', label: 'Produits', icon: Package },
      { to: '/admin/categories', label: 'Catégories', icon: FolderTree },
      { to: '/admin/promotions', label: 'Promotions', icon: BadgePercent },
    ],
  },
  {
    title: 'Site',
    items: [
      { to: '/admin/accueil', label: 'Accueil & À la une', icon: Newspaper },
      { to: '/admin/boutique', label: 'Nos informations', icon: Store },
      { to: '/admin/compte', label: 'Mon compte', icon: UserCog },
    ],
  },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<Counts>({ orders: 0, messages: 0 })

  // Compteurs rafraîchis à chaque navigation et toutes les minutes
  useEffect(() => {
    setOpen(false)
    const load = () => api<Counts>('/api/admin/counts').then(setCounts).catch(() => {})
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [pathname])

  const nav = (
    <nav className="flex flex-col gap-6 p-4">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-cream/40">{s.title}</p>
          <ul className="space-y-0.5">
            {s.items.map(({ to, label, icon: Icon, end, count }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive ? 'bg-cream/10 font-medium text-gold' : 'text-cream/75 hover:bg-cream/5 hover:text-cream'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {count && counts[count] > 0 && (
                    <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-ink">{counts[count]}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-[#f4f1ec] text-ink">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink lg:flex">
        <Link to="/admin" className="flex items-center gap-3 border-b border-cream/10 px-5 py-5">
          <img src="/logo-rond.png" alt="" className="h-11 w-11" />
          <span className="text-xs uppercase tracking-widest text-gold">Back office</span>
        </Link>
        <div className="flex-1 overflow-y-auto">{nav}</div>
      </aside>

      {/* Menu mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-ink">
            <div className="flex items-center justify-between border-b border-cream/10 px-5 py-4">
              <img src="/logo-rond.png" alt="" className="h-10 w-10" />
              <button onClick={() => setOpen(false)} className="text-cream" aria-label="Fermer le menu">
                <X />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-ink/10 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
            <Menu />
          </button>
          <div className="flex-1" />
          <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 text-sm text-slate hover:text-ink sm:inline-flex">
            <ExternalLink size={15} /> Voir le site
          </a>
          <span className="text-sm text-slate">
            Connecté : <strong className="text-ink">{user.username}</strong>
          </span>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm hover:bg-ink/5">
            <LogOut size={15} /> Déconnexion
          </button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
