import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from './components/Layout'
import Home from './pages/Home'
import Collection from './pages/Collection'
import ProductPage from './pages/ProductPage'
import About from './pages/About'
import Contact from './pages/Contact'
import NotFound from './pages/NotFound'
import { SiteDataProvider } from './site/SiteData'

// Le back office n'est chargé que lorsqu'on s'y rend
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="admin/*"
          element={
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route
          element={
            <SiteDataProvider>
              <Layout />
            </SiteDataProvider>
          }
        >
          <Route index element={<Home />} />
          <Route path="collection" element={<Collection />} />
          <Route path="collection/:category" element={<Collection />} />
          <Route path="produit/:id" element={<ProductPage />} />
          <Route path="a-propos" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
