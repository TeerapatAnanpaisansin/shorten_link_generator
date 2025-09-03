// grist.js
import 'dotenv/config'

const {
  GRIST_BASE,
  GRIST_DOC,
  GRIST_API_KEY,
  GRIST_URLS_TABLE = 'Urls',
  GRIST_USERS_TABLE = 'Users',
  GRIST_LOGIN_TABLE = 'LoginLogs',
} = process.env

const missing = []
if (!GRIST_BASE) missing.push('GRIST_BASE')
if (!GRIST_DOC) missing.push('GRIST_DOC')
if (!GRIST_API_KEY) missing.push('GRIST_API_KEY')
if (missing.length) {
  throw new Error(`[ENV ERROR] Missing ${missing.join(', ')}. Check your .env file.`)
}

const urlsTable = encodeURIComponent(GRIST_URLS_TABLE)
const usersTable = encodeURIComponent(GRIST_USERS_TABLE)
const loginTable = encodeURIComponent(GRIST_LOGIN_TABLE)

const urlsRecords  = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${urlsTable}/records`
const usersRecords = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${usersTable}/records`
const loginRecords = `${GRIST_BASE}/api/docs/${GRIST_DOC}/tables/${loginTable}/records`

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

function withFilter(base, filter) {
  const params = new URLSearchParams()
  params.set('filter', JSON.stringify(filter))
  return `${base}?${params.toString()}`
}

/* ===================== Urls ===================== */
// Columns: urlsId (int/string short id), longUrl, clicks, createdAt, createdBy (Ref: Users.userId)
export async function findRecordByShortId(shortId) {
  const data = await gristFetch(withFilter(urlsRecords, { urlsId: [shortId] }))
  return data.records?.[0] || null
}

export async function findRecordByLongUrl(longUrl) {
  const data = await gristFetch(withFilter(urlsRecords, { longUrl: [longUrl] }))
  return data.records?.[0] || null
}

export async function shortIdExists(shortId) {
  const data = await gristFetch(withFilter(urlsRecords, { urlsId: [shortId] }))
  return (data.records?.length ?? 0) > 0
}

export async function createShortRecord({ id, longUrl, createdBy }) {
  return gristFetch(urlsRecords, {
    method: 'POST',
    body: JSON.stringify({
      records: [{
        fields: {
          urlsId: id,
          longUrl,
          createdAt: new Date().toISOString(),
          clicks: 0,
          ...(createdBy ? { createdBy } : {}),
        }
      }]
    })
  })
}

export async function incrementClickCount(rowId, currentClicks = 0) {
  return gristFetch(urlsRecords, {
    method: 'PATCH',
    body: JSON.stringify({
      records: [{ id: rowId, fields: { clicks: currentClicks + 1 } }]
    })
  })
}

/* Back-compat aliases used in server.js */
export const findById        = findRecordByShortId
export const findByLong      = findRecordByLongUrl
export const existsId        = shortIdExists
export const createUrl       = createShortRecord
export const incrementClicks = incrementClickCount

/* ===================== Users ===================== */
// Columns: userId (int), email (text), password (text), userName (text), createdAt (datetime), lastLogin (datetime)
export async function findUserByUsernameOrEmail(identifier) {
  // Try both fields; Grist filter supports OR via separate requests (simple way)
  const byEmail = await gristFetch(withFilter(usersRecords, { email: [identifier] }))
  if (byEmail.records?.[0]) return byEmail.records[0]

  const byUser = await gristFetch(withFilter(usersRecords, { userName: [identifier] }))
  return byUser.records?.[0] || null
}

export async function updateUserLastLogin(rowId) {
  return gristFetch(usersRecords, {
    method: 'PATCH',
    body: JSON.stringify({
      records: [{ id: rowId, fields: { lastLogin: new Date().toISOString() } }]
    })
  })
}

/* ===================== Login Logs (optional) ===================== */
export async function logLogin({ username, success, ip, userAgent, note }) {
  return gristFetch(loginRecords, {
    method: 'POST',
    body: JSON.stringify({
      records: [{
        fields: {
          Username: username || '',
          Success: !!success,
          IP: ip || null,
          UserAgent: userAgent || null,
          LoginAt: new Date().toISOString(),
          Note: note || null,
        }
      }]
    })
  })
}
