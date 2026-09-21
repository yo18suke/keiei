const SCOPES =
  'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file'
const CLIENT_KEY = 'keiei.googleClientId'

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: () => void
          }) => TokenClient
        }
      }
    }
  }
}

let accessToken = ''
let tokenExpiresAt = 0

export function normalizeClientId(raw: string) {
  return raw
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^VITE_GOOGLE_CLIENT_ID\s*=\s*/i, '')
    .trim()
}

export function googleClientId() {
  const fromEnv = normalizeClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')
  if (fromEnv) return fromEnv
  try {
    return normalizeClientId(localStorage.getItem(CLIENT_KEY) ?? '')
  } catch {
    return ''
  }
}

export function saveGoogleClientId(id: string) {
  const trimmed = normalizeClientId(id)
  if (!trimmed) {
    localStorage.removeItem(CLIENT_KEY)
    return
  }
  localStorage.setItem(CLIENT_KEY, trimmed)
}

export function isLikelyClientId(id: string) {
  return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(normalizeClientId(id))
}

export function hasGoogleSession() {
  return Boolean(accessToken && Date.now() < tokenExpiresAt - 15_000)
}

function ensureGisScript() {
  if (window.google?.accounts.oauth2) return
  if (document.querySelector('script[data-gis]')) return
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.dataset.gis = '1'
  document.head.appendChild(script)
}

ensureGisScript()

function waitForGis(ms = 8000) {
  if (window.google?.accounts.oauth2) return Promise.resolve()
  ensureGisScript()
  return new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const tick = window.setInterval(() => {
      if (window.google?.accounts.oauth2) {
        window.clearInterval(tick)
        resolve()
        return
      }
      if (Date.now() - started > ms) {
        window.clearInterval(tick)
        reject(new Error('Google のログインを読み込めませんでした'))
      }
    }, 80)
  })
}

function requestToken(clientId: string) {
  return new Promise<string>((resolve, reject) => {
    if (!window.google?.accounts.oauth2) {
      reject(new Error('Google のログインを読み込めませんでした'))
      return
    }
    const finish = (error?: Error, token?: string) => {
      window.clearTimeout(timer)
      if (error) reject(error)
      else if (token) resolve(token)
    }
    const timer = window.setTimeout(() => {
      finish(new Error('ログインが時間切れです。ポップアップがブロックされていないか確認してください。'))
    }, 20000)
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          finish(new Error(response.error || 'ログインをキャンセルしました'))
          return
        }
        accessToken = response.access_token
        const life = (response.expires_in ?? 3600) * 1000
        tokenExpiresAt = Date.now() + life
        finish(undefined, accessToken)
      },
      error_callback: () => {
        finish(new Error('ログイン窓を開けませんでした。ブラウザのポップアップ許可を確認してください。'))
      },
    })
    client.requestAccessToken()
  })
}

export async function getAccessToken() {
  const clientId = googleClientId()
  if (!clientId) throw new Error('NO_CLIENT_ID')
  if (hasGoogleSession()) return accessToken
  await waitForGis()
  return requestToken(clientId)
}

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message || `Google Docs でエラーが起きました（${res.status}）`
  } catch {
    return `Google Docs でエラーが起きました（${res.status}）`
  }
}

async function googleFetch(url: string, init: RequestInit, retry = true) {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401 && retry) {
    accessToken = ''
    tokenExpiresAt = 0
    return googleFetch(url, init, false)
  }
  return res
}

export async function sendToGoogleDoc(title: string, text: string) {
  const created = await googleFetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!created.ok) throw new Error(await readError(created))
  const doc = (await created.json()) as { documentId: string }

  const updated = await googleFetch(
    `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text } }],
      }),
    },
  )
  if (!updated.ok) throw new Error(await readError(updated))

  return `https://docs.google.com/document/d/${doc.documentId}/edit`
}
