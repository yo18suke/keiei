import { googleFetch, readGoogleError } from './googleAuth'

export {
  googleClientId,
  isLikelyClientId,
  saveGoogleClientId,
} from './googleAuth'

export async function sendToGoogleDoc(title: string, text: string) {
  const created = await googleFetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!created.ok) throw new Error(await readGoogleError(created, 'Google Docs でエラーが起きました'))
  const doc = (await created.json()) as { documentId: string }

  const updated = await googleFetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text } }],
    }),
  })
  if (!updated.ok) throw new Error(await readGoogleError(updated, 'Google Docs でエラーが起きました'))

  return `https://docs.google.com/document/d/${doc.documentId}/edit`
}
