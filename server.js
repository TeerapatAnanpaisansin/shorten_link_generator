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





app.use(express.urlencoded({ extended: true }));  // <- เพิ่มบรรทัดนี้
app.use(express.json());

// ---------- Auth Routes ----------
app.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  // ตัวอย่างแบบง่าย (งานจริงค่อยต่อ DB/bcrypt)
  if (username === 'gpo' && password === '1234') {
    // ชี้ไปหน้า index.html ของ shortener
    return res.status(200).json({ ok: true, redirect: '/shortener/index.html' });
  }

  return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
}));

app.post('/logout', (_req, res) => {
  // ถ้าใช้ session จริงให้ destroy ตรงนี้
  res.status(200).json({ ok: true });
});

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



// ---------- Auth Routes ----------
app.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  // ตรวจค่าที่ส่งมา
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  }

  // ตัวอย่าง: hardcode (งานจริงควรเช็คกับ DB และใช้ bcrypt)
  if (username === 'gpo' && password === '1234') {
    return res.status(200).json({ ok: true, redirect: '/shortener/index.html' });
  }

  return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
}));

app.post('/logout', (req, res) => {
  // ถ้าใช้ session จริง ให้ destroy ที่นี่
  res.status(200).json({ ok: true });
});



app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // TODO: ตรวจสอบรหัสผ่านจริงของคุณ
  const isValid = (username === 'admin' && password === '1234');

  // เก็บข้อมูล user agent / ip
  const userAgent = req.get('user-agent');
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

  try {
    await appendLogin({
      username,
      success: isValid,
      ip,
      userAgent,
      note: isValid ? 'login ok' : 'invalid credentials',
    });
  } catch (e) {
    console.error('Failed to log to Grist:', e.message);
    // ไม่ต้องบล็อคการล็อกอินถ้าบันทึก log ไม่สำเร็จ
  }

  if (isValid) {
    // ล็อกอินสำเร็จ → redirect ไปหน้าโปรเจกต์ของคุณ
    return res.redirect('/index.html'); // หรือเส้นทางที่คุณต้องการ
  } else {
    // ล้มเหลว → กลับหน้า login พร้อมข้อความ
    return res.status(401).send('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }
});


import { logLogin } from './grist.js'; // ถ้าจะบันทึกลง Grist (มีในไฟล์คุณแล้ว) :contentReference[oaicite:4]{index=4}

app.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    // ถ้าเป็น form ให้ส่งกลับแบบข้อความ; ถ้า JSON ก็ส่ง JSON
    if (req.is('application/json')) {
      return res.status(400).json({ ok: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }
    return res.status(400).send('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  }

  const isValid = (username === 'gpo' && password === '1234');

  // (ถ้าจะ log ลง Grist)
  try {
    await logLogin?.({
      username,
      success: isValid,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      note: isValid ? 'login ok' : 'invalid credentials',
    });
  } catch (e) {
    console.error('Failed to log to Grist:', e.message);
  }

  if (isValid) {
    // ถ้าเป็น JSON → ส่ง JSON บอก redirect; ถ้าเป็น form → redirect เลย
    if (req.is('application/json')) {
      return res.status(200).json({ ok: true, redirect: '/shortener/index.html' });
    }
    return res.redirect(303, '/shortener/index.html');
  }

  if (req.is('application/json')) {
    return res.status(401).json({ ok: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  }
  return res.status(401).send('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
}));

