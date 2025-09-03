// server.js

import 'dotenv/config'
import express from 'express'
import path from 'path'
import crypto from 'crypto'
import session from 'express-session'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import {
  findByLong,
  existsId,
  createUrl,
  findById,
  incrementClicks,
  findUserByUsernameOrEmail,
  updateUserLastLogin,
  logLogin,
} from './grist.js'

// ---------- Setup ----------
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const PORT = process.env.PORT || 3000

// if you run behind ngrok/reverse proxies
app.set('trust proxy', true)

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.get('/', (_req, res) => {
  res.redirect('/login/login.html');  // or '/shortener/index.html'
});

// Simple session (MemoryStore; OK for dev)
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true if you serve via HTTPS only
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  }
}))

// ---------- Helpers ----------
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/,'')
  const proto = req.headers['x-forwarded-proto'] || req.protocol
  const host  = req.headers['x-forwarded-host']  || req.get('host')
  return `${proto}://${host}`
}

function isValidUrl(s) { try { new URL(s); return true } catch { return false } }

function normalizeUrl(raw) {
  const u = new URL(raw)
  u.hash = ''
  ;['utm_source','utm_medium','utm_campaign','utm_term','utm_content']
    .forEach(k => u.searchParams.delete(k))
  if (u.pathname.endsWith('/') && u.pathname !== '/') u.pathname = u.pathname.slice(0,-1)
  u.host = u.host.toLowerCase()
  return u.toString()
}

const ABC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-'
function nano(n = 9) {
  const buf = crypto.randomBytes(n)
  let out = ''
  for (let i = 0; i < n; i++) out += ABC[buf[i] % ABC.length]
  return out
}

function requireAuth(req, res, next) {
  if (req.session?.user) return next()
  // For API calls, return 401 JSON; for pages, redirect to /login/login.html
  if (req.accepts('json')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  return res.redirect('/login/login.html')
}

// ---------- Auth Routes ----------
app.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {}

  if (!username || !password) {
    if (req.is('application/json')) {
      return res.status(400).json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' })
    }
    return res.status(400).send('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
  }

  // 1) Find user by email or username
  const userRecord = await findUserByUsernameOrEmail(username)
  const okUser = !!userRecord?.id
  let passwordOk = false

  if (okUser) {
    const fields = userRecord.fields || {}
    const storedHashOrPlain = fields.password || ''
    // If you saved plain text in Grist (not recommended), allow plain compare
    if (storedHashOrPlain.startsWith('$2a$') || storedHashOrPlain.startsWith('$2b$')) {
      passwordOk = await bcrypt.compare(password, storedHashOrPlain)
    } else {
      passwordOk = (password === storedHashOrPlain)
    }
  }

  const success = okUser && passwordOk

  // optional login log
  try {
    await logLogin({
      username,
      success,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      note: success ? 'login ok' : 'invalid credentials',
    })
  } catch (e) {
    console.error('Failed to log login:', e.message)
  }

  if (!success) {
    if (req.is('application/json')) {
      return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
    }
    return res.status(401).send('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }

  // success → set session
  const { userId, email, userName } = userRecord.fields
  req.session.user = { userId, email, userName, gristRowId: userRecord.id }

  // update lastLogin
  try { await updateUserLastLogin(userRecord.id) } catch (_) {}

  // JSON vs form response
  if (req.is('application/json')) {
    return res.status(200).json({ ok: true, redirect: '/shortener/index.html' })
  }
  return res.redirect(303, '/shortener/index.html')
}))

app.post('/logout', (req, res) => {
  req.session?.destroy(() => {
    res.status(200).json({ ok: true })
  })
})

// ---------- Shorten API (auth required) ----------
app.post('/api/shorten', requireAuth, asyncHandler(async (req, res) => {
  const { url } = req.body || {}
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  const normalized = normalizeUrl(url)

  // If same longUrl already exists for anyone (or you can scope by user if you want)
  const existing = await findByLong(normalized)
  const base = getBaseUrl(req)

  if (existing?.fields) {
    const shortId = existing.fields.urlsId
    return res.json({ shortUrl: `${base}/${shortId}` })
  }

  // generate new unique shortId
  let shortId
  for (let i = 0; i < 5; i++) {
    const candidate = nano(6)
    const taken = await existsId(candidate)
    if (!taken) { shortId = candidate; break }
  }
  if (!shortId) shortId = nano(8)

  // attach createdBy from session (Users.userId)
  const createdBy = req.session.user?.userId

  await createUrl({ id: shortId, longUrl: normalized, createdBy })

  return res.json({ shortUrl: `${base}/${shortId}` })
}))

// ---------- Redirect route (/:id) ----------
app.get('/:id', asyncHandler(async (req, res, next) => {
  const shortId = req.params.id

  // ignore reserved paths under /shortener and /login
  if (shortId === 'shortener' || shortId === 'login' || shortId === 'api' ) return next()

  const rec = await findById(shortId)
  if (!rec?.fields) return res.status(404).send('Not found')

  // increment clicks (best-effort)
  try {
    await incrementClicks(rec.id, rec.fields.clicks || 0)
  } catch (e) {
    console.error('Failed to increment clicks', e.message)
  }

  return res.redirect(302, rec.fields.longUrl)
}))

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// ---------- Start ----------
app.listen(PORT, () => {
  if (process.env.BASE_URL) {
    console.log(`✅ URL Shortener running at ${process.env.BASE_URL}`)
  } else {
    console.log(`✅ URL Shortener running on local: http://localhost:${PORT}`)
    console.log(`   Open /login/login.html to sign in`)
  }
})
