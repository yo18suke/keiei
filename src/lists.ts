export type WriteMode = 'prose' | 'list'

const PREF_KEY = 'keiei.writeMode'

export function parseListItems(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed
    .split(/\n+|・/)
    .map((part) => part.replace(/^[\s・•●\-]+/, '').trim())
    .filter(Boolean)
}

export function joinListItems(items: string[]) {
  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `・${item}`)
    .join('\n')
}

export function looksLikeList(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^[・•●\-]/.test(trimmed)) return true
  const items = parseListItems(trimmed)
  return items.length >= 2 && (trimmed.includes('・') || /\n/.test(trimmed))
}

export function loadWriteMode(id: string, value: string): WriteMode {
  if (looksLikeList(value)) return 'list'
  try {
    const raw = localStorage.getItem(PREF_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, WriteMode>) : {}
    if (map[id] === 'list' || map[id] === 'prose') return map[id]
  } catch {
    /* ignore */
  }
  return 'prose'
}

export function saveWriteMode(id: string, mode: WriteMode) {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, WriteMode>) : {}
    map[id] = mode
    localStorage.setItem(PREF_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
