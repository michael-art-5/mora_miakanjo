import crypto from 'node:crypto'
import { one, query } from './db.js'

const COOKIE = 'mm_session'
const SESSION_DAYS = 7

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const test = crypto.scryptSync(password, salt, 64)
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'))
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

// Cookie « Secure » seulement si le visiteur est réellement en HTTPS
// (directement, derrière un proxy de confiance, ou derrière IIS/ARR qui ajoute X-ARR-SSL)
export const isHttps = (req) => req.secure || !!req.headers['x-arr-ssl']

export async function createSession(res, userId, secure) {
  const token = crypto.randomBytes(32).toString('hex')
  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (@token, @userId, now() + make_interval(days => @days::int))`,
    { token: sha256(token), userId, days: SESSION_DAYS },
  )
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`,
  )
}

export async function destroySession(req, res) {
  const token = readCookie(req, COOKIE)
  if (token) await query('DELETE FROM sessions WHERE token_hash = @token', { token: sha256(token) })
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
}

export async function currentUser(req) {
  const token = readCookie(req, COOKIE)
  if (!token) return null
  return one(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = @token AND s.expires_at > now()`,
    { token: sha256(token) },
  )
}

export async function requireAuth(req, res, next) {
  const user = await currentUser(req)
  if (!user) return res.status(401).json({ error: 'Non connecté' })
  req.user = user
  next()
}

// Petite limite anti-abus en mémoire : n requêtes par fenêtre et par IP
export function rateLimit({ max, windowMs }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    const key = req.ip
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs)
    if (list.length >= max) return res.status(429).json({ error: 'Trop de tentatives, réessayez dans quelques minutes.' })
    list.push(now)
    hits.set(key, list)
    next()
  }
}
