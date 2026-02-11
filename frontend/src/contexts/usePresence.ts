import { useContext } from 'react'
import { PresenceContext } from '@/contexts/PresenceContextCore'

export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within PresenceProvider')
  return ctx
}
