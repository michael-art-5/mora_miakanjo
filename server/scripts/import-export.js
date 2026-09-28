// Importe l'export de l'ancienne base (storage/export/mora-export.json) et les photos (storage/uploads)
// dans la base PostgreSQL configurée (DATABASE_URL, ou base intégrée en local).
// Usage : npm run db:import            (base vide uniquement)
//         npm run db:import -- --remplacer   (efface d'abord toutes les données de la base cible)
import fs from 'node:fs'
import path from 'node:path'
import { STORAGE_DIR, closeDb, dbLabel, exec, one, transaction } from '../db.js'
import { migrate } from '../migrate.js'

const EXPORT_FILE = path.join(STORAGE_DIR, 'export', 'mora-export.json')
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads')
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

if (!fs.existsSync(EXPORT_FILE)) {
  console.error(`Fichier d'export introuvable : ${EXPORT_FILE}`)
  process.exit(1)
}
const data = JSON.parse(fs.readFileSync(EXPORT_FILE, 'utf8'))
const replace = process.argv.includes('--remplacer')

console.log(`Base cible : ${await dbLabel()}`)
await migrate()

const existing = await one('SELECT (SELECT COUNT(*) FROM products) + (SELECT COUNT(*) FROM orders) AS n')
if (existing.n > 0 && !replace) {
  console.error('La base cible contient déjà des produits ou des commandes : import annulé.')
  console.error('Relancez avec « -- --remplacer » pour tout effacer et importer (irréversible).')
  process.exit(1)
}

const counts = {}
await transaction(async (tx) => {
  // Base vide (ou remplacement demandé) : on retire aussi le compte et les réglages créés au premier démarrage
  await tx.exec(`TRUNCATE order_items, orders, messages, customers, promotions, products, images, categories, settings, sessions, users
                 RESTART IDENTITY CASCADE`)

  const insertAll = async (table, rows, columns, casts = {}) => {
    for (const r of rows) {
      const cols = columns.join(', ')
      const vals = columns.map((c) => `@${c}${casts[c] ?? ''}`).join(', ')
      await tx.query(`INSERT INTO ${table} (${cols}) VALUES (${vals})`, Object.fromEntries(columns.map((c) => [c, r[c] ?? null])))
    }
    counts[table] = rows.length
  }

  await insertAll('users', data.users, ['id', 'username', 'password_hash', 'created_at'])
  await insertAll('settings', data.settings, ['key', 'value'], { value: '::jsonb' })
  await insertAll('categories', data.categories, ['id', 'label', 'blurb', 'color', 'sort'])

  // Photos : les fichiers de storage/uploads sont copiés en base, et les produits pointent vers /uploads/<id>
  let images = 0
  const products = []
  for (const p of data.products) {
    let image = p.image
    const file = image && path.join(UPLOADS_DIR, path.basename(image))
    if (file && fs.existsSync(file)) {
      const buf = fs.readFileSync(file)
      const { id } = await tx.one('INSERT INTO images (mime, size, data) VALUES (@mime, @size, @data) RETURNING id', {
        mime: MIME[path.extname(file).toLowerCase()] ?? 'image/jpeg',
        size: buf.length,
        data: buf,
      })
      image = `/uploads/${id}`
      images++
    } else if (image) {
      console.warn(`Photo introuvable pour « ${p.name} » (${image}) : produit importé sans photo.`)
      image = null
    }
    products.push({ ...p, image })
  }
  counts.images = images
  await insertAll(
    'products',
    products,
    ['id', 'slug', 'name', 'category_id', 'price', 'description', 'sizes', 'colors', 'image', 'tone', 'is_new', 'is_featured', 'is_published', 'in_stock', 'sort', 'created_at', 'updated_at'],
    { sizes: '::jsonb', colors: '::jsonb' },
  )
  await insertAll('promotions', data.promotions, ['id', 'name', 'kind', 'value', 'scope', 'target', 'starts_at', 'ends_at', 'is_active', 'created_at'], {
    starts_at: '::date',
    ends_at: '::date',
  })
  await insertAll('customers', data.customers, ['id', 'name', 'email', 'phone', 'phone_key', 'created_at', 'last_contact_at'])
  await insertAll('orders', data.orders, [
    'id', 'reference', 'customer_id', 'customer_name', 'phone', 'email', 'message', 'status', 'source', 'admin_note', 'total', 'items_count', 'created_at', 'updated_at',
  ])
  await insertAll('order_items', data.order_items, ['id', 'order_id', 'product_id', 'product_name', 'size', 'color', 'quantity', 'unit_price'])
  await insertAll('messages', data.messages, ['id', 'customer_id', 'name', 'email', 'phone', 'subject', 'body', 'status', 'created_at'])

  // Les compteurs d'identifiants repartent après les valeurs importées
  for (const t of ['users', 'images', 'products', 'promotions', 'customers', 'orders', 'order_items', 'messages'])
    await tx.exec(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false)`)
})

console.log('Import terminé :', JSON.stringify(counts))
await closeDb()
