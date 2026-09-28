import { Shirt } from 'lucide-react'
import type { Product } from '../lib/types'

// Affiche la photo du produit, ou un visuel coloré tant qu'aucune photo n'est fournie.
export default function ProductVisual({
  product,
  className = '',
}: {
  product: Pick<Product, 'name' | 'image' | 'tone'>
  className?: string
}) {
  if (product.image) {
    return <img src={product.image} alt={product.name} className={`object-cover ${className}`} />
  }
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(145deg, ${product.tone}, ${product.tone}cc)` }}
      role="img"
      aria-label={product.name}
    >
      <Shirt className="text-white/40" size={56} strokeWidth={1.2} />
    </div>
  )
}
