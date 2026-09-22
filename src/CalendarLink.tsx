import { useEffect, useState } from 'react'
import { listTaskLists, type GoogleTaskList } from './calendar'
import { useAuth } from './auth'
import { useStore } from './store'
import { calendarLinksOf } from './types'
import { Button } from './ui'

function summaryOf(linkCount: number, listTitles: string[]) {
  if (listTitles.length === 1) return listTitles[0]
  if (listTitles.length > 1) return `${listTitles.length}件のリスト`
  if (linkCount > 0) return 'リストを選ぶ'
  return 'つながっていない'
}

export function CalendarLink() {
  const { user, tasksUsers, status, error, connectCalendar, disconnectCalendar } = useAuth()
  const { state, upsertCalendarLink, clearCalendarList, removeCalendarAccount } = useStore()
  const [open, setOpen] = useState(false)
  const [listsByEmail, setListsByEmail] = useState<Record<string, GoogleTaskList[]>>({})
  const [loadingEmail, setLoadingEmail] = useState('')
  const [localError, setLocalError] = useState('')
  const working = status === 'working' || Boolean(loadingEmail)
  const links = calendarLinksOf(state)
  const emails = tasksUsers.map((row) => row.email).join('|')
  const listTitles = links.filter((row) => row.listTitle).map((row) => row.listTitle)
  const summary = summaryOf(tasksUsers.length, listTitles)

  useEffect(() => {
    const orphan = links.find((row) => !row.accountEmail)
    if (!orphan || !tasksUsers.length) return
    const taken = new Set(links.filter((row) => row.accountEmail).map((row) => row.accountEmail.toLowerCase()))
    const target = tasksUsers.find((row) => !taken.has(row.email.toLowerCase())) ?? tasksUsers[0]
    upsertCalendarLink({ ...orphan, accountEmail: target.email })
    clearCalendarList('')
  }, [clearCalendarList, links, tasksUsers, upsertCalendarLink])

  useEffect(() => {
    if (!user || !tasksUsers.length) {
      setListsByEmail({})
      return
    }
    let cancelled = false
    void (async () => {
      const next: Record<string, GoogleTaskList[]> = {}
      for (const account of tasksUsers) {
        setLoadingEmail(account.email)
        try {
          next[account.email] = await listTaskLists(account.email, false)
        } catch (caught) {
          if (!cancelled) {
            setLocalError(caught instanceof Error ? caught.message : 'タスクリストを読めませんでした')
          }
        }
      }
      if (!cancelled) {
        setListsByEmail(next)
        if (Object.keys(next).length) setLocalError('')
        setLoadingEmail('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [emails, tasksUsers, user])

  async function addAccount() {
    setLocalError('')
    const ok = await connectCalendar()
    if (ok) setOpen(true)
  }

  async function dropAccount(email: string) {
    setLocalError('')
    removeCalendarAccount(email)
    setListsByEmail((prev) => {
      const next = { ...prev }
      delete next[email]
      return next
    })
    await disconnectCalendar(email)
  }

  function pickList(email: string, listId: string, lists: GoogleTaskList[]) {
    const picked = lists.find((row) => row.id === listId)
    if (!picked) {
      clearCalendarList(email)
      return
    }
    upsertCalendarLink({ accountEmail: email, listId: picked.id, listTitle: picked.title })
  }

  if (!user) {
    return (
      <section className="calendar-link calendar-link-closed">
        <p className="kicker">GoogleカレンダーのToDo</p>
        <p className="muted">
          ログインすると、TODOをカレンダーに出せます。<a href="#login">ログイン</a>
        </p>
      </section>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        className="calendar-link-toggle"
        aria-expanded={false}
        disabled={working}
        onClick={() => {
          if (tasksUsers.length) setOpen(true)
          else void addAccount()
        }}
      >
        <span>
          <strong>GoogleカレンダーのToDo</strong>
          <span className="muted"> {summary}</span>
        </span>
        <span>{tasksUsers.length ? '設定' : working ? '接続しています…' : 'つなぐ'}</span>
      </button>
    )
  }

  return (
    <section className="calendar-link">
      <div className="calendar-link-head">
        <div>
          <p className="kicker">GoogleカレンダーのToDo</p>
          <h3>連携の設定</h3>
        </div>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          閉じる
        </Button>
      </div>
      {error || localError ? <p className="account-error">{error || localError}</p> : null}
      {tasksUsers.length ? (
        <ul className="calendar-link-accounts">
          {tasksUsers.map((account) => {
            const lists = listsByEmail[account.email] ?? []
            const link = links.find((row) => row.accountEmail.toLowerCase() === account.email.toLowerCase())
            return (
              <li key={account.email} className="calendar-link-row">
                <label className="calendar-link-pick">
                  <span className="field-label">{account.email}</span>
                  <select
                    value={link?.listId ?? ''}
                    aria-label={`${account.email} のタスクリスト`}
                    disabled={working || lists.length === 0}
                    onChange={(event) => pickList(account.email, event.target.value, lists)}
                  >
                    <option value="">選んでいない</option>
                    {lists.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                        {row.primary ? '（メイン）' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="quiet" disabled={working} onClick={() => void dropAccount(account.email)}>
                  外す
                </Button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">まだつながっていません。</p>
      )}
      <Button variant="quiet" disabled={working} onClick={() => void addAccount()}>
        {working ? '接続しています…' : tasksUsers.length ? 'アカウントを追加' : 'タスク用アカウントを選ぶ'}
      </Button>
    </section>
  )
}
