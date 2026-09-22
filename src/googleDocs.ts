import type { DocSpan } from './exportDoc'
import { googleFetch, readGoogleError } from './googleAuth'

export {
  googleClientId,
  isLikelyClientId,
  saveGoogleClientId,
} from './googleAuth'

const FOLDER_NAME = 'リフレクションパレット'
const FOLDER_KEY = 'keiei.docsFolderId'
const CORAL = { red: 0.941, green: 0.416, blue: 0.416 }
const INK = { red: 0.118, green: 0.122, blue: 0.129 }
const MUTED = { red: 0.427, green: 0.431, blue: 0.435 }
const LINE = { red: 0.91, green: 0.91, blue: 0.914 }

type DocsRequest = Record<string, unknown>

function pt(magnitude: number) {
  return { magnitude, unit: 'PT' }
}

function color(rgb: { red: number; green: number; blue: number }) {
  return { color: { rgbColor: rgb } }
}

function rememberedFolder() {
  try {
    return localStorage.getItem(FOLDER_KEY) ?? ''
  } catch {
    return ''
  }
}

function rememberFolder(id: string) {
  try {
    if (id) localStorage.setItem(FOLDER_KEY, id)
    else localStorage.removeItem(FOLDER_KEY)
  } catch {
    /* ignore */
  }
}

async function folderExists(id: string) {
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`,
    {},
    { interactive: false },
  )
  if (!res.ok) return false
  const body = (await res.json()) as { id?: string; trashed?: boolean }
  return Boolean(body.id) && !body.trashed
}

async function findDocsFolder() {
  const query = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const res = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=5`,
    {},
    { interactive: false },
  )
  if (!res.ok) throw new Error(await readGoogleError(res, '保存フォルダを探せませんでした'))
  const body = (await res.json()) as { files?: Array<{ id?: string }> }
  return body.files?.[0]?.id ?? ''
}

async function createDocsFolder() {
  const res = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    },
    { interactive: true },
  )
  if (!res.ok) throw new Error(await readGoogleError(res, '保存フォルダを作れませんでした'))
  const body = (await res.json()) as { id?: string }
  if (!body.id) throw new Error('保存フォルダを作れませんでした')
  return body.id
}

export async function ensureDocsFolder() {
  const known = rememberedFolder()
  if (known && (await folderExists(known))) return known
  const found = await findDocsFolder()
  if (found) {
    rememberFolder(found)
    return found
  }
  const created = await createDocsFolder()
  rememberFolder(created)
  return created
}

function compileDoc(parts: DocSpan[]) {
  let text = ''
  const requests: DocsRequest[] = []

  function add(chunk: string) {
    const start = text.length + 1
    text += chunk
    return { startIndex: start, endIndex: text.length + 1 }
  }

  function paragraph(range: { startIndex: number; endIndex: number }, named: string, extra: Record<string, unknown> = {}) {
    requests.push({
      updateParagraphStyle: {
        range,
        paragraphStyle: {
          namedStyleType: named,
          ...extra,
        },
        fields: ['namedStyleType', ...Object.keys(extra)].join(','),
      },
    })
  }

  function run(range: { startIndex: number; endIndex: number }, style: Record<string, unknown>) {
    requests.push({
      updateTextStyle: {
        range,
        textStyle: style,
        fields: Object.keys(style).join(','),
      },
    })
  }

  for (const part of parts) {
    if (part.kind === 'title') {
      const range = add(`${part.text}\n`)
      paragraph(range, 'TITLE', { spaceBelow: pt(4) })
      run(range, { bold: true, fontSize: pt(22), foregroundColor: color(CORAL) })
      continue
    }
    if (part.kind === 'kicker') {
      const range = add(`${part.text}\n`)
      paragraph(range, 'SUBTITLE', { spaceBelow: pt(14) })
      run(range, { fontSize: pt(11), foregroundColor: color(MUTED) })
      continue
    }
    if (part.kind === 'heading') {
      const range = add(`${part.text}\n`)
      paragraph(range, 'HEADING_2', { spaceAbove: pt(18), spaceBelow: pt(8) })
      run(range, { bold: true, fontSize: pt(14), foregroundColor: color(INK) })
      continue
    }
    if (part.kind === 'label') {
      const range = add(`${part.text}\n`)
      paragraph(range, 'HEADING_3', { spaceAbove: pt(12), spaceBelow: pt(4) })
      run(range, { bold: true, fontSize: pt(10), foregroundColor: color(CORAL) })
      continue
    }
    if (part.kind === 'para') {
      const range = add(`${part.text}\n`)
      paragraph(range, 'NORMAL_TEXT', { spaceBelow: pt(8), lineSpacing: 115 })
      run(range, { fontSize: pt(11), foregroundColor: color(INK) })
      continue
    }
    if (part.kind === 'list') {
      const startIndex = text.length + 1
      for (const item of part.items) add(`${item}\n`)
      const range = { startIndex, endIndex: text.length + 1 }
      paragraph(range, 'NORMAL_TEXT', { spaceBelow: pt(2), indentStart: pt(18), lineSpacing: 115 })
      run(range, { fontSize: pt(11), foregroundColor: color(INK) })
      requests.push({
        createParagraphBullets: {
          range,
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      })
      continue
    }
    const range = add('\n')
    paragraph(range, 'NORMAL_TEXT', {
      spaceAbove: pt(6),
      spaceBelow: pt(6),
      borderBottom: {
        color: color(LINE),
        width: pt(1),
        padding: pt(2),
        dashStyle: 'SOLID',
      },
    })
  }

  if (!text.endsWith('\n')) text += '\n'
  return { text, requests }
}

export async function sendToGoogleDoc(title: string, parts: DocSpan[]) {
  const folderId = await ensureDocsFolder()
  const compiled = compileDoc(parts)
  if (!compiled.text.trim()) throw new Error('送る内容がありません')

  const created = await googleFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    }),
  })
  if (!created.ok) throw new Error(await readGoogleError(created, 'Google Docs でエラーが起きました'))
  const doc = (await created.json()) as { id?: string }
  if (!doc.id) throw new Error('ドキュメントを作れませんでした')

  const updated = await googleFetch(`https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: compiled.text } }, ...compiled.requests],
    }),
  })
  if (!updated.ok) throw new Error(await readGoogleError(updated, 'Google Docs でエラーが起きました'))

  return `https://docs.google.com/document/d/${doc.id}/edit`
}
