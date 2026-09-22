import { useState } from 'react'
import { copyText, downloadText, renderDocText, type DocSpan } from './exportDoc'
import { googleClientId, isLikelyClientId, saveGoogleClientId, sendToGoogleDoc } from './googleDocs'
import { Button } from './ui'

export function ExportActions({
  parts,
  filename,
}: {
  parts: DocSpan[]
  filename: string
}) {
  const text = renderDocText(parts)
  const [copied, setCopied] = useState(false)
  const [google, setGoogle] = useState<'idle' | 'sending' | 'opened'>('idle')
  const [clientId, setClientId] = useState(googleClientId)
  const [draftId, setDraftId] = useState(clientId)
  const [needId, setNeedId] = useState(false)
  const empty = !text.trim() || text.includes('まだ振り返りがありません')

  async function sendGoogle() {
    if (empty || google === 'sending') return
    if (!googleClientId()) {
      setNeedId(true)
      return
    }
    setGoogle('sending')
    try {
      const title = filename.replace(/\.txt$/, '')
      const url = await sendToGoogleDoc(title, parts)
      window.open(url, '_blank', 'noopener')
      setGoogle('opened')
      window.setTimeout(() => setGoogle('idle'), 1800)
    } catch (error) {
      setGoogle('idle')
      const message = error instanceof Error ? error.message : '送れませんでした'
      if (message === 'NO_CLIENT_ID') {
        setNeedId(true)
        return
      }
      if (message !== 'ログインをキャンセルしました') window.alert(message)
    }
  }

  return (
    <div className="export-actions">
      <div className="row-actions">
        <Button
          variant="quiet"
          onClick={async () => {
            if (empty) return
            const ok = await copyText(text)
            if (ok) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }
          }}
        >
          {copied ? 'コピーした' : '文書をコピー'}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            if (empty) return
            downloadText(filename, text)
          }}
        >
          文書をダウンロード
        </Button>
        <Button variant="quiet" onClick={sendGoogle}>
          {google === 'sending'
            ? '送っています…'
            : google === 'opened'
              ? 'ドキュメントを開いた'
              : 'Googleドキュメントへ'}
        </Button>
        {clientId ? (
          <Button variant="quiet" onClick={() => setNeedId(true)}>
            クライアントIDを変更
          </Button>
        ) : null}
      </div>
      {needId ? (
        <form
          className="google-setup"
          onSubmit={(e) => {
            e.preventDefault()
            if (!isLikelyClientId(draftId)) {
              window.alert(
                'クライアントIDは xxxxx.apps.googleusercontent.com の形です。シークレットではなく、IDを貼ってください。',
              )
              return
            }
            saveGoogleClientId(draftId)
            setClientId(googleClientId())
            if (googleClientId()) {
              setNeedId(false)
              void sendGoogle()
            }
          }}
        >
          <p className="muted">
            初回だけ、Google Cloud のクライアントIDを入れます。保存したあと、Googleでログインします。
          </p>
          <div className="case-new">
            <input
              value={draftId}
              placeholder="VITE ではなく、クライアントIDそのもの"
              aria-label="GoogleクライアントID"
              autoComplete="off"
              onChange={(e) => setDraftId(e.target.value)}
            />
            <Button type="submit" variant="primary">
              保存して送る
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
