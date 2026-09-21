import { asset } from './assets'
import { useAuth } from './auth'
import { Button } from './ui'

const FEATURES = [
  {
    id: 'today',
    kicker: '今日',
    title: '自由に書いて、整える',
    body: '形は問わないメモと、やったこと・学んだこと・意識すること。',
    figure: 'today',
  },
  {
    id: 'organize',
    kicker: '整理',
    title: '仕事の棚を動かす',
    body: '案件とカードを、進捗中・未完了・完了へ置く。',
    figure: 'organize',
  },
  {
    id: 'review',
    kicker: 'まとめ',
    title: '週と月で束ねる',
    body: '日々の記入を並べて、振り返りを足す。',
    figure: 'review',
  },
  {
    id: 'history',
    kicker: '履歴',
    title: '書いたものを見返す',
    body: '見返して、コピーやドキュメントに残す。',
    figure: 'history',
  },
] as const

const PROBLEMS = [
  {
    title: '振り返りが散らばる',
    body: 'メモは残っても、あとから束ねられない。',
    figure: 'scatter',
  },
  {
    title: '学びが残らない',
    body: 'やったことは覚えていても、理由までは残らない。',
    figure: 'fade',
  },
  {
    title: '仕事の棚が頭の中だけ',
    body: '次に手を付けることが、見えない。',
    figure: 'hidden',
  },
] as const

const EXTRAS = [
  { title: '音声入力', body: '話した内容が、そのままメモに入る。', figure: 'mic' },
  { title: 'どの端末でも同じ', body: 'Googleアカウントで入り、書いたものを同期する。', figure: 'save' },
  { title: 'ドキュメントへ', body: 'コピーして貼るか、Google ドキュメントに送る。', figure: 'doc' },
] as const

const STEPS = [
  { n: '1', color: 'coral', title: '書く、または話す', body: '今日のメモを、思ったまま置く。' },
  { n: '2', color: 'indigo', title: '整える', body: 'やったこと、学んだこと、意識することを分ける。' },
  { n: '3', color: 'gold', title: '週と月で束ねる', body: '残すことだけを、振り返りに足す。' },
] as const

const WELLS = [
  { id: 'today', label: '今日' },
  { id: 'review', label: 'まとめ' },
  { id: 'history', label: '履歴' },
  { id: 'organize', label: '整理' },
] as const

export function LandingPage({
  onStart,
  onAccount,
}: {
  onStart: () => void
  onAccount: () => void
}) {
  const { user } = useAuth()
  return (
    <div className="lp">
      <header className="lp-bar">
        <div className="brand">
          <img className="logo" src={asset('logo.svg')} width="32" height="32" alt="" />
          <div>
            <p className="wordmark">リフレクションパレット</p>
            <p className="tag">日々の振り返り</p>
          </div>
        </div>
        <div className="lp-bar-actions">
          {user ? (
            <Button variant="primary" onClick={onStart}>
              アプリを開く
            </Button>
          ) : (
            <>
              <Button variant="quiet" onClick={onStart}>
                この端末だけで始める
              </Button>
              <Button variant="primary" onClick={onAccount}>
                登録・ログイン
              </Button>
            </>
          )}
        </div>
      </header>

      <section className="lp-hero">
        <i className="lp-blob coral" aria-hidden />
        <i className="lp-blob indigo" aria-hidden />
        <i className="lp-blob green" aria-hidden />
        <i className="lp-blob gold" aria-hidden />
        <div className="lp-hero-copy">
          <p className="kicker">日々の振り返り</p>
          <h1>リフレクションパレット</h1>
          <p className="lp-lead">思ったことを書いて、仕事を整え、週と月で束ねる。登録すると、どの端末でも同じ内容に触れます。</p>
          {user ? (
            <Button variant="primary" onClick={onStart}>
              アプリを開く
            </Button>
          ) : (
            <div className="lp-hero-actions">
              <Button variant="primary" onClick={onAccount}>
                登録・ログイン
              </Button>
              <Button variant="quiet" onClick={onStart}>
                この端末だけで始める
              </Button>
            </div>
          )}
        </div>
        <div className="lp-hero-art" aria-hidden>
          <div className="lp-palette">
            {WELLS.map((well) => (
              <div key={well.id} className={`lp-well ${well.id}`}>
                <i className={`nav-dot ${well.id}`} />
                <span>{well.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="lp-main">
        <section className="lp-block">
          <header className="lp-block-head">
            <p className="kicker">いま</p>
            <h2>振り返りが、残らない</h2>
          </header>
          <ul className="lp-cards">
            {PROBLEMS.map((item) => (
              <li key={item.title} className={`lp-card lp-card-problem ${item.figure}`}>
                <ProblemFigure kind={item.figure} />
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-block">
          <header className="lp-block-head">
            <p className="kicker">できること</p>
            <h2>四つの画面で続ける</h2>
          </header>
          <ul className="lp-cards lp-cards-4">
            {FEATURES.map((item) => (
              <li key={item.id} className={`lp-card lp-card-feature ${item.id}`}>
                <ScreenFigure kind={item.figure} />
                <p className="kicker">
                  <i className={`nav-dot ${item.id}`} aria-hidden />
                  {item.kicker}
                </p>
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-block">
          <header className="lp-block-head">
            <p className="kicker">あわせて</p>
            <h2>書く以外のことも、少なく</h2>
          </header>
          <ul className="lp-cards">
            {EXTRAS.map((item) => (
              <li key={item.title} className="lp-card lp-card-extra">
                <ExtraFigure kind={item.figure} />
                <h3>{item.title}</h3>
                <p className="muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-block">
          <header className="lp-block-head">
            <p className="kicker">使い方</p>
            <h2>書く、整える、束ねる</h2>
          </header>
          <ol className="lp-steps">
            {STEPS.map((item) => (
              <li key={item.n} className={`lp-step ${item.color}`}>
                <span className="lp-step-n" aria-hidden>
                  {item.n}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p className="muted">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-foot-mark" aria-hidden>
          <i className="opening-dot coral" />
          <i className="opening-dot indigo" />
          <i className="opening-dot green" />
          <i className="opening-dot gold" />
        </div>
        <p className="muted">
          {user
            ? `${user.email} で同期しています。`
            : '登録すると、スマホとパソコンで同じ振り返りに触れます。'}
        </p>
        <Button variant="primary" onClick={user ? onStart : onAccount}>
          {user ? 'アプリを開く' : '登録・ログイン'}
        </Button>
      </footer>
    </div>
  )
}

function ProblemFigure({ kind }: { kind: (typeof PROBLEMS)[number]['figure'] }) {
  return (
    <svg className="lp-draw" viewBox="0 0 160 72" aria-hidden>
      {kind === 'scatter' ? (
        <>
          <circle cx="22" cy="28" r="8" fill="#f06a6a" />
          <circle cx="78" cy="18" r="6" fill="#796eff" />
          <circle cx="118" cy="40" r="7" fill="#25aa61" />
          <circle cx="48" cy="54" r="5" fill="#f4b942" />
          <circle cx="142" cy="22" r="4" fill="#f06a6a" opacity="0.55" />
          <circle cx="96" cy="58" r="4.5" fill="#796eff" opacity="0.45" />
        </>
      ) : null}
      {kind === 'fade' ? (
        <>
          <rect x="18" y="22" width="124" height="10" rx="5" fill="#eadcc8" />
          <rect x="18" y="40" width="88" height="10" rx="5" fill="#eadcc8" opacity="0.55" />
          <rect x="18" y="58" width="52" height="8" rx="4" fill="#eadcc8" opacity="0.28" />
          <circle cx="132" cy="27" r="7" fill="#796eff" />
        </>
      ) : null}
      {kind === 'hidden' ? (
        <>
          <rect x="44" y="14" width="72" height="44" rx="8" fill="#f4b942" opacity="0.35" />
          <rect x="36" y="20" width="72" height="44" rx="8" fill="#fff" stroke="#eadcc8" />
          <rect x="28" y="26" width="72" height="44" rx="8" fill="#1e1f21" />
          <rect x="40" y="40" width="36" height="6" rx="3" fill="#f7f3ec" opacity="0.5" />
          <rect x="40" y="52" width="24" height="6" rx="3" fill="#f7f3ec" opacity="0.28" />
        </>
      ) : null}
    </svg>
  )
}

function ScreenFigure({ kind }: { kind: (typeof FEATURES)[number]['figure'] }) {
  return (
    <svg className="lp-draw lp-draw-screen" viewBox="0 0 200 92" aria-hidden>
      {kind === 'today' ? (
        <>
          <rect x="8" y="8" width="184" height="76" rx="12" fill="#fff1f1" />
          <rect x="20" y="20" width="88" height="8" rx="4" fill="#f06a6a" opacity="0.85" />
          <rect x="20" y="38" width="160" height="28" rx="8" fill="#fff" />
          <rect x="20" y="72" width="48" height="6" rx="3" fill="#f06a6a" opacity="0.35" />
          <rect x="76" y="72" width="48" height="6" rx="3" fill="#f06a6a" opacity="0.22" />
        </>
      ) : null}
      {kind === 'organize' ? (
        <>
          <rect x="8" y="8" width="56" height="76" rx="10" fill="#fff8e6" />
          <rect x="72" y="8" width="56" height="76" rx="10" fill="#fff1c2" />
          <rect x="136" y="8" width="56" height="76" rx="10" fill="#f4b942" opacity="0.28" />
          <rect x="16" y="20" width="40" height="18" rx="6" fill="#fff" />
          <rect x="16" y="44" width="40" height="18" rx="6" fill="#fff" />
          <rect x="80" y="20" width="40" height="28" rx="6" fill="#fff" />
          <rect x="144" y="20" width="40" height="14" rx="6" fill="#fff" />
        </>
      ) : null}
      {kind === 'review' ? (
        <>
          <rect x="8" y="8" width="184" height="76" rx="12" fill="#f3f1ff" />
          <rect x="20" y="20" width="76" height="52" rx="10" fill="#fff" />
          <rect x="104" y="20" width="76" height="52" rx="10" fill="#fff" />
          <rect x="32" y="32" width="40" height="6" rx="3" fill="#796eff" />
          <rect x="32" y="46" width="52" height="6" rx="3" fill="#796eff" opacity="0.35" />
          <rect x="116" y="32" width="40" height="6" rx="3" fill="#796eff" />
          <rect x="116" y="46" width="36" height="6" rx="3" fill="#796eff" opacity="0.35" />
        </>
      ) : null}
      {kind === 'history' ? (
        <>
          <rect x="8" y="8" width="184" height="76" rx="12" fill="#eaf8ef" />
          <rect x="20" y="18" width="160" height="18" rx="6" fill="#fff" />
          <rect x="20" y="40" width="160" height="18" rx="6" fill="#fff" />
          <rect x="20" y="62" width="160" height="18" rx="6" fill="#fff" />
          <circle cx="34" cy="27" r="4" fill="#25aa61" />
          <circle cx="34" cy="49" r="4" fill="#25aa61" opacity="0.55" />
          <circle cx="34" cy="71" r="4" fill="#25aa61" opacity="0.3" />
        </>
      ) : null}
    </svg>
  )
}

function ExtraFigure({ kind }: { kind: (typeof EXTRAS)[number]['figure'] }) {
  return (
    <svg className="lp-draw lp-draw-icon" viewBox="0 0 48 48" aria-hidden>
      {kind === 'mic' ? (
        <>
          <circle cx="24" cy="24" r="22" fill="#fff1f1" />
          <rect x="19" y="12" width="10" height="16" rx="5" fill="#f06a6a" />
          <path d="M16 24v2a8 8 0 0 0 16 0v-2" stroke="#f06a6a" strokeWidth="2.4" fill="none" />
          <path d="M24 34v4" stroke="#f06a6a" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : null}
      {kind === 'save' ? (
        <>
          <rect x="4" y="4" width="40" height="40" rx="12" fill="#f3f1ff" />
          <rect x="14" y="14" width="20" height="20" rx="5" fill="#796eff" />
          <rect x="18" y="18" width="12" height="8" rx="2" fill="#fff" />
        </>
      ) : null}
      {kind === 'doc' ? (
        <>
          <rect x="8" y="6" width="32" height="36" rx="6" fill="#eaf8ef" />
          <rect x="14" y="14" width="20" height="3.5" rx="1.75" fill="#25aa61" />
          <rect x="14" y="22" width="16" height="3.5" rx="1.75" fill="#25aa61" opacity="0.55" />
          <rect x="14" y="30" width="12" height="3.5" rx="1.75" fill="#25aa61" opacity="0.3" />
        </>
      ) : null}
    </svg>
  )
}
