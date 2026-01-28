import systemAlertUrl from '@/assets/sounds/system-alert.mp3'
import chatNotificationUrl from '@/assets/sounds/chat-notification.mp3'

let audioContext: AudioContext | null = null
let systemAudioBase: HTMLAudioElement | null = null
let chatAudioBase: HTMLAudioElement | null = null

function emitSoundDebug(detail: { type: 'system' | 'chat'; ok: boolean; at: number; error?: string }) {
  try {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent('systemflow:notificationSound', { detail }))
  } catch {}
}

export async function primeNotificationAudio() {
  try {
    audioContext = audioContext ?? new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
  } catch {}

  try {
    if (typeof Audio === 'undefined') return
    systemAudioBase = systemAudioBase ?? Object.assign(new Audio(systemAlertUrl), { preload: 'auto' })
    chatAudioBase = chatAudioBase ?? Object.assign(new Audio(chatNotificationUrl), { preload: 'auto' })
    systemAudioBase.load()
    chatAudioBase.load()
  } catch {}
}

function scheduleTone(input: {
  type: OscillatorType
  startAt: number
  stopAt: number
  frequency: Array<{ at: number; value: number; ramp?: 'exp' | 'lin' }>
  gain: Array<{ at: number; value: number; ramp?: 'exp' | 'lin' }>
}) {
  const ctx = audioContext
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = input.type
  for (const step of input.frequency) {
    if (step.ramp === 'exp') osc.frequency.exponentialRampToValueAtTime(step.value, step.at)
    else if (step.ramp === 'lin') osc.frequency.linearRampToValueAtTime(step.value, step.at)
    else osc.frequency.setValueAtTime(step.value, step.at)
  }

  for (const step of input.gain) {
    if (step.ramp === 'exp') gain.gain.exponentialRampToValueAtTime(step.value, step.at)
    else if (step.ramp === 'lin') gain.gain.linearRampToValueAtTime(step.value, step.at)
    else gain.gain.setValueAtTime(step.value, step.at)
  }

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(input.startAt)
  osc.stop(input.stopAt)
}

export async function playSystemAlertSound() {
  await primeNotificationAudio()

  try {
    if (typeof Audio !== 'undefined') {
      const base = systemAudioBase ?? Object.assign(new Audio(systemAlertUrl), { preload: 'auto' })
      systemAudioBase = base
      base.pause()
      base.currentTime = 0
      base.volume = 0.75
      await base.play()
      emitSoundDebug({ type: 'system', ok: true, at: Date.now() })
      return
    }
  } catch (err) {
    emitSoundDebug({ type: 'system', ok: false, at: Date.now(), error: err instanceof Error ? err.message : String(err) })
  }

  const ctx = audioContext
  if (!ctx) {
    emitSoundDebug({ type: 'system', ok: false, at: Date.now(), error: 'no_audio_context' })
    return
  }

  try {
    const now = ctx.currentTime
    scheduleTone({
      type: 'triangle',
      startAt: now,
      stopAt: now + 0.36,
      frequency: [
        { at: now, value: 880 },
        { at: now + 0.08, value: 660, ramp: 'exp' },
        { at: now + 0.14, value: 520, ramp: 'exp' },
        { at: now + 0.18, value: 520 },
        { at: now + 0.26, value: 440, ramp: 'exp' },
      ],
      gain: [
        { at: now, value: 0.0001 },
        { at: now + 0.02, value: 0.05, ramp: 'exp' },
        { at: now + 0.14, value: 0.0001, ramp: 'exp' },
        { at: now + 0.18, value: 0.0001 },
        { at: now + 0.2, value: 0.045, ramp: 'exp' },
        { at: now + 0.34, value: 0.0001, ramp: 'exp' },
      ],
    })
    emitSoundDebug({ type: 'system', ok: true, at: Date.now() })
  } catch {}
}

export async function playChatMessageSound() {
  await primeNotificationAudio()

  try {
    if (typeof Audio !== 'undefined') {
      const base = chatAudioBase ?? Object.assign(new Audio(chatNotificationUrl), { preload: 'auto' })
      chatAudioBase = base
      base.pause()
      base.currentTime = 0
      base.volume = 0.7
      await base.play()
      emitSoundDebug({ type: 'chat', ok: true, at: Date.now() })
      return
    }
  } catch (err) {
    emitSoundDebug({ type: 'chat', ok: false, at: Date.now(), error: err instanceof Error ? err.message : String(err) })
  }

  const ctx = audioContext
  if (!ctx) {
    emitSoundDebug({ type: 'chat', ok: false, at: Date.now(), error: 'no_audio_context' })
    return
  }

  try {
    const now = ctx.currentTime
    scheduleTone({
      type: 'sine',
      startAt: now,
      stopAt: now + 0.18,
      frequency: [
        { at: now, value: 640 },
        { at: now + 0.06, value: 880, ramp: 'exp' },
      ],
      gain: [
        { at: now, value: 0.0001 },
        { at: now + 0.02, value: 0.035, ramp: 'exp' },
        { at: now + 0.16, value: 0.0001, ramp: 'exp' },
      ],
    })
    emitSoundDebug({ type: 'chat', ok: true, at: Date.now() })
  } catch {}
}
