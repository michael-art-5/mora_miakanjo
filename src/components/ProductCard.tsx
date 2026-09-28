import { Link } from 'react-router'
import type { Product } from '../lib/types'
import { discountLabel } from '../lib/format'
import { useSiteData } from '../site/SiteData'
import ProductVisual from './ProductVisual'
import Price from './Price'

export default function ProductCard({ product }: { product: Product }) {
  const { shop } = useSiteData()
  return (
    <Link to={`/produit/${product.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-lg">
        <ProductVisual
          product={product}
          className={`aspect-[3/4] w-full transition-transform duration-500 group-hover:scale-105 ${product.in_stock ? '' : 'opacity-60'}`}
        />
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {product.promotion && (
            <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
              {discountLabel(product.promotion, shop.currency)}
            </span>
          )}
          {product.is_new && <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium">Nouveau</span>}
          {!product.in_stock && <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-cream">Épuisé</span>}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium group-hover:text-earth">{product.name}</h3>
        <span className="shrink-0 text-right">
          <Price product={product} currency={shop.currency} />
        </span>
      </div>
    </Link>
  )
}
