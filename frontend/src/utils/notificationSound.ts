const STORAGE_KEY = 'systemflow:notificationSound:enabled'

let audioContext: AudioContext | null = null

export function isNotificationSoundEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('systemflow:notificationSound', { detail: enabled }))
  } catch {}
}

export async function primeNotificationAudio() {
  try {
    audioContext = audioContext ?? new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
  } catch {}
}

export async function playNotificationSound() {
  if (!isNotificationSoundEnabled()) return
  await primeNotificationAudio()
  const ctx = audioContext
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(740, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.07)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.16)
  } catch {}
}

