import type { Product } from '../lib/types'
import { formatPrice } from '../lib/format'

// Prix affiché, avec l'ancien prix barré en cas de promotion
export default function Price({ product, currency, large = false }: { product: Product; currency: string; large?: boolean }) {
  const discounted = product.final_price < product.price
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${large ? 'text-xl' : 'text-sm'}`}>
      <span className={discounted ? 'font-semibold text-earth' : ''}>{formatPrice(product.final_price, currency)}</span>
      {discounted && <s className={`text-ink/50 ${large ? 'text-base' : 'text-xs'}`}>{formatPrice(product.price, currency)}</s>}
    </span>
  )
}
