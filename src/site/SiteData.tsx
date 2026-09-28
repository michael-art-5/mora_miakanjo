import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { SiteData } from '../lib/types'

type State = { data: SiteData | null; error: string | null; reload: () => void }

const SiteDataContext = createContext<State>({ data: null, error: null, reload: () => {} })

// Charge une fois le contenu public (boutique, textes, catégories, produits)
export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    api<SiteData>('/api/public/site')
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(reload, [reload])

  return <SiteDataContext value={{ data, error, reload }}>{children}</SiteDataContext>
}

export function useSite() {
  return useContext(SiteDataContext)
}

// À utiliser dans les pages rendues sous <Layout>, qui attend le chargement
export function useSiteData(): SiteData {
  const { data } = useContext(SiteDataContext)
  if (!data) throw new Error('Données du site non chargées')
  return data
}
