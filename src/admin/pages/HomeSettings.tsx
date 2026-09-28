import { Link } from 'react-router'
import { Star, X } from 'lucide-react'
import type { Paged, Product } from '../../lib/types'
import { api } from '../../lib/api'
import SettingsForm from '../SettingsForm'
import { Card, PageHeader, useApi, useToast } from '../ui'
import ProductVisual from '../../components/ProductVisual'
import ProductPicker from '../ProductPicker'

export default function HomeSettings() {
  const toast = useToast()
  // Seuls les produits à la une sont chargés ; les autres s'ajoutent par recherche
  const { data, reload } = useApi<Paged<Product>>('/api/admin/products?featured=1&size=100')
  const featured = data?.rows ?? []

  async function setFeatured(p: Product, value: boolean) {
    await api<Product>(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { is_featured: value } })
    toast(value ? `« ${p.name} » mis à la une` : `« ${p.name} » retiré de la une`)
    reload()
  }

  return (
    <>
      <PageHeader title="Accueil & À la une" subtitle="Textes de la page d'accueil, bandeau d'annonce et produits mis en avant." />

      <SettingsForm
        settingKey="home"
        title="Bandeau et bannière"
        fields={[
          { key: 'announcement', label: "Bandeau d'annonce (haut du site)", hint: 'Ex. « Soldes : -20 % sur les robes jusqu’au 15 octobre ». Laisser vide pour le masquer.', wide: true },
          { key: 'hero_eyebrow', label: 'Surtitre', hint: 'Petit texte au-dessus du titre' },
          { key: 'hero_cta', label: 'Texte du bouton' },
          { key: 'hero_title', label: 'Titre' },
          { key: 'hero_highlight', label: 'Titre (2ᵉ ligne, en couleur)' },
          { key: 'hero_text', label: "Texte d'accroche", multiline: 2 },
          { key: 'featured_title', label: 'Titre de la section « À la une »' },
          { key: 'new_title', label: 'Titre de la section « Nouveautés »' },
        ]}
      />

      <Card className="mb-6">
        <div className="mb-4 flex items-center gap-2">
          <Star size={18} className="text-gold" />
          <h2 className="font-display text-lg font-semibold">Produits à la une</h2>
        </div>
        <p className="mb-4 text-sm text-slate">
          La page d'accueil affiche les 8 premiers produits à la une, dans l'ordre d'affichage défini sur chaque produit
          (<Link to="/admin/produits" className="text-earth underline">gérer les produits</Link>). Seuls les produits visibles sur le site apparaissent.
        </p>
        <div className="mb-4 sm:w-96">
          <ProductPicker publishedOnly exclude={featured.map((p) => p.id)} placeholder="Ajouter un produit à la une…" onPick={(p) => setFeatured(p, true)} />
        </div>
        {featured.length === 0 && <p className="text-sm text-slate">Aucun produit à la une pour le moment.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {featured.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gold bg-gold/10 p-2">
              <ProductVisual product={p} className="h-12 w-10 shrink-0 rounded-md" />
              <span className="flex-1 text-sm font-medium">
                {p.name}
                {!p.is_published && <span className="ml-2 text-xs text-slate">(masqué sur le site)</span>}
              </span>
              <button type="button" onClick={() => setFeatured(p, false)} className="rounded p-1.5 text-slate hover:bg-ink/5 hover:text-ink" aria-label="Retirer de la une">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <SettingsForm
        settingKey="about"
        title="Page « À propos »"
        fields={[
          { key: 'title', label: 'Titre', wide: true },
          { key: 'text', label: 'Texte', hint: 'Laissez une ligne vide entre deux paragraphes.', multiline: 8 },
        ]}
      />
    </>
  )
}
