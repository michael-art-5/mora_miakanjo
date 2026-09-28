import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import multer from 'multer'
import { SERVER_DIR, dbLabel, getSetting, one, paging, query, setSetting, transaction } from './db.js'
import { migrate } from './migrate.js'
import { seed } from './seed.js'
import { upsertCustomer } from './customers.js'
import { createSession, currentUser, destroySession, hashPassword, isHttps, rateLimit, requireAuth, verifyPassword } from './auth.js'
import { PROMO_COLUMNS, activePromotions, applyPromotions, isPromotionRunning, localToday, serializeProduct } from './pricing.js'

const PRODUCTION = process.argv.includes('--production') || process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT) || 3001
// Derrière IIS, l'API n'écoute que sur la machine elle-même (HOST=127.0.0.1)
const HOST = process.env.HOST || undefined
// Proxy de confiance : « loopback » (IIS local) par défaut, « 1 » derrière l'hébergeur (Render)
const TRUST_PROXY = process.env.TRUST_PROXY ? (/^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY) : 'loopback'

const app = express()
app.set('trust proxy', TRUST_PROXY)
app.disable('x-powered-by')
app.use(express.json({ limit: '200kb' }))

// ---------- Validation ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const str = (v, max = 500, required = false, label = 'Champ') => {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim()
  if (required && !s) throw new HttpError(400, `${label} obligatoire`)
  return s.slice(0, max)
}
const int = (v, min = 0, max = 1e12, label = 'Nombre') => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${label} invalide`)
  return Math.round(n)
}
const ID_MAX = Number.MAX_SAFE_INTEGER
const bool = (v) => !!v
const list = (v) => (Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, 30) : [])
const date = (v) => {
  const s = str(v, 10)
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'Date invalide')
  return s || null
}
const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70) || 'produit'
const like = (q) => q.replace(/[\\%_]/g, '\\$&') // échappe les jokers de LIKE / ILIKE

async function uniqueSlug(name, exceptId = 0) {
  const base = slugify(name)
  let slug = base
  for (let i = 2; await one('SELECT 1 AS x FROM products WHERE slug = @slug AND id <> @id', { slug, id: exceptId }); i++) slug = `${base}-${i}`
  return slug
}

const page = (rows, total, p) => ({ rows, total, page: p.page, size: p.size })

const ORDER_STATUSES = ['nouvelle', 'confirmee', 'prete', 'terminee', 'annulee']
const MESSAGE_STATUSES = ['nouveau', 'lu', 'traite', 'archive']

const newReference = () => {
  const d = new Date()
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `MM-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

async function loadOrder(id) {
  const order = await one('SELECT * FROM orders WHERE id = @id', { id: int(id, 1, ID_MAX, 'Commande') })
  if (!order) throw new HttpError(404, 'Commande introuvable')
  order.items = await query('SELECT * FROM order_items WHERE order_id = @id ORDER BY id', { id: order.id })
  return order
}

// Crée une commande ; les prix sont toujours recalculés côté serveur
async function createOrder({ customer_name, phone, email, message, items, source, status = 'nouvelle', admin_note = '' }) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'La commande ne contient aucun article')
  if (!phone && !email) throw new HttpError(400, 'Indiquez un téléphone ou un e-mail')
  const wanted = items.slice(0, 50).map((it) => ({ ...it, product_id: int(it.product_id, 1, ID_MAX, 'Produit') }))
  const ids = [...new Set(wanted.map((w) => w.product_id))]
  const rows = await query('SELECT * FROM products WHERE id = ANY(@ids::bigint[])', { ids })
  const products = new Map(rows.map((p) => [p.id, p]))
  const promos = await activePromotions()
  const lines = wanted.map((it) => {
    const row = products.get(it.product_id)
    if (!row) throw new HttpError(400, 'Produit introuvable')
    if (source === 'site' && (!row.is_published || !row.in_stock)) throw new HttpError(400, `« ${row.name} » n'est plus disponible`)
    const { final_price } = applyPromotions(serializeProduct(row, []), promos)
    const unit = it.unit_price != null && source !== 'site' ? int(it.unit_price, 0, 1e12, 'Prix') : final_price
    return { product: row, size: str(it.size, 20), color: str(it.color, 40), quantity: int(it.quantity ?? 1, 1, 99, 'Quantité'), unit }
  })
  const total = lines.reduce((s, l) => s + l.unit * l.quantity, 0)
  const itemsCount = lines.reduce((s, l) => s + l.quantity, 0)

  const id = await transaction(async (tx) => {
    const customerId = await upsertCustomer(tx, { name: customer_name, email, phone })
    const { id } = await tx.one(
      `INSERT INTO orders (reference, customer_id, customer_name, phone, email, message, status, source, admin_note, total, items_count)
       VALUES (@reference, @customerId, @customer_name, @phone, @email, @message, @status, @source, @admin_note, @total, @itemsCount)
       RETURNING id`,
      { reference: newReference(), customerId, customer_name, phone, email, message, status, source, admin_note, total, itemsCount },
    )
    for (const l of lines)
      await tx.query(
        `INSERT INTO order_items (order_id, product_id, product_name, size, color, quantity, unit_price)
         VALUES (@id, @productId, @name, @size, @color, @quantity, @unit)`,
        { id, productId: l.product.id, name: l.product.name, size: l.size, color: l.color, quantity: l.quantity, unit: l.unit },
      )
    return id
  })
  return loadOrder(id)
}

// =====================================================================
// Photos (stockées en base)
// =====================================================================
app.get('/uploads/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10) // accepte aussi « 12.jpg »
  if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end()
  const img = await one('SELECT mime, data FROM images WHERE id = @id', { id })
  if (!img) return res.status(404).end()
  res.set('Content-Type', img.mime)
  res.set('Cache-Control', 'public, max-age=31536000, immutable') // une photo ne change jamais : nouvelle photo = nouvel identifiant
  res.send(Buffer.from(img.data))
})

// =====================================================================
// API publique (site vitrine)
// =====================================================================
const pub = express.Router()

pub.get('/site', async (req, res) => {
  const promos = await activePromotions()
  const [shop, home, about, categories, featured, fresh] = await Promise.all([
    getSetting('shop'),
    getSetting('home'),
    getSetting('about'),
    query('SELECT * FROM categories ORDER BY sort, label'),
    query('SELECT * FROM products WHERE is_featured AND is_published ORDER BY sort, id DESC LIMIT 8'),
    query('SELECT * FROM products WHERE is_new AND is_published AND NOT is_featured ORDER BY sort, id DESC LIMIT 8'),
  ])
  res.json({
    shop,
    home,
    about,
    categories,
    featured: featured.map((r) => serializeProduct(r, promos)),
    new_arrivals: fresh.map((r) => serializeProduct(r, promos)),
  })
})

// Catalogue public : produits en ligne avec leur prix effectif (meilleure promotion active du jour).
// Même règle que applyPromotions() côté JavaScript, pour pouvoir filtrer et trier sur le prix affiché.
const CATALOG_CTE = `WITH catalog AS (
  SELECT p.*,
         (CASE WHEN d.best IS NOT NULL AND d.best < p.price THEN d.best ELSE p.price END)::bigint AS eff_price,
         (d.best IS NOT NULL AND d.best < p.price) AS on_sale
  FROM products p
  LEFT JOIN LATERAL (
    SELECT MIN(CASE pr.kind
                 WHEN 'percent' THEN ROUND(p.price * (100 - pr.value) / 100.0)
                 ELSE GREATEST(p.price - pr.value, 0)
               END) AS best
    FROM promotions pr
    WHERE pr.is_active
      AND (pr.starts_at IS NULL OR pr.starts_at <= @today::date)
      AND (pr.ends_at IS NULL OR pr.ends_at >= @today::date)
      AND (pr.scope = 'all'
           OR (pr.scope = 'category' AND pr.target = p.category_id)
           OR (pr.scope = 'product' AND pr.target = p.id::text))
  ) d ON true
  WHERE p.is_published
)`

const SORTS = {
  pertinence: 'sort, id DESC',
  recents: 'created_at DESC, id DESC',
  prix_asc: 'eff_price ASC, id DESC',
  prix_desc: 'eff_price DESC, id DESC',
  nom: 'name ASC, id DESC',
}

// Catalogue paginé avec recherche multicritère :
// q (mots, dans le nom, la description, les coloris ou la catégorie), category, prix_min, prix_max (prix effectif),
// taille, coloris, promo=1, nouveau=1, dispo=1, tri
pub.get('/products', async (req, res) => {
  const p = paging(req, 24, 60)
  const words = str(req.query.q, 100).split(/\s+/).filter(Boolean).slice(0, 5)
  const optInt = (v, label) => (v === undefined || v === '' ? null : int(v, 0, 1e12, label))
  const params = {
    today: localToday(),
    category: str(req.query.category, 60) || null,
    min: optInt(req.query.prix_min, 'Prix minimum'),
    max: optInt(req.query.prix_max, 'Prix maximum'),
    taille: str(req.query.taille, 20) || null,
    coloris: str(req.query.coloris, 40) || null,
    promo: req.query.promo === '1',
    nouveau: req.query.nouveau === '1',
    dispo: req.query.dispo === '1',
  }
  // Chaque mot doit apparaître dans le nom, la description, les coloris ou le nom de la catégorie
  const wordClauses = words.map((w, i) => {
    params[`w${i}`] = `%${like(w)}%`
    return `AND (c.name ILIKE @w${i} OR c.description ILIKE @w${i} OR c.colors::text ILIKE @w${i}
                 OR EXISTS (SELECT 1 FROM categories k WHERE k.id = c.category_id AND k.label ILIKE @w${i}))`
  })
  const where = `WHERE (@category::text IS NULL OR c.category_id = @category::text)
    AND (@min::bigint IS NULL OR c.eff_price >= @min::bigint)
    AND (@max::bigint IS NULL OR c.eff_price <= @max::bigint)
    AND (@taille::text IS NULL OR c.sizes @> jsonb_build_array(@taille::text))
    AND (@coloris::text IS NULL OR c.colors @> jsonb_build_array(@coloris::text))
    AND (NOT @promo::boolean OR c.on_sale)
    AND (NOT @nouveau::boolean OR c.is_new)
    AND (NOT @dispo::boolean OR c.in_stock)
    ${wordClauses.join('\n')}`
  const orderBy = SORTS[req.query.tri] ?? SORTS.pertinence

  const [rows, count, promos] = await Promise.all([
    query(`${CATALOG_CTE} SELECT c.* FROM catalog c ${where} ORDER BY ${orderBy} LIMIT @size OFFSET @offset`, {
      ...params,
      offset: p.offset,
      size: p.size,
    }),
    one(`${CATALOG_CTE} SELECT COUNT(*)::int AS n FROM catalog c ${where}`, params),
    activePromotions(),
  ])
  res.json(page(rows.map(({ eff_price, on_sale, ...r }) => serializeProduct(r, promos)), count.n, p))
})

// Valeurs proposées dans les filtres : tailles, coloris et fourchette de prix du catalogue en ligne
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
pub.get('/filters', async (req, res) => {
  const [sizes, colors, range] = await Promise.all([
    query('SELECT DISTINCT jsonb_array_elements_text(sizes) AS v FROM products WHERE is_published'),
    query('SELECT DISTINCT jsonb_array_elements_text(colors) AS v FROM products WHERE is_published'),
    one(`${CATALOG_CTE} SELECT MIN(eff_price) AS min, MAX(eff_price) AS max FROM catalog`, { today: localToday() }),
  ])
  const rank = (s) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase())
    if (i >= 0) return [0, i]
    if (/^\d+$/.test(s)) return [1, Number(s)]
    return [2, 0]
  }
  res.json({
    sizes: sizes
      .map((r) => r.v)
      .sort((a, b) => {
        const [ga, va] = rank(a)
        const [gb, vb] = rank(b)
        return ga - gb || va - vb || a.localeCompare(b, 'fr')
      }),
    colors: colors.map((r) => r.v).sort((a, b) => a.localeCompare(b, 'fr')),
    price_min: range?.min ?? 0,
    price_max: range?.max ?? 0,
  })
})

pub.get('/products/:slug', async (req, res) => {
  const row = await one('SELECT * FROM products WHERE slug = @slug AND is_published', { slug: str(req.params.slug, 80) })
  if (!row) throw new HttpError(404, 'Produit introuvable')
  const promos = await activePromotions()
  const related = row.category_id
    ? await query('SELECT * FROM products WHERE category_id = @category AND is_published AND id <> @id ORDER BY sort, id DESC LIMIT 4', {
        category: row.category_id,
        id: row.id,
      })
    : []
  res.json({ product: serializeProduct(row, promos), related: related.map((r) => serializeProduct(r, promos)) })
})

const publicLimit = rateLimit({ max: 8, windowMs: 10 * 60_000 })

pub.post('/orders', publicLimit, async (req, res) => {
  const b = req.body || {}
  if (b.website) return res.status(201).json({ reference: 'OK' }) // pot de miel anti-robots
  const order = await createOrder({
    customer_name: str(b.customer_name, 120, true, 'Nom'),
    phone: str(b.phone, 40),
    email: str(b.email, 160),
    message: str(b.message, 2000),
    items: b.items,
    source: 'site',
  })
  res.status(201).json({ reference: order.reference, total: order.total })
})

pub.post('/messages', publicLimit, async (req, res) => {
  const b = req.body || {}
  if (b.website) return res.status(201).json({ ok: true })
  const name = str(b.name, 120, true, 'Nom')
  const email = str(b.email, 160)
  const phone = str(b.phone, 40)
  if (!email && !phone) throw new HttpError(400, 'Indiquez un e-mail ou un téléphone pour que nous puissions vous répondre')
  const subject = str(b.subject, 200)
  const body = str(b.message, 4000, true, 'Message')
  await transaction(async (tx) => {
    const customerId = await upsertCustomer(tx, { name, email, phone })
    await tx.query('INSERT INTO messages (customer_id, name, email, phone, subject, body) VALUES (@customerId, @name, @email, @phone, @subject, @body)', {
      customerId,
      name,
      email,
      phone,
      subject,
      body,
    })
  })
  res.status(201).json({ ok: true })
})

app.use('/api/public', pub)

// Contrôle de santé (utilisé par l'hébergeur)
app.get('/api/health', async (req, res) => {
  await one('SELECT 1 AS ok')
  res.json({ ok: true })
})

// =====================================================================
// API d'administration
// =====================================================================
const adm = express.Router()

adm.post('/login', rateLimit({ max: 10, windowMs: 15 * 60_000 }), async (req, res) => {
  const username = str(req.body?.username, 60)
  const password = String(req.body?.password || '')
  const user = await one('SELECT * FROM users WHERE username = @username', { username })
  if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Identifiant ou mot de passe incorrect')
  await query('DELETE FROM sessions WHERE expires_at < now()')
  await createSession(res, user.id, isHttps(req))
  res.json({ id: user.id, username: user.username })
})

adm.post('/logout', async (req, res) => {
  await destroySession(req, res)
  res.json({ ok: true })
})

adm.get('/me', async (req, res) => {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ error: 'Non connecté' })
  res.json(user)
})

adm.use(requireAuth)

adm.post('/password', async (req, res) => {
  const current = String(req.body?.current || '')
  const next = String(req.body?.next || '')
  const user = await one('SELECT * FROM users WHERE id = @id', { id: req.user.id })
  if (!verifyPassword(current, user.password_hash)) throw new HttpError(400, 'Mot de passe actuel incorrect')
  if (next.length < 10) throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 10 caractères')
  await query('UPDATE users SET password_hash = @hash WHERE id = @id', { hash: hashPassword(next), id: user.id })
  res.json({ ok: true })
})

// ---------- Tableau de bord ----------
adm.get('/dashboard', async (req, res) => {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [stats, promos, recentOrders, recentMessages] = await Promise.all([
    one(
      `SELECT
         (SELECT COUNT(*)::int FROM orders WHERE status = 'nouvelle') AS orders_new,
         (SELECT COUNT(*)::int FROM orders WHERE status IN ('confirmee', 'prete')) AS orders_in_progress,
         (SELECT COUNT(*)::int FROM messages WHERE status = 'nouveau') AS messages_new,
         (SELECT COUNT(*)::int FROM products WHERE is_published) AS products_published,
         (SELECT COUNT(*)::int FROM products) AS products_total,
         (SELECT COALESCE(SUM(total), 0)::bigint FROM orders
            WHERE created_at >= @monthStart::timestamptz AND status IN ('confirmee', 'prete', 'terminee')) AS revenue_month`,
      { monthStart },
    ),
    query(`SELECT ${PROMO_COLUMNS} FROM promotions WHERE is_active`),
    query('SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 6'),
    query('SELECT * FROM messages ORDER BY created_at DESC, id DESC LIMIT 5'),
  ])
  res.json({ ...stats, promotions_running: promos.filter(isPromotionRunning).length, recent_orders: recentOrders, recent_messages: recentMessages })
})

adm.get('/counts', async (req, res) => {
  res.json(
    await one(`SELECT (SELECT COUNT(*)::int FROM orders WHERE status = 'nouvelle') AS orders,
                      (SELECT COUNT(*)::int FROM messages WHERE status = 'nouveau') AS messages`),
  )
})

// ---------- Commandes ----------
adm.get('/orders', async (req, res) => {
  const p = paging(req)
  const status = ORDER_STATUSES.includes(req.query.status) ? req.query.status : null
  const q = str(req.query.q, 100) || null
  const customer = req.query.customer ? int(req.query.customer, 1, ID_MAX, 'Client') : null
  const params = { status, customer, qPrefix: q ? `${like(q)}%` : null, qAny: q ? `%${like(q)}%` : null }
  const where = `(@status::text IS NULL OR status = @status::text)
    AND (@customer::bigint IS NULL OR customer_id = @customer::bigint)
    AND (@qPrefix::text IS NULL OR reference ILIKE @qPrefix::text OR phone ILIKE @qPrefix::text
         OR email ILIKE @qPrefix::text OR customer_name ILIKE @qAny::text)`
  const [rows, count] = await Promise.all([
    query(`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT @size OFFSET @offset`, { ...params, offset: p.offset, size: p.size }),
    one(`SELECT COUNT(*)::int AS n FROM orders WHERE ${where}`, params),
  ])
  res.json(page(rows, count.n, p))
})

adm.get('/orders/:id', async (req, res) => res.json(await loadOrder(req.params.id)))

adm.post('/orders', async (req, res) => {
  const b = req.body || {}
  const order = await createOrder({
    customer_name: str(b.customer_name, 120, true, 'Nom'),
    phone: str(b.phone, 40),
    email: str(b.email, 160),
    message: str(b.message, 2000),
    admin_note: str(b.admin_note, 2000),
    items: b.items,
    source: ['boutique', 'telephone', 'whatsapp', 'reseaux'].includes(b.source) ? b.source : 'boutique',
    status: ORDER_STATUSES.includes(b.status) ? b.status : 'confirmee',
  })
  res.status(201).json(order)
})

adm.patch('/orders/:id', async (req, res) => {
  const order = await loadOrder(req.params.id)
  const b = req.body || {}
  const status = b.status !== undefined ? b.status : order.status
  if (!ORDER_STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide')
  await query('UPDATE orders SET status = @status, admin_note = @note, updated_at = now() WHERE id = @id', {
    status,
    note: b.admin_note !== undefined ? str(b.admin_note, 2000) : order.admin_note,
    id: order.id,
  })
  res.json(await loadOrder(order.id))
})

adm.delete('/orders/:id', async (req, res) => {
  await query('DELETE FROM orders WHERE id = @id', { id: int(req.params.id, 1, ID_MAX) })
  res.json({ ok: true })
})

// ---------- Messages ----------
adm.get('/messages', async (req, res) => {
  const p = paging(req)
  const status = MESSAGE_STATUSES.includes(req.query.status) ? req.query.status : null
  // Sans filtre : boîte de réception (tout sauf les archivés)
  const where = `(@status::text IS NULL AND status <> 'archive') OR status = @status::text`
  const [rows, count] = await Promise.all([
    query(`SELECT * FROM messages WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT @size OFFSET @offset`, { status, offset: p.offset, size: p.size }),
    one(`SELECT COUNT(*)::int AS n FROM messages WHERE ${where}`, { status }),
  ])
  res.json(page(rows, count.n, p))
})

adm.patch('/messages/:id', async (req, res) => {
  const status = req.body?.status
  if (!MESSAGE_STATUSES.includes(status)) throw new HttpError(400, 'Statut invalide')
  const id = int(req.params.id, 1, ID_MAX)
  res.json(await one('UPDATE messages SET status = @status WHERE id = @id RETURNING *', { status, id }))
})

adm.delete('/messages/:id', async (req, res) => {
  await query('DELETE FROM messages WHERE id = @id', { id: int(req.params.id, 1, ID_MAX) })
  res.json({ ok: true })
})

// ---------- Clients ----------
adm.get('/clients', async (req, res) => {
  const p = paging(req)
  const q = str(req.query.q, 100) || null
  const params = { qPrefix: q ? `${like(q)}%` : null, qAny: q ? `%${like(q)}%` : null }
  const where = '@qPrefix::text IS NULL OR c.name ILIKE @qAny::text OR c.email ILIKE @qPrefix::text OR c.phone ILIKE @qPrefix::text'
  const [rows, count] = await Promise.all([
    query(
      `SELECT c.id, c.name, c.email, c.phone, c.created_at, c.last_contact_at AS last_contact,
              o.orders, o.spent, m.messages
       FROM customers c
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS orders,
                                 COALESCE(SUM(CASE WHEN status <> 'annulee' THEN total ELSE 0 END), 0)::bigint AS spent
                          FROM orders WHERE customer_id = c.id) o ON true
       LEFT JOIN LATERAL (SELECT COUNT(*)::int AS messages FROM messages WHERE customer_id = c.id) m ON true
       WHERE ${where}
       ORDER BY c.last_contact_at DESC, c.id DESC LIMIT @size OFFSET @offset`,
      { ...params, offset: p.offset, size: p.size },
    ),
    one(`SELECT COUNT(*)::int AS n FROM customers c WHERE ${where}`, params),
  ])
  res.json(page(rows, count.n, p))
})

// ---------- Produits ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(400, 'Format accepté : JPG, PNG ou WebP')),
})

adm.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucune image reçue')
  const { id } = await one('INSERT INTO images (mime, size, data) VALUES (@mime, @size, @data) RETURNING id', {
    mime: req.file.mimetype,
    size: req.file.size,
    data: req.file.buffer,
  })
  res.status(201).json({ url: `/uploads/${id}` })
})

async function productFields(b) {
  const category = str(b.category_id, 60)
  if (category && !(await one('SELECT 1 AS x FROM categories WHERE id = @category', { category }))) throw new HttpError(400, 'Catégorie inconnue')
  const image = str(b.image, 300)
  if (image && !/^\/uploads\/\d+$/.test(image)) throw new HttpError(400, 'Image invalide')
  return {
    name: str(b.name, 120, true, 'Nom'),
    category_id: category || null,
    price: int(b.price, 0, 1e12, 'Prix'),
    description: str(b.description, 4000),
    sizes: JSON.stringify(list(b.sizes)),
    colors: JSON.stringify(list(b.colors)),
    image: image || null,
    tone: /^#[0-9a-f]{6}$/i.test(b.tone) ? b.tone : '#c49a5c',
    is_new: bool(b.is_new),
    is_featured: bool(b.is_featured),
    is_published: bool(b.is_published),
    in_stock: bool(b.in_stock),
    sort: int(b.sort ?? 0, -1e6, 1e6, 'Ordre'),
  }
}

async function loadProduct(id) {
  const row = await one('SELECT * FROM products WHERE id = @id', { id: int(id, 1, ID_MAX, 'Produit') })
  if (!row) throw new HttpError(404, 'Produit introuvable')
  return serializeProduct(row, await activePromotions())
}

adm.get('/products', async (req, res) => {
  const p = paging(req)
  const q = str(req.query.q, 100) || null
  const category = str(req.query.category, 60) || null
  const featured = req.query.featured === '1' ? true : null
  const params = { q: q ? `%${like(q)}%` : null, category, featured }
  const where = `(@q::text IS NULL OR name ILIKE @q::text) AND (@category::text IS NULL OR category_id = @category::text)
    AND (@featured::boolean IS NULL OR is_featured = @featured::boolean)`
  const [rows, count, promos] = await Promise.all([
    query(`SELECT * FROM products WHERE ${where} ORDER BY sort, id DESC LIMIT @size OFFSET @offset`, { ...params, offset: p.offset, size: p.size }),
    one(`SELECT COUNT(*)::int AS n FROM products WHERE ${where}`, params),
    activePromotions(),
  ])
  res.json(page(rows.map((r) => serializeProduct(r, promos)), count.n, p))
})

// Recherche rapide pour les sélecteurs (commande manuelle, promotions, à la une)
adm.get('/products/lookup', async (req, res) => {
  const q = str(req.query.q, 100)
  const rows = await query(
    `SELECT * FROM products
     WHERE (@q::text = '' OR name ILIKE @any::text) AND (NOT @onlyPublished::boolean OR is_published)
     ORDER BY CASE WHEN name ILIKE @prefix::text THEN 0 ELSE 1 END, name
     LIMIT 20`,
    { q, any: `%${like(q)}%`, prefix: `${like(q)}%`, onlyPublished: req.query.published === '1' },
  )
  const promos = await activePromotions()
  res.json(rows.map((r) => serializeProduct(r, promos)))
})

adm.get('/products/:id', async (req, res) => res.json(await loadProduct(req.params.id)))

adm.post('/products', async (req, res) => {
  const f = await productFields(req.body || {})
  const { id } = await one(
    `INSERT INTO products (slug, name, category_id, price, description, sizes, colors, image, tone, is_new, is_featured, is_published, in_stock, sort)
     VALUES (@slug, @name, @category_id, @price, @description, @sizes::jsonb, @colors::jsonb, @image, @tone, @is_new, @is_featured, @is_published, @in_stock, @sort)
     RETURNING id`,
    { ...f, slug: await uniqueSlug(f.name) },
  )
  res.status(201).json(await loadProduct(id))
})

adm.put('/products/:id', async (req, res) => {
  const existing = await loadProduct(req.params.id)
  const f = await productFields(req.body || {})
  const slug = f.name !== existing.name ? await uniqueSlug(f.name, existing.id) : existing.slug
  await query(
    `UPDATE products SET slug = @slug, name = @name, category_id = @category_id, price = @price, description = @description,
       sizes = @sizes::jsonb, colors = @colors::jsonb, image = @image, tone = @tone, is_new = @is_new, is_featured = @is_featured,
       is_published = @is_published, in_stock = @in_stock, sort = @sort, updated_at = now()
     WHERE id = @id`,
    { ...f, slug, id: existing.id },
  )
  res.json(await loadProduct(existing.id))
})

// Modification rapide d'un interrupteur (publié, à la une, nouveau, en stock)
adm.patch('/products/:id', async (req, res) => {
  const allowed = ['is_new', 'is_featured', 'is_published', 'in_stock']
  const [key] = Object.keys(req.body || {}).filter((k) => allowed.includes(k))
  if (!key) throw new HttpError(400, 'Aucune modification')
  const id = int(req.params.id, 1, ID_MAX)
  await query(`UPDATE products SET ${key} = @value, updated_at = now() WHERE id = @id`, { value: bool(req.body[key]), id })
  res.json(await loadProduct(id))
})

adm.delete('/products/:id', async (req, res) => {
  await query('DELETE FROM products WHERE id = @id', { id: int(req.params.id, 1, ID_MAX) })
  res.json({ ok: true })
})

// ---------- Catégories ----------
adm.get('/categories', async (req, res) => {
  res.json(
    await query(
      `SELECT c.*, COALESCE(n.products_count, 0)::int AS products_count
       FROM categories c
       LEFT JOIN (SELECT category_id, COUNT(*) AS products_count FROM products GROUP BY category_id) n ON n.category_id = c.id
       ORDER BY c.sort, c.label`,
    ),
  )
})

const categoryFields = (b) => ({
  label: str(b.label, 60, true, 'Nom'),
  blurb: str(b.blurb, 200),
  color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#1b2438',
  sort: int(b.sort ?? 0, -1e6, 1e6, 'Ordre'),
})

adm.post('/categories', async (req, res) => {
  const f = categoryFields(req.body || {})
  let id = slugify(f.label)
  for (let i = 2; await one('SELECT 1 AS x FROM categories WHERE id = @id', { id }); i++) id = `${slugify(f.label)}-${i}`
  res.status(201).json(await one('INSERT INTO categories (id, label, blurb, color, sort) VALUES (@id, @label, @blurb, @color, @sort) RETURNING *', { id, ...f }))
})

adm.put('/categories/:id', async (req, res) => {
  const f = categoryFields(req.body || {})
  const updated = await one('UPDATE categories SET label = @label, blurb = @blurb, color = @color, sort = @sort WHERE id = @id RETURNING *', {
    id: str(req.params.id, 60),
    ...f,
  })
  if (!updated) throw new HttpError(404, 'Catégorie introuvable')
  res.json(updated)
})

adm.delete('/categories/:id', async (req, res) => {
  await query('DELETE FROM categories WHERE id = @id', { id: str(req.params.id, 60) })
  res.json({ ok: true })
})

// ---------- Promotions ----------
function promotionFields(b) {
  const kind = b.kind === 'fixed' ? 'fixed' : 'percent'
  const scope = ['all', 'category', 'product'].includes(b.scope) ? b.scope : 'all'
  const f = {
    name: str(b.name, 120, true, 'Nom'),
    kind,
    value: int(b.value, 1, kind === 'percent' ? 90 : 1e12, kind === 'percent' ? 'Pourcentage (1 à 90)' : 'Montant'),
    scope,
    target: scope === 'all' ? null : str(b.target, 60, true, 'Cible'),
    starts_at: date(b.starts_at),
    ends_at: date(b.ends_at),
    is_active: bool(b.is_active),
  }
  if (f.starts_at && f.ends_at && f.ends_at < f.starts_at) throw new HttpError(400, 'La date de fin précède la date de début')
  return f
}

const loadPromotion = (id) => one(`SELECT ${PROMO_COLUMNS} FROM promotions WHERE id = @id`, { id })

adm.get('/promotions', async (req, res) => {
  // target_label : nom lisible du produit ou de la catégorie ciblée
  const rows = await query(
    `SELECT ${PROMO_COLUMNS},
       CASE scope
         WHEN 'product'  THEN (SELECT name FROM products WHERE id::text = promotions.target)
         WHEN 'category' THEN (SELECT label FROM categories WHERE id = promotions.target)
       END AS target_label
     FROM promotions ORDER BY is_active DESC, id DESC`,
  )
  res.json(rows.map((p) => ({ ...p, running: isPromotionRunning(p) })))
})

adm.post('/promotions', async (req, res) => {
  const f = promotionFields(req.body || {})
  const { id } = await one(
    `INSERT INTO promotions (name, kind, value, scope, target, starts_at, ends_at, is_active)
     VALUES (@name, @kind, @value, @scope, @target, @starts_at::date, @ends_at::date, @is_active) RETURNING id`,
    f,
  )
  res.status(201).json(await loadPromotion(id))
})

adm.put('/promotions/:id', async (req, res) => {
  const f = promotionFields(req.body || {})
  const id = int(req.params.id, 1, ID_MAX)
  await query(
    `UPDATE promotions SET name = @name, kind = @kind, value = @value, scope = @scope, target = @target,
       starts_at = @starts_at::date, ends_at = @ends_at::date, is_active = @is_active WHERE id = @id`,
    { ...f, id },
  )
  res.json(await loadPromotion(id))
})

adm.delete('/promotions/:id', async (req, res) => {
  await query('DELETE FROM promotions WHERE id = @id', { id: int(req.params.id, 1, ID_MAX) })
  res.json({ ok: true })
})

// ---------- Contenus : boutique, accueil, à propos ----------
const SETTINGS_SHAPE = {
  shop: { name: 120, tagline: 200, currency: 10, email: 160, phone: 40, whatsapp: 20, address: 300, hours: 200, instagram: 200, facebook: 200 },
  home: { announcement: 200, hero_eyebrow: 80, hero_title: 120, hero_highlight: 120, hero_text: 400, hero_cta: 60, featured_title: 80, new_title: 80 },
  about: { title: 120, text: 6000 },
}

adm.get('/settings/:key', async (req, res) => {
  if (!SETTINGS_SHAPE[req.params.key]) throw new HttpError(404, 'Réglage inconnu')
  res.json((await getSetting(req.params.key)) || {})
})

adm.put('/settings/:key', async (req, res) => {
  const shape = SETTINGS_SHAPE[req.params.key]
  if (!shape) throw new HttpError(404, 'Réglage inconnu')
  const value = {}
  for (const [k, max] of Object.entries(shape)) value[k] = str(req.body?.[k], max)
  if (req.params.key === 'shop') {
    if (!value.name) throw new HttpError(400, 'Nom de la boutique obligatoire')
    value.whatsapp = value.whatsapp.replace(/\D/g, '')
  }
  await setSetting(req.params.key, value)
  res.json(value)
})

app.use('/api/admin', adm)

app.use('/api', (req, res) => res.status(404).json({ error: 'Route inconnue' }))

// ---------- Site compilé (production) ----------
if (PRODUCTION) {
  const dist = path.join(SERVER_DIR, '..', 'dist')
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, file) => {
        // Fichiers versionnés (assets/xxx-hash.js) : cache long ; le reste : revalidation
        res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    }),
  )
  app.get(/.*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// ---------- Erreurs ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (5 Mo maximum)' : 'Envoi du fichier impossible' })
  }
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message })
  // Erreurs PostgreSQL courantes
  if (err.code === '23505') return res.status(409).json({ error: 'Cet élément existe déjà' })
  if (err.code === '23503') return res.status(400).json({ error: 'Opération impossible : élément lié à d’autres données' })
  console.error(err)
  res.status(500).json({ error: 'Erreur interne du serveur' })
})

// ---------- Démarrage ----------
try {
  await migrate()
  await seed()
  const label = await dbLabel()
  app.listen(PORT, HOST, () => console.log(`API MORA MIAKANJO prête sur http://${HOST ?? 'localhost'}:${PORT} — ${label}${PRODUCTION ? ' (production)' : ''}`))
} catch (e) {
  console.error(`Impossible de démarrer : ${e.message}`)
  console.error('Vérifiez DATABASE_URL (server/.env ou variables de l’hébergeur).')
  process.exit(1)
}
