const CLIENT_KEY = 'keiei.googleClientId'
const SESSION_KEY = 'keiei.session'
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void
}

type TokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

type CredentialResponse = {
  credential?: string
  select_by?: string
}

type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: 'signin' | 'signup' | 'use'
    itp_support?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    config: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
  prompt: () => void
  cancel: () => void
  disableAutoSelect: () => void
}

export type AuthUser = {
  email: string
  name: string
  sub?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id?: GoogleId
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: () => void
          }) => TokenClient
          revoke?: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let accessToken = ''
let tokenExpiresAt = 0
let ssoReady = false
let ssoClientId = ''
let ssoPrompted = false
let ssoInit: Promise<boolean> | null = null
let credentialHandler: ((credential: string) => void) | null = null

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
  ssoReady = false
  ssoClientId = ''
  ssoInit = null
  ssoPrompted = false
  if (!trimmed) {
    localStorage.removeItem(CLIENT_KEY)
    return
  }
  localStorage.setItem(CLIENT_KEY, trimmed)
}

export function isLikelyClientId(id: string) {
  return /^[\w.-]+\.apps\.googleusercontent\.com$/.test(normalizeClientId(id))
}

function asUser(parsed: Partial<AuthUser>): AuthUser | null {
  if (typeof parsed.email !== 'string' || !parsed.email.includes('@')) return null
  return {
    email: parsed.email,
    name: typeof parsed.name === 'string' ? parsed.name : '',
    sub: typeof parsed.sub === 'string' ? parsed.sub : undefined,
  }
}

export function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return asUser(JSON.parse(raw) as Partial<AuthUser>)
  } catch {
    return null
  }
}

function saveSession(user: AuthUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  accessToken = ''
  tokenExpiresAt = 0
  localStorage.removeItem(SESSION_KEY)
}

export function hasGoogleSession() {
  return Boolean(accessToken && Date.now() < tokenExpiresAt - 15_000)
}

function ensureGisScript() {
  if (window.google?.accounts.oauth2) return
  if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) return
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

function waitForGoogleId(ms = 4000) {
  if (window.google?.accounts.id) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const tick = window.setInterval(() => {
      if (window.google?.accounts.id) {
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

function decodeJwtPayload(credential: string): Record<string, unknown> {
  const part = credential.split('.')[1]
  if (!part) throw new Error('ログイン情報を読めませんでした')
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

export function userFromCredential(credential: string): AuthUser {
  const claims = decodeJwtPayload(credential)
  const user = asUser({
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    sub: typeof claims.sub === 'string' ? claims.sub : undefined,
  })
  if (!user) throw new Error('メールアドレスを取得できませんでした')
  return user
}

export function onGoogleCredential(handler: ((credential: string) => void) | null) {
  credentialHandler = handler
}

export function ensureGoogleSso() {
  const clientId = googleClientId()
  if (!clientId) return Promise.resolve(false)
  if (ssoInit && ssoClientId === clientId) return ssoInit
  ssoClientId = clientId
  ssoInit = (async () => {
    await waitForGis()
    await waitForGoogleId()
    const id = window.google?.accounts.id
    if (!id) return false
    id.initialize({
      client_id: clientId,
      auto_select: true,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (response.credential) credentialHandler?.(response.credential)
      },
    })
    ssoReady = true
    return true
  })()
  return ssoInit
}

export function promptGoogleSso() {
  if (!ssoReady || ssoPrompted) return
  ssoPrompted = true
  try {
    window.google?.accounts.id?.prompt()
  } catch {
    /* FedCM が使えない環境では無視 */
  }
}

export function cancelGoogleSso() {
  try {
    window.google?.accounts.id?.cancel()
  } catch {
    /* ignore */
  }
}

export function disableGoogleAutoSelect() {
  ssoPrompted = true
  try {
    window.google?.accounts.id?.disableAutoSelect()
  } catch {
    /* ignore */
  }
}

export function renderGoogleSignInButton(parent: HTMLElement, width = 320) {
  const id = window.google?.accounts.id
  if (!id || !ssoReady) return false
  parent.replaceChildren()
  id.renderButton(parent, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    locale: 'ja',
    width: Math.max(240, Math.min(400, Math.round(width))),
  })
  return parent.childElementCount > 0
}

function requestToken(clientId: string, interactive: boolean) {
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
      finish(
        new Error(
          interactive
            ? 'ログインが時間切れです。ポップアップがブロックされていないか確認してください。'
            : 'SILENT_FAIL',
        ),
      )
    }, interactive ? 20000 : 8000)
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          finish(
            new Error(
              interactive
                ? response.error === 'access_denied'
                  ? 'ログインをキャンセルしました'
                  : response.error || 'ログインをキャンセルしました'
                : 'SILENT_FAIL',
            ),
          )
          return
        }
        accessToken = response.access_token
        const life = (response.expires_in ?? 3600) * 1000
        tokenExpiresAt = Date.now() + life
        finish(undefined, accessToken)
      },
      error_callback: () => {
        finish(
          new Error(
            interactive
              ? 'ログイン窓を開けませんでした。ブラウザのポップアップ許可を確認してください。'
              : 'SILENT_FAIL',
          ),
        )
      },
    })
    client.requestAccessToken(interactive ? undefined : { prompt: '' })
  })
}

async function fetchProfile(token: string): Promise<AuthUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('アカウント情報を取得できませんでした')
  const body = (await res.json()) as { email?: string; name?: string; sub?: string }
  if (!body.email) throw new Error('メールアドレスを取得できませんでした')
  return { email: body.email, name: body.name ?? '', sub: body.sub }
}

export async function getAccessToken(interactive = true) {
  const clientId = googleClientId()
  if (!clientId) throw new Error('NO_CLIENT_ID')
  if (hasGoogleSession()) return accessToken
  await waitForGis()
  try {
    return await requestToken(clientId, false)
  } catch (error) {
    if (!interactive) throw error
    return requestToken(clientId, true)
  }
}

export async function signInFromCredential(credential: string): Promise<AuthUser> {
  const user = userFromCredential(credential)
  saveSession(user)
  try {
    await getAccessToken(true)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'ログインをキャンセルしました' || message === 'SILENT_FAIL') return user
    throw error
  }
  return user
}

export async function signIn(interactive = true): Promise<AuthUser> {
  const token = await getAccessToken(interactive)
  const user = await fetchProfile(token)
  saveSession(user)
  return user
}

export async function signOut() {
  const token = accessToken
  disableGoogleAutoSelect()
  cancelGoogleSso()
  clearSession()
  if (token && window.google?.accounts.oauth2.revoke) {
    await new Promise<void>((resolve) => {
      window.google?.accounts.oauth2.revoke?.(token, () => resolve())
      window.setTimeout(resolve, 1200)
    })
  }
}

export async function googleFetch(url: string, init: RequestInit = {}, retry = true) {
  const token = await getAccessToken(true)
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

export async function readGoogleError(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message || `${fallback}（${res.status}）`
  } catch {
    return `${fallback}（${res.status}）`
  }
}
