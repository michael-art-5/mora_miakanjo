import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Menu, Search, X } from 'lucide-react'
import { useSite } from '../site/SiteData'

const links = [
  { to: '/', label: 'Accueil' },
  { to: '/collection', label: 'Collection' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data, error, reload } = useSite()

  useEffect(() => {
    setOpen(false)
    setSearchOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <img src="/logo-rond.png" alt="" className="h-20 w-20 animate-pulse" />
        {error && (
          <>
            <p className="text-ink/70">Le site est momentanément indisponible.</p>
            <button onClick={reload} className="rounded-full bg-ink px-5 py-2 text-sm text-cream">
              Réessayer
            </button>
          </>
        )}
      </div>
    )
  }

  const { shop, home } = data

  return (
    <div className="flex min-h-screen flex-col">
      {home.announcement && (
        <p className="bg-ink px-4 py-2 text-center text-xs font-medium tracking-wide text-gold sm:text-sm">{home.announcement}</p>
      )}
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label={`${shop.name} — accueil`}>
            <img src="/logo-rond.png" alt="" className="h-11 w-11" />
            <span className="font-display text-base font-extrabold tracking-[0.08em] sm:text-lg">{shop.name}</span>
          </Link>

          <nav className="hidden gap-8 text-sm md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => `transition-colors hover:text-earth ${isActive ? 'text-earth font-medium' : ''}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button onClick={() => setSearchOpen(!searchOpen)} aria-label={searchOpen ? 'Fermer la recherche' : 'Rechercher'} className="hover:text-earth">
              {searchOpen ? <X size={22} /> : <Search size={22} />}
            </button>
            <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}>
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const q = search.trim()
              navigate(q ? `/collection?q=${encodeURIComponent(q)}` : '/collection')
              setSearch('')
              setSearchOpen(false)
            }}
            className="mx-auto flex max-w-6xl gap-2 px-4 pb-4 sm:px-6"
          >
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Que recherchez-vous ? Robe, lin, raphia…"
                aria-label="Rechercher dans la boutique"
                className="w-full rounded-full border border-ink/20 bg-white py-2.5 pl-11 pr-4 outline-none focus:border-earth"
              />
            </div>
            <button className="rounded-full bg-ink px-5 text-sm text-cream hover:bg-gold hover:text-ink">Rechercher</button>
          </form>
        )}

        {open && (
          <nav className="flex flex-col border-t border-ink/10 px-4 pb-4 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) => `py-3 ${isActive ? 'text-earth font-medium' : ''}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-ink text-cream/80">
        <div className="motif-textile h-4" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <img src="/logo-rond.png" alt={shop.name} className="w-32" />
            <p className="mt-4 text-sm">{shop.tagline}</p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-display font-semibold text-gold">Boutique</p>
            <p>{shop.address}</p>
            <p>{shop.hours}</p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-display font-semibold text-gold">Contact</p>
            <p>{shop.phone}</p>
            <p>{shop.email}</p>
            <div className="mt-2 flex gap-4">
              {shop.instagram && (
                <a href={shop.instagram} target="_blank" rel="noreferrer" className="hover:text-gold">
                  Instagram
                </a>
              )}
              {shop.facebook && (
                <a href={shop.facebook} target="_blank" rel="noreferrer" className="hover:text-gold">
                  Facebook
                </a>
              )}
            </div>
          </div>
        </div>
        <p className="border-t border-cream/10 py-4 text-center text-xs">
          © {new Date().getFullYear()} {shop.name}. Tous droits réservés.
        </p>
      </footer>
    </div>
  )
}
