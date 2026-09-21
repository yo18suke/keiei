import { useEffect, useId, useRef, useState } from 'react'

type Rec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: RecEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecEvent = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type RecCtor = new () => Rec

type Handlers = {
  onFinal: (text: string) => void
  onInterim: (text: string) => void
  onError: (text: string) => void
  onListening: (on: boolean) => void
}

let rec: Rec | null = null
let stream: MediaStream | null = null
let activeId = ''
let wantListen = false
let restartTimer = 0
let lastFinal = ''
let lastFinalAt = 0
let handlers: Handlers | null = null

function recCtor(): RecCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function canUseContinuous() {
  return !isIOS() && /Chrome|Edg|Chromium/i.test(navigator.userAgent) && !/OPR|Opera/i.test(navigator.userAgent)
}

export function isSpeechSupported() {
  return recCtor() !== null
}

export function appendSpoken(current: string, incoming: string) {
  const next = incoming.trim()
  if (!next) return current
  const prev = current.trimEnd()
  if (!prev) return next
  const glue = /[。．！？!?\n]$/.test(prev) ? '' : ' '
  return `${prev}${glue}${next}`
}

function stopStream() {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
}

function stopRecognition() {
  wantListen = false
  window.clearTimeout(restartTimer)
  const current = rec
  rec = null
  activeId = ''
  try {
    current?.stop()
  } catch {
    /* already stopped */
  }
  stopStream()
  handlers?.onListening(false)
  handlers?.onInterim('')
}

function errorMessage(code: string) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'マイクの使用を許可してください'
  if (code === 'audio-capture') return 'マイクを見つけられませんでした'
  if (code === 'network') return '音声認識にネットが必要です'
  if (code === 'no-speech') return ''
  if (code === 'aborted') return ''
  return 'うまく聞き取れませんでした'
}

function attachRec(instance: Rec) {
  instance.lang = 'ja-JP'
  instance.continuous = canUseContinuous()
  instance.interimResults = true
  instance.maxAlternatives = 1
  instance.onresult = (event) => {
    if (rec !== instance) return
    let finals = ''
    let live = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript
      if (event.results[i].isFinal) finals += piece
      else live += piece
    }
    const spoken = finals.trim()
    if (spoken) {
      const now = Date.now()
      if (spoken !== lastFinal || now - lastFinalAt > 800) {
        lastFinal = spoken
        lastFinalAt = now
        handlers?.onFinal(spoken)
      }
      handlers?.onInterim('')
    } else {
      handlers?.onInterim(live.trim())
    }
  }
  instance.onerror = (event) => {
    if (rec !== instance) return
    const message = errorMessage(event.error)
    if (event.error === 'no-speech' || event.error === 'aborted') return
    if (message) handlers?.onError(message)
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') {
      wantListen = false
    }
  }
  instance.onend = () => {
    if (rec !== instance) return
    if (wantListen) {
      window.clearTimeout(restartTimer)
      restartTimer = window.setTimeout(() => {
        if (!wantListen || rec !== instance) return
        try {
          instance.start()
        } catch {
          const Ctor = recCtor()
          if (!Ctor || !wantListen) {
            stopRecognition()
            return
          }
          const next = new Ctor()
          rec = next
          attachRec(next)
          try {
            next.start()
          } catch {
            stopRecognition()
            handlers?.onError('音声入力を開始できませんでした')
          }
        }
      }, 280)
      return
    }
    rec = null
    stopStream()
    handlers?.onListening(false)
    handlers?.onInterim('')
  }
}

async function begin(id: string, next: Handlers) {
  const Ctor = recCtor()
  if (!Ctor) {
    next.onError('このブラウザでは音声入力が使えません。Chrome か Safari で開いてください。')
    return
  }
  if (!window.isSecureContext) {
    next.onError('HTTPS のページで使ってください')
    return
  }

  stopRecognition()
  handlers = next
  activeId = id
  wantListen = true
  next.onError('')
  next.onInterim('')

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    wantListen = false
    activeId = ''
    next.onError('マイクの使用を許可してください')
    next.onListening(false)
    return
  }

  if (!wantListen || activeId !== id) {
    stopStream()
    return
  }

  const instance = new Ctor()
  rec = instance
  attachRec(instance)
  try {
    instance.start()
    next.onListening(true)
  } catch {
    wantListen = false
    rec = null
    stopStream()
    next.onError('音声入力を開始できませんでした')
    next.onListening(false)
  }
}

export function useDictation(onFinal: (text: string) => void) {
  const id = useId()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const onFinalRef = useRef(onFinal)
  const listeningRef = useRef(false)
  onFinalRef.current = onFinal

  useEffect(() => {
    return () => {
      if (activeId === id) stopRecognition()
    }
  }, [id])

  function toggle() {
    if (listeningRef.current && activeId === id) {
      stopRecognition()
      listeningRef.current = false
      setListening(false)
      setInterim('')
      return
    }
    void begin(id, {
      onFinal: (text) => onFinalRef.current(text),
      onInterim: setInterim,
      onError: setError,
      onListening: (on) => {
        listeningRef.current = on
        setListening(on)
        if (on) setError('')
      },
    })
  }

  return {
    supported: typeof window !== 'undefined' && isSpeechSupported(),
    listening,
    interim,
    error,
    toggle,
  }
}
