import { query } from './db.js'

export const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Colonnes des promotions, dates au format AAAA-MM-JJ
export const PROMO_COLUMNS = `id, name, kind, value, scope, target, is_active, created_at,
  to_char(starts_at, 'YYYY-MM-DD') AS starts_at, to_char(ends_at, 'YYYY-MM-DD') AS ends_at`

export function isPromotionRunning(p) {
  const t = localToday()
  return !!p.is_active && (!p.starts_at || p.starts_at <= t) && (!p.ends_at || p.ends_at >= t)
}

// Promotions actives aujourd'hui (dates incluses)
export async function activePromotions() {
  const rows = await query(`SELECT ${PROMO_COLUMNS} FROM promotions WHERE is_active`)
  return rows.filter(isPromotionRunning)
}

// Prix final : on applique la promotion la plus avantageuse pour le client
export function applyPromotions(product, promos) {
  let best = null
  let finalPrice = product.price
  for (const p of promos) {
    const applies =
      p.scope === 'all' ||
      (p.scope === 'category' && p.target === product.category_id) ||
      (p.scope === 'product' && Number(p.target) === product.id)
    if (!applies) continue
    const discounted =
      p.kind === 'percent' ? Math.round((product.price * (100 - p.value)) / 100) : Math.max(0, product.price - p.value)
    if (discounted < finalPrice) {
      finalPrice = discounted
      best = p
    }
  }
  return {
    final_price: finalPrice,
    promotion: best ? { id: best.id, name: best.name, kind: best.kind, value: best.value } : null,
  }
}

const asList = (v) => (Array.isArray(v) ? v : JSON.parse(v || '[]'))

export function serializeProduct(row, promos) {
  const product = {
    ...row,
    sizes: asList(row.sizes),
    colors: asList(row.colors),
    is_new: !!row.is_new,
    is_featured: !!row.is_featured,
    is_published: !!row.is_published,
    in_stock: !!row.in_stock,
  }
  return { ...product, ...applyPromotions(product, promos) }
}
