import { todayISO, toISODate } from './dates'
import { readGoogleError, tasksFetch } from './googleAuth'
import { repeatLabel } from './repeat'
import { asDateList, isISODate } from './todos'
import type { CalendarLink, WorkTask } from './types'

const TASKS_API = 'https://tasks.googleapis.com/tasks/v1'

export type GoogleTaskList = {
  id: string
  title: string
  primary?: boolean
}

type ListBody = {
  id?: string
  title?: string
}

type TaskBody = {
  id?: string
  title?: string
  notes?: string
  status?: 'needsAction' | 'completed'
  due?: string | null
  completed?: string | null
  updated?: string
}

export type RemoteGoogleTask = {
  id: string
  completed: boolean
  due?: string
  updatedAt: number
}

function dueStamp(iso?: string) {
  return iso ? `${iso}T00:00:00.000Z` : null
}

export function dueFromGoogle(due?: string | null) {
  if (!due) return undefined
  const day = due.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!day || !isISODate(day)) return undefined
  const time = due.match(/T(\d{2}):(\d{2})/)
  if (!time || (time[1] === '00' && time[2] === '00')) return day
  const at = new Date(due)
  if (Number.isNaN(at.getTime())) return day
  const local = toISODate(at)
  return isISODate(local) ? local : day
}

function isCompleted(task: WorkTask) {
  return !task.repeat && task.lane === 'done'
}

function taskNotes(task: WorkTask, caseName?: string) {
  const bits = [caseName, repeatLabel(task.repeat, task.scheduledOn)].filter(Boolean)
  return bits.join(' · ') || undefined
}

function taskPayload(task: WorkTask, caseName?: string): TaskBody {
  const done = isCompleted(task)
  return {
    title: task.title,
    notes: taskNotes(task, caseName),
    due: dueStamp(task.scheduledOn),
    status: done ? 'completed' : 'needsAction',
    completed: done ? dueStamp(task.doneAt || task.scheduledOn || todayISO()) : null,
  }
}

export async function listTaskLists(email: string, interactive = true) {
  const res = await tasksFetch(`${TASKS_API}/users/@me/lists`, {}, { interactive, email })
  if (!res.ok) throw new Error(await readGoogleError(res, 'タスクリストを読めませんでした'))
  const body = (await res.json()) as { items?: ListBody[] }
  const next: GoogleTaskList[] = []
  for (const item of body.items ?? []) {
    if (!item.id) continue
    next.push({
      id: item.id,
      title: item.title || 'タスク',
      primary: item.title === 'Tasks' || item.title === 'マイタスク',
    })
  }
  return next.sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)) || a.title.localeCompare(b.title, 'ja'))
}

export async function listGoogleTasks(email: string, listId: string) {
  const next: RemoteGoogleTask[] = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({
      showCompleted: 'true',
      showHidden: 'true',
      maxResults: '100',
    })
    if (pageToken) query.set('pageToken', pageToken)
    const res = await tasksFetch(
      `${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks?${query}`,
      {},
      { interactive: false, email },
    )
    if (!res.ok) throw new Error(await readGoogleError(res, 'タスクを読めませんでした'))
    const body = (await res.json()) as { items?: TaskBody[]; nextPageToken?: string }
    for (const item of body.items ?? []) {
      if (!item.id) continue
      next.push({
        id: item.id,
        completed: item.status === 'completed',
        due: dueFromGoogle(item.due),
        updatedAt: item.updated ? Date.parse(item.updated) || 0 : 0,
      })
    }
    pageToken = body.nextPageToken ?? ''
  } while (pageToken)
  return next
}

export function applyRemoteGoogleTask(task: WorkTask, remotes: RemoteGoogleTask[]) {
  if (!remotes.length) return false
  let changed = false
  if (remotes.some((row) => row.completed)) {
    if (task.lane !== 'done' || task.repeat || !task.doneAt) {
      task.lane = 'done'
      task.doneAt = task.doneAt || todayISO()
      task.repeat = undefined
      changed = true
    }
  }
  const winning = remotes
    .filter((row) => row.due)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.due
  if (winning && winning !== task.scheduledOn) {
    task.scheduledOn = winning
    task.plannedDates = asDateList(task.plannedDates, winning)
    changed = true
  }
  return changed
}

export async function deleteGoogleTask(email: string, listId: string, taskId: string) {
  const res = await tasksFetch(
    `${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE' },
    { interactive: false, email },
  )
  if (res.ok || res.status === 204 || res.status === 404 || res.status === 410) return
  throw new Error(await readGoogleError(res, 'カレンダーのタスクを消せませんでした'))
}

export async function upsertGoogleTask(link: CalendarLink, task: WorkTask, caseName?: string) {
  const body = taskPayload(task, caseName)
  const listId = link.listId
  const email = link.accountEmail
  const refs = task.googleTasks?.length
    ? task.googleTasks
    : task.googleTaskId && task.googleTaskListId
      ? [{ accountEmail: email, listId: task.googleTaskListId, taskId: task.googleTaskId }]
      : []
  const mine = refs.find((row) => sameEmail(row.accountEmail, email) && row.listId === listId)
  const leftover = refs.find((row) => sameEmail(row.accountEmail, email) && row.listId !== listId)
  if (leftover) {
    await deleteGoogleTask(email, leftover.listId, leftover.taskId).catch(() => undefined)
  }
  if (mine) {
    const res = await tasksFetch(
      `${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(mine.taskId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      { interactive: false, email },
    )
    if (res.ok) {
      const saved = (await res.json()) as TaskBody
      return { accountEmail: email, listId, taskId: saved.id || mine.taskId }
    }
    if (res.status !== 404 && res.status !== 410) {
      throw new Error(await readGoogleError(res, 'カレンダーのタスクを更新できませんでした'))
    }
  }
  const res = await tasksFetch(
    `${TASKS_API}/lists/${encodeURIComponent(listId)}/tasks`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { interactive: false, email },
  )
  if (!res.ok) throw new Error(await readGoogleError(res, 'カレンダーのタスクを作れませんでした'))
  const saved = (await res.json()) as TaskBody
  if (!saved.id) throw new Error('カレンダーのタスクIDを取得できませんでした')
  return { accountEmail: email, listId, taskId: saved.id }
}

function sameEmail(a?: string, b?: string) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase())
}
