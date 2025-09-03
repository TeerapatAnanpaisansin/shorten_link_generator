// grist.js
import 'dotenv/config'

const { GRIST_BASE, GRIST_DOC, GRIST_API_KEY } = process.env

const missing = []
if (!GRIST_BASE) missing.push('GRIST_BASE')
if (!GRIST_DOC) missing.push('GRIST_DOC')
if (!GRIST_API_KEY) missing.push('GRIST_API_KEY')
if (missing.length) {
  throw new Error(`[ENV ERROR] Missing ${missing.join(', ')}. Check your .env file.`)
}

const TABLE = 'Urls'
const baseRecords = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${encodeURIComponent(TABLE)}/records`

async function gristFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GRIST_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    ...opts,
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('Grist API Error:', { status: res.status, url, response: text.slice(0, 200) })
    throw new Error(`Grist API error: ${res.status}`)
  }
  return res.json()
}

function withFilter(filter) {
  const params = new URLSearchParams()
  params.set('filter', JSON.stringify(filter))
  return `${baseRecords}?${params.toString()}`  // <- แก้ BASE_RECORDS -> baseRecords
}

// Column names: id2 (short id), longUrl, clicks, createdAt
export async function findRecordByShortId(shortId) {
  const data = await gristFetch(withFilter({ id2: [shortId] }))
  return data.records?.[0] || null
}

export async function findRecordByLongUrl(longUrl) {
  const data = await gristFetch(withFilter({ longUrl: [longUrl] }))
  return data.records?.[0] || null
}

export async function shortIdExists(shortId) {
  const data = await gristFetch(withFilter({ id2: [shortId] }))
  return (data.records?.length ?? 0) > 0
}

export async function createShortRecord({ id, longUrl }) {
  return gristFetch(baseRecords, {           // <- แก้ BASE_RECORDS -> baseRecords
    method: 'POST',
    body: JSON.stringify({
      records: [{
        fields: {
          id2: id,
          longUrl,
          createdAt: new Date().toISOString(),
          clicks: 0
        }
      }]
    })
  })
}

export async function incrementClickCount(rowId, currentClicks = 0) {
  return gristFetch(baseRecords, {           // <- แก้ BASE_RECORDS -> baseRecords
    method: 'PATCH',
    body: JSON.stringify({
      records: [{ id: rowId, fields: { clicks: currentClicks + 1 } }]
    })
  })
}

// ---------- เพิ่ม export alias ให้ตรงกับ server.js ----------
export const findById       = findRecordByShortId
export const findByLong     = findRecordByLongUrl
export const existsId       = shortIdExists
export const createUrl      = createShortRecord
export const incrementClicks = incrementClickCount


//login
// ===== เพิ่มค่าคงที่สำหรับตาราง Login =====
const LOGIN_TABLE = process.env.GRIST_LOGIN_TABLE || 'LoginLogs';
const loginRecords = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${encodeURIComponent(LOGIN_TABLE)}/records`;

// ===== ฟังก์ชันบันทึก Log การล็อกอิน =====
export async function logLogin({ username, success, ip, userAgent, note }) {
  return gristFetch(loginRecords, {
    method: 'POST',
    body: JSON.stringify({
      records: [{
        fields: {
          Username: username || '',
          Success: !!success,            // ต้องเป็นคอลัมน์ชนิด Toggle/Bool ใน Grist
          IP: ip || null,
          UserAgent: userAgent || null,
          LoginAt: new Date().toISOString(),
          Note: note || null,
        }
      }]
    })
  });
}
