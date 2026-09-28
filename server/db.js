// Accès à la base PostgreSQL.
// - DATABASE_URL défini (Neon, Render…) : connexion PostgreSQL classique (pool « pg »).
// - Sinon : PostgreSQL intégré (PGlite) stocké dans storage/pgdata, pour développer sans rien installer.
// Les requêtes utilisent des paramètres nommés « @nom », convertis en $1, $2…
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

export const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
export const STORAGE_DIR = path.join(SERVER_DIR, '..', 'storage')

const envFile = path.join(SERVER_DIR, '.env')
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)

// Types renvoyés en JavaScript : entiers 64 bits et numériques en nombres, dates simples en « AAAA-MM-JJ »
const INT8 = 20
const NUMERIC = 1700
const DATE = 1082
pg.types.setTypeParser(INT8, (v) => Number(v))
pg.types.setTypeParser(NUMERIC, (v) => Number(v))
pg.types.setTypeParser(DATE, (v) => v)

let backendPromise = null

// Nettoie la chaîne de connexion telle qu'elle est souvent collée : espaces, guillemets,
// ou commande complète copiée depuis Neon (« psql 'postgresql://…' »). N'affiche jamais la valeur.
function databaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw || !raw.trim()) return null
  const cleaned = raw
    .trim()
    .replace(/^psql\s+/i, '')
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
  let url
  try {
    url = new URL(cleaned)
  } catch {
    throw new Error(
      `DATABASE_URL n'est pas une adresse valide (${cleaned.length} caractères, ` +
        `${/^postgres(ql)?:\/\//.test(cleaned) ? 'commence bien par postgresql://' : 'ne commence pas par postgresql://'}). ` +
        'Collez la chaîne Neon seule, sans guillemets, au format postgresql://utilisateur:motdepasse@hote/base?sslmode=require',
    )
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) throw new Error('DATABASE_URL doit commencer par postgresql:// (chaîne de connexion Neon)')
  return { value: cleaned, host: url.hostname }
}

async function createBackend() {
  const conn = databaseUrl()
  if (conn) {
    const pool = new pg.Pool({
      // sslmode=require (chaîne Neon) équivaut déjà à verify-full dans « pg » : on l'écrit explicitement
      // pour garder la vérification complète du certificat et éviter l'avertissement de dépréciation.
      connectionString: conn.value.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full'),
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30_000,
    })
    const run = (client) => (text, values) => client.query(text, values).then((r) => r.rows)
    return {
      label: `PostgreSQL (${conn.host})`,
      query: run(pool),
      exec: (text) => pool.query(text),
      async transaction(fn) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await fn(run(client), (text) => client.query(text))
          await client.query('COMMIT')
          return result
        } catch (e) {
          await client.query('ROLLBACK').catch(() => {})
          throw e
        } finally {
          client.release()
        }
      },
      close: () => pool.end(),
    }
  }

  const { PGlite, types } = await import('@electric-sql/pglite')
  const dataDir = path.join(STORAGE_DIR, 'pgdata')
  fs.mkdirSync(dataDir, { recursive: true })
  const db = await PGlite.create({
    dataDir,
    parsers: { [types.INT8]: (v) => Number(v), [types.NUMERIC]: (v) => Number(v), [types.DATE]: (v) => v },
  })
  return {
    label: 'PostgreSQL intégré (PGlite, storage/pgdata)',
    query: (text, values) => db.query(text, values).then((r) => r.rows),
    exec: (text) => db.exec(text),
    transaction: (fn) =>
      db.transaction((tx) =>
        fn(
          (text, values) => tx.query(text, values).then((r) => r.rows),
          (text) => tx.exec(text),
        ),
      ),
    close: () => db.close(),
  }
}

const backend = () => (backendPromise ??= createBackend())

// « @nom » -> « $n » (le même nom réutilise le même numéro).
// Ignorés : « @> » (opérateur JSON) et tout « @ » situé dans un texte entre apostrophes ('a@b.fr').
function compile(text, params = {}) {
  const values = []
  const index = new Map()
  const replaceParams = (chunk) =>
    chunk.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
      if (!(name in params)) throw new Error(`Paramètre SQL manquant : @${name}`)
      if (!index.has(name)) {
        let v = params[name]
        if (v === undefined) v = null
        values.push(v)
        index.set(name, values.length)
      }
      return `$${index.get(name)}`
    })
  // Découpe en alternant code SQL / littéraux '...' (les apostrophes doublées '' restent dans le littéral)
  const sql = text
    .split(/('(?:[^']|'')*')/)
    .map((part, i) => (i % 2 === 1 ? part : replaceParams(part)))
    .join('')
  return { sql, values }
}

const bind = (runner) => ({
  query: (text, params) => {
    const { sql, values } = compile(text, params)
    return runner(sql, values)
  },
  one: async (text, params) => {
    const { sql, values } = compile(text, params)
    return (await runner(sql, values))[0] ?? null
  },
})

export async function query(text, params) {
  return bind((await backend()).query).query(text, params)
}
export async function one(text, params) {
  return bind((await backend()).query).one(text, params)
}
// Exécute un script SQL de plusieurs instructions (sans paramètres)
export async function exec(text) {
  return (await backend()).exec(text)
}

// Transaction : fn reçoit { query, one, exec } liés à la transaction
export async function transaction(fn) {
  const b = await backend()
  return b.transaction((runner, execTx) => fn({ ...bind(runner), exec: execTx }))
}

export async function dbLabel() {
  return (await backend()).label
}
export async function closeDb() {
  if (backendPromise) await (await backendPromise).close()
  backendPromise = null
}

export async function getSetting(key) {
  const row = await one('SELECT value FROM settings WHERE key = @key', { key })
  return row ? row.value : null
}

export async function setSetting(key, value, q = { query }) {
  await q.query(
    `INSERT INTO settings (key, value) VALUES (@key, @value::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    { key, value: JSON.stringify(value) },
  )
}

// Pagination : page à partir de 1, taille bornée
export function paging(req, defaultSize = 25, maxSize = 100) {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1))
  const size = Math.min(maxSize, Math.max(1, Math.floor(Number(req.query.size) || defaultSize)))
  return { page, size, offset: (page - 1) * size }
}
