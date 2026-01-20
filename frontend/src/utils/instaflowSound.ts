const STORAGE_KEY = 'systemflow:instaflow:newPostSound:enabled'

let audioContext: AudioContext | null = null

export function isInstaFlowSoundEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return true
    return raw === '1'
  } catch {
    return true
  }
}

export function setInstaFlowSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('systemflow:instaflowSound', { detail: enabled }))
  } catch {}
}

export async function primeInstaFlowAudio() {
  try {
    audioContext = audioContext ?? new AudioContext()
    if (audioContext.state === 'suspended') await audioContext.resume()
  } catch {}
}

export async function playInstaFlowNewPostSound() {
  if (!isInstaFlowSoundEnabled()) return
  await primeInstaFlowAudio()
  const ctx = audioContext
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.18)
  } catch {}
}

