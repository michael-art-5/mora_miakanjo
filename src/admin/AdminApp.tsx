import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { api } from '../lib/api'
import { ToastProvider } from './ui'
import AdminLayout from './AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Messages from './pages/Messages'
import Clients from './pages/Clients'
import Products from './pages/Products'
import ProductEdit from './pages/ProductEdit'
import Categories from './pages/Categories'
import Promotions from './pages/Promotions'
import HomeSettings from './pages/HomeSettings'
import ShopSettings from './pages/ShopSettings'
import Account from './pages/Account'

type User = { id: number; username: string }
type Auth = { user: User; logout: () => Promise<void> }
const AuthContext = createContext<Auth | null>(null)
export const useAuth = () => useContext(AuthContext)!

export default function AdminApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    document.title = 'Back office — MORA MIAKANJO'
    api<User>('/api/admin/me')
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const logout = useCallback(async () => {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />

  return (
    <AuthContext value={{ user, logout }}>
      <ToastProvider>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="commandes" element={<Orders />} />
            <Route path="commandes/nouvelle" element={<OrderNew />} />
            <Route path="commandes/:id" element={<OrderDetail />} />
            <Route path="messages" element={<Messages />} />
            <Route path="clients" element={<Clients />} />
            <Route path="produits" element={<Products />} />
            <Route path="produits/:id" element={<ProductEdit />} />
            <Route path="categories" element={<Categories />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="accueil" element={<HomeSettings />} />
            <Route path="boutique" element={<ShopSettings />} />
            <Route path="compte" element={<Account />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthContext>
  )
}
