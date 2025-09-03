// server.js
import 'dotenv/config'
import express from 'express'
import path from 'path'
import QRCode from 'qrcode'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import {
  findByLong,
  existsId,
  createUrl,
  findById,
  incrementClicks,
} from './grist.js'

// ---------- Setup ----------
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const app  = express()
const PORT = process.env.PORT || 3000

// สำคัญ: บอก Express ว่าอยู่หลัง proxy (เช่น ngrok/cloudflare)
app.set('trust proxy', true)

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

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

// ---------- Routes ----------
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'shortener', 'index.html'))
)

app.get('/favicon.ico', (_req, res) => res.status(204).end())

app.post('/api/shorten', asyncHandler(async (req, res) => {
  const input = (req.body?.url || '').trim()
  if (!input) return res.status(400).json({ error: 'Missing url' })
  if (!isValidUrl(input)) return res.status(400).json({ error: 'Invalid URL' })

  const longUrl = normalizeUrl(input)
  const exist = await findByLong(longUrl)
  if (exist) {
    const id = exist.fields.urlsId
    return res.json({ id, shortUrl: `${getBaseUrl(req)}/${id}` })
  }

  let id = ''
  do { id = nano(9) } while (await existsId(id))

  await createUrl({ id, longUrl })
  res.json({ id, shortUrl: `${getBaseUrl(req)}/${id}` })
}))

app.get('/qr/:id.png', asyncHandler(async (req, res) => {
  const { id } = req.params
  const shortUrl = `${getBaseUrl(req)}/${id}`
  const png = await QRCode.toBuffer(shortUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
  })
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=604800, immutable')
  res.send(png)
}))

app.get('/:id([0-9A-Za-z_-]{3,32})', asyncHandler(async (req, res) => {
  const { id } = req.params
  const rec = await findById(id)
  if (!rec) return res.status(404).send('Not found')
  await incrementClicks(rec.id, rec.fields.clicks)
  res.redirect(301, rec.fields.longUrl)
}))

// ---------- Error handler ----------
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// ---------- Start ----------
app.listen(PORT, () => {
  // ถ้ามี BASE_URL → แสดงเลย
  if (process.env.BASE_URL) {
    console.log(`✅ URL Shortener running at ${process.env.BASE_URL}`)
  } else {
    console.log(`✅ URL Shortener running on local: http://localhost:${PORT}`)
    console.log(`   (If using ngrok, open the ngrok URL instead)`)
  }
})
