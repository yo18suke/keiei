import { useEffect, useRef, useState } from 'react'

type Rec = {
  lang: string
  continuous: boolean
  interimResults: boolean
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

let shared: Rec | null = null
let keepAlive = false

function recCtor(): RecCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecCtor
    webkitSpeechRecognition?: RecCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechSupported() {
  return recCtor() !== null
}

export function appendSpoken(current: string, incoming: string) {
  const next = incoming.trim()
  if (!next) return current
  const prev = current.trimEnd()
  if (!prev) return next
  const glue = /[。！？\n]$/.test(prev) ? '' : ' '
  return `${prev}${glue}${next}`
}

export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => {
    return () => {
      keepAlive = false
      shared?.abort()
      shared = null
    }
  }, [])

  function stop() {
    keepAlive = false
    setListening(false)
    setInterim('')
    shared?.stop()
  }

  function start() {
    const Ctor = recCtor()
    if (!Ctor) {
      setError('このブラウザでは音声入力が使えません')
      return
    }
    setError('')
    keepAlive = true
    shared?.abort()
    const rec = new Ctor()
    shared = rec
    rec.lang = 'ja-JP'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (event) => {
      let finals = ''
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript
        if (event.results[i].isFinal) finals += piece
        else live += piece
      }
      if (finals.trim()) onFinalRef.current(finals)
      setInterim(live.trim())
    }
    rec.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'not-allowed') {
        setError('マイクの使用を許可してください')
      } else if (event.error === 'network') {
        setError('音声認識にネットが必要です')
      } else {
        setError('うまく聞き取れませんでした')
      }
      keepAlive = false
      setListening(false)
    }
    rec.onend = () => {
      if (keepAlive && shared === rec) {
        try {
          rec.start()
        } catch {
          setListening(false)
        }
        return
      }
      if (shared === rec) shared = null
      setListening(false)
      setInterim('')
    }
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('音声入力を開始できませんでした')
      keepAlive = false
    }
  }

  return {
    supported: isSpeechSupported(),
    listening,
    interim,
    error,
    toggle() {
      if (listening) stop()
      else start()
    },
  }
}
