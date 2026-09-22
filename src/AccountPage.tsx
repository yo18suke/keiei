import { useState, type FormEvent } from 'react'
import { asset } from './assets'
import { useAuth } from './auth'
import { GoogleSignInButton } from './GoogleSignInButton'
import { googleClientId, googleLoginNeedsNewTab, isLikelyClientId, saveGoogleClientId } from './googleAuth'
import { CalendarLink } from './CalendarLink'
import { useStore } from './store'
import { Button } from './ui'

export function AccountPage({
  onEnter,
  onBack,
}: {
  onEnter: () => void
  onBack: () => void
}) {
  const { user, status, signOut, driveReady, connectDrive, error } = useAuth()
  const { flushCloud } = useStore()
  const [clientId, setClientId] = useState(googleClientId)
  const [draftId, setDraftId] = useState(clientId)
  const working = status === 'working'

  async function submitClientId(event: FormEvent) {
    event.preventDefault()
    if (!isLikelyClientId(draftId)) {
      window.alert('クライアントIDは xxxxx.apps.googleusercontent.com の形です。')
      return
    }
    saveGoogleClientId(draftId)
    setClientId(googleClientId())
  }

  return (
    <div className="account-page">
      <header className="lp-bar">
        <button type="button" className="brand brand-link" onClick={onBack}>
          <img className="logo" src={asset('logo.svg')} width="32" height="32" alt="" />
          <div>
            <p className="wordmark">リフレクションパレット</p>
            <p className="tag">日々の振り返り</p>
          </div>
        </button>
        <Button variant="quiet" onClick={onBack}>
          戻る
        </Button>
      </header>

      <main className="account-main">
        <p className="kicker">アカウント</p>
        <h1>{user ? '同期しています' : 'Google で入って、どの端末でも同じ内容に触れる'}</h1>
        <p className="account-lead muted">
          Google のシングルサインオンです。同じアカウントなら、スマホとパソコンで同じ棚が開きます。書いた振り返りは Google ドライブに残します。
        </p>

        {user ? (
          <div className="account-card">
            <p className="field-label">ログイン中</p>
            <p className="account-email">{user.email}</p>
            {driveReady ? (
              <p className="muted">Google ドライブとつながっています。</p>
            ) : (
              <p className="muted">いまはこの端末だけです。他の端末と揃えるときはドライブをつないでください。</p>
            )}
            {error ? <p className="account-error">{error}</p> : null}
            <div className="row-actions">
              {driveReady ? null : (
                <Button variant="primary" disabled={working} onClick={() => void connectDrive()}>
                  {working ? '接続しています…' : 'ドライブとつなぐ'}
                </Button>
              )}
              <Button variant="primary" onClick={onEnter}>
                アプリを開く
              </Button>
              <Button
                variant="quiet"
                disabled={working}
                onClick={async () => {
                  await flushCloud()
                  await signOut()
                }}
              >
                ログアウト
              </Button>
            </div>
            <CalendarLink />
          </div>
        ) : (
          <div className="account-card">
            {!clientId ? (
              <form className="google-setup" onSubmit={submitClientId}>
                <p className="muted">
                  初回だけ、Google Cloud のウェブクライアントIDを入れます。本番では公開URLの生成元（例 https://reflection-palette.pages.dev）を JavaScript 生成元に追加してください。
                </p>
                <div className="case-new">
                  <input
                    value={draftId}
                    placeholder="xxxxx.apps.googleusercontent.com"
                    aria-label="GoogleクライアントID"
                    autoComplete="off"
                    onChange={(event) => setDraftId(event.target.value)}
                  />
                  <Button type="submit" variant="primary">
                    保存
                  </Button>
                </div>
              </form>
            ) : (
              <div className="account-actions">
                {googleLoginNeedsNewTab() ? (
                  <>
                    <p className="muted">
                      この埋め込みプレビューでは Google のログイン窓が開きません。アドレスを新しいタブで開いてください。
                    </p>
                    <Button
                      variant="quiet"
                      onClick={() => {
                        window.open(window.location.href, '_blank', 'noopener')
                      }}
                    >
                      新しいタブで開く
                    </Button>
                  </>
                ) : null}
                <GoogleSignInButton key={clientId} onSignedIn={onEnter} />
                <Button variant="quiet" onClick={onEnter}>
                  この端末だけで続ける
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
