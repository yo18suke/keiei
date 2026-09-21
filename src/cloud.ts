import { googleFetch, readGoogleError } from './googleAuth'
import { cloneState } from './sync'
import { emptyState, type State } from './types'

const FILE_NAME = 'reflection-palette.json'
const FILE_ID_KEY = 'keiei.driveFileId'

export type CloudPayload = State & { updatedAt: number }

let cachedFileId = ''

function rememberedFileId() {
  if (cachedFileId) return cachedFileId
  try {
    cachedFileId = localStorage.getItem(FILE_ID_KEY) ?? ''
  } catch {
    cachedFileId = ''
  }
  return cachedFileId
}

function rememberFileId(id: string) {
  cachedFileId = id
  try {
    if (id) localStorage.setItem(FILE_ID_KEY, id)
    else localStorage.removeItem(FILE_ID_KEY)
  } catch {
    /* ignore */
  }
}

export function forgetCloudFile() {
  rememberFileId('')
}

async function findFileId() {
  const known = rememberedFileId()
  if (known) return known
  const query = encodeURIComponent(`name='${FILE_NAME}'`)
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name)&pageSize=1`,
    {},
    { interactive: false },
  )
  if (!res.ok) throw new Error(await readGoogleError(res, '保存場所を探せませんでした'))
  const body = (await res.json()) as { files?: Array<{ id?: string }> }
  const id = body.files?.[0]?.id ?? ''
  if (id) rememberFileId(id)
  return id
}

function asPayload(raw: unknown): CloudPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Partial<CloudPayload>
  const state = {
    ...emptyState(),
    days: row.days && typeof row.days === 'object' ? row.days : {},
    weekNotes: row.weekNotes && typeof row.weekNotes === 'object' ? row.weekNotes : {},
    monthNotes: row.monthNotes && typeof row.monthNotes === 'object' ? row.monthNotes : {},
    cases: Array.isArray(row.cases) ? row.cases : [],
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
  }
  return {
    ...state,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
  }
}

export async function loadCloud(): Promise<CloudPayload | null> {
  const id = await findFileId()
  if (!id) return null
  const res = await googleFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {}, { interactive: false })
  if (res.status === 404) {
    rememberFileId('')
    return null
  }
  if (!res.ok) throw new Error(await readGoogleError(res, 'クラウドの内容を読めませんでした'))
  try {
    return asPayload(await res.json())
  } catch {
    return null
  }
}

async function createCloud(payload: CloudPayload) {
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  }
  const boundary = `rp_${crypto.randomUUID()}`
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(payload)}\r\n--${boundary}--`
  const res = await googleFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
    { interactive: false },
  )
  if (!res.ok) throw new Error(await readGoogleError(res, 'クラウドへ保存できませんでした'))
  const created = (await res.json()) as { id?: string }
  if (!created.id) throw new Error('クラウドへ保存できませんでした')
  rememberFileId(created.id)
}

export async function saveCloud(state: State, updatedAt = Date.now()) {
  const payload: CloudPayload = { ...cloneState(state), updatedAt }
  const id = await findFileId()
  if (!id) {
    await createCloud(payload)
    return updatedAt
  }
  const res = await googleFetch(
    `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    { interactive: false },
  )
  if (res.status === 404) {
    rememberFileId('')
    await createCloud(payload)
    return updatedAt
  }
  if (!res.ok) throw new Error(await readGoogleError(res, 'クラウドへ保存できませんでした'))
  return updatedAt
}
