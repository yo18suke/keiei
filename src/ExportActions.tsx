import { useState } from 'react'
import { copyText, downloadText } from './exportDoc'
import { Button } from './ui'

export function ExportActions({
  text,
  filename,
}: {
  text: string
  filename: string
}) {
  const [copied, setCopied] = useState(false)
  const empty = !text.trim() || text.includes('まだ振り返りがありません')

  return (
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
      <Button variant="quiet" onClick={() => {
        if (empty) return
        downloadText(filename, text)
      }}>
        文書をダウンロード
      </Button>
    </div>
  )
}
