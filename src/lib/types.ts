export type Shop = {
  name: string
  tagline: string
  currency: string
  email: string
  phone: string
  whatsapp: string
  address: string
  hours: string
  instagram: string
  facebook: string
}

export type Home = {
  announcement: string
  hero_eyebrow: string
  hero_title: string
  hero_highlight: string
  hero_text: string
  hero_cta: string
  featured_title: string
  new_title: string
}

export type About = { title: string; text: string }

export type Category = {
  id: string
  label: string
  blurb: string
  color: string
  sort: number
  products_count?: number
}

export type Product = {
  id: number
  slug: string
  name: string
  category_id: string | null
  price: number
  final_price: number
  promotion: { id: number; name: string; kind: 'percent' | 'fixed'; value: number } | null
  description: string
  sizes: string[]
  colors: string[]
  image: string | null
  tone: string
  is_new: boolean
  is_featured: boolean
  is_published: boolean
  in_stock: boolean
  sort: number
  created_at: string
  updated_at: string
}

export type SiteData = {
  shop: Shop
  home: Home
  about: About
  categories: Category[]
  featured: Product[]
  new_arrivals: Product[]
}

// Réponse paginée de l'API
export type Paged<T> = { rows: T[]; total: number; page: number; size: number }

export type OrderStatus = 'nouvelle' | 'confirmee' | 'prete' | 'terminee' | 'annulee'

export type OrderItem = {
  id: number
  product_id: number | null
  product_name: string
  size: string
  color: string
  quantity: number
  unit_price: number
}

export type Order = {
  id: number
  reference: string
  customer_name: string
  phone: string
  email: string
  message: string
  status: OrderStatus
  source: string
  admin_note: string
  total: number
  created_at: string
  updated_at: string
  items?: OrderItem[]
  items_count?: number
}

export type MessageStatus = 'nouveau' | 'lu' | 'traite' | 'archive'

export type Message = {
  id: number
  name: string
  email: string
  phone: string
  subject: string
  body: string
  status: MessageStatus
  created_at: string
}

export type Client = {
  id: number
  name: string
  phone: string
  email: string
  orders: number
  spent: number
  messages: number
  last_contact: string
}

export type Promotion = {
  id: number
  name: string
  kind: 'percent' | 'fixed'
  value: number
  scope: 'all' | 'category' | 'product'
  target: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: number | boolean
  running?: boolean
  target_label?: string | null
}

export type Dashboard = {
  orders_new: number
  orders_in_progress: number
  messages_new: number
  products_published: number
  products_total: number
  promotions_running: number
  revenue_month: number
  recent_orders: Order[]
  recent_messages: Message[]
}
