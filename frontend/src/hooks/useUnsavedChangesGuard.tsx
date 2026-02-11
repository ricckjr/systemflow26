import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { UnsavedChangesModal } from '@/components/ui/UnsavedChangesModal'

type SaveFn = () => Promise<boolean> | boolean

export function useUnsavedChangesGuard(opts: { when: boolean; onSave?: SaveFn }) {
  const { when, onSave } = opts
  const blocker = useBlocker(when)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (blocker.state === 'blocked') setOpen(true)
  }, [blocker.state])

  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  const stay = useCallback(() => {
    setOpen(false)
    blocker.reset()
  }, [blocker])

  const discard = useCallback(() => {
    setOpen(false)
    blocker.proceed()
  }, [blocker])

  const saveAndExit = useCallback(async () => {
    if (!onSave) return discard()
    setSaving(true)
    try {
      const ok = await onSave()
      if (!ok) return
      setOpen(false)
      blocker.proceed()
    } finally {
      setSaving(false)
    }
  }, [blocker, discard, onSave])

  const modal = useMemo(
    () => (
      <UnsavedChangesModal
        isOpen={open}
        onClose={stay}
        onDiscard={discard}
        onSaveAndExit={saveAndExit}
        saving={saving}
      />
    ),
    [discard, open, saveAndExit, saving, stay]
  )

  return { modal, open }
}

