import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationPreferencesContext } from '@/contexts/NotificationPreferencesContextCore'
import type {
  NotificationChannelKey,
  NotificationChannelPreferences,
  NotificationPreferences,
} from '@/contexts/NotificationPreferencesContextCore'

const DEFAULT_PREFERENCES: NotificationPreferences = {
  system: { inAppEnabled: true, soundEnabled: true, nativeEnabled: false, pushEnabled: false },
  chat: { inAppEnabled: true, soundEnabled: true, nativeEnabled: false, pushEnabled: false },
  permissionPromptDismissedUntil: null,
}

function storageKey(userId: string) {
  return `systemflow:notificationPreferences:v1:${userId}`
}

function mergePreferences(base: NotificationPreferences, patch: Partial<NotificationPreferences>): NotificationPreferences {
  return {
    system: { ...base.system, ...(patch.system ?? {}) },
    chat: { ...base.chat, ...(patch.chat ?? {}) },
    permissionPromptDismissedUntil:
      patch.permissionPromptDismissedUntil !== undefined ? patch.permissionPromptDismissedUntil : base.permissionPromptDismissedUntil,
  }
}

function fromDbRow(row: any): NotificationPreferences {
  return {
    system: {
      inAppEnabled: row?.system_in_app_enabled ?? DEFAULT_PREFERENCES.system.inAppEnabled,
      soundEnabled: row?.system_sound_enabled ?? DEFAULT_PREFERENCES.system.soundEnabled,
      nativeEnabled: row?.system_native_enabled ?? DEFAULT_PREFERENCES.system.nativeEnabled,
      pushEnabled: row?.system_push_enabled ?? DEFAULT_PREFERENCES.system.pushEnabled,
    },
    chat: {
      inAppEnabled: row?.chat_in_app_enabled ?? DEFAULT_PREFERENCES.chat.inAppEnabled,
      soundEnabled: row?.chat_sound_enabled ?? DEFAULT_PREFERENCES.chat.soundEnabled,
      nativeEnabled: row?.chat_native_enabled ?? DEFAULT_PREFERENCES.chat.nativeEnabled,
      pushEnabled: row?.chat_push_enabled ?? DEFAULT_PREFERENCES.chat.pushEnabled,
    },
    permissionPromptDismissedUntil: row?.permission_prompt_dismissed_until ?? null,
  }
}

function toDbPatch(preferences: Partial<NotificationPreferences>) {
  const row: Record<string, any> = {}

  if (preferences.system) {
    if (preferences.system.inAppEnabled !== undefined) row.system_in_app_enabled = preferences.system.inAppEnabled
    if (preferences.system.soundEnabled !== undefined) row.system_sound_enabled = preferences.system.soundEnabled
    if (preferences.system.nativeEnabled !== undefined) row.system_native_enabled = preferences.system.nativeEnabled
    if (preferences.system.pushEnabled !== undefined) row.system_push_enabled = preferences.system.pushEnabled
  }
  if (preferences.chat) {
    if (preferences.chat.inAppEnabled !== undefined) row.chat_in_app_enabled = preferences.chat.inAppEnabled
    if (preferences.chat.soundEnabled !== undefined) row.chat_sound_enabled = preferences.chat.soundEnabled
    if (preferences.chat.nativeEnabled !== undefined) row.chat_native_enabled = preferences.chat.nativeEnabled
    if (preferences.chat.pushEnabled !== undefined) row.chat_push_enabled = preferences.chat.pushEnabled
  }

  if (preferences.permissionPromptDismissedUntil !== undefined) {
    row.permission_prompt_dismissed_until = preferences.permissionPromptDismissedUntil
  }

  return row
}

export const NotificationPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth()
  const profileId = profile?.id ?? null

  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    if (!profileId) {
      setPreferences(DEFAULT_PREFERENCES)
      return
    }

    try {
      const raw = localStorage.getItem(storageKey(profileId))
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>
      setPreferences((prev) => mergePreferences(prev, parsed))
    } catch {}
  }, [profileId])

  const persistLocal = useCallback(
    (next: NotificationPreferences) => {
      if (!profileId) return
      try {
        localStorage.setItem(storageKey(profileId), JSON.stringify(next))
      } catch {}
    },
    [profileId]
  )

  const refresh = useCallback(async () => {
    if (!profileId) return

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', profileId)
      .maybeSingle()

    if (error) return

    if (!data) {
      const { error: insertError } = await supabase.from('notification_preferences').insert({ user_id: profileId })
      if (insertError) return
      return
    }

    const next = fromDbRow(data)
    setPreferences(next)
    persistLocal(next)
  }, [persistLocal, profileId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upsertPatch = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!profileId) return
      const dbPatch = toDbPatch(patch)
      const optimistic = mergePreferences(preferences, patch)
      setPreferences(optimistic)
      persistLocal(optimistic)

      await supabase
        .from('notification_preferences')
        .upsert({ user_id: profileId, ...dbPatch }, { onConflict: 'user_id' })
    },
    [persistLocal, preferences, profileId]
  )

  const setChannelPreferences = useCallback(
    async (channel: NotificationChannelKey, next: Partial<NotificationChannelPreferences>) => {
      await upsertPatch({ [channel]: next } as any)
    },
    [upsertPatch]
  )

  const setPermissionPromptDismissedUntil = useCallback(
    async (until: string | null) => {
      await upsertPatch({ permissionPromptDismissedUntil: until })
    },
    [upsertPatch]
  )

  const value = useMemo(
    () => ({
      preferences,
      setChannelPreferences,
      setPermissionPromptDismissedUntil,
      refresh,
    }),
    [preferences, refresh, setChannelPreferences, setPermissionPromptDismissedUntil]
  )

  return <NotificationPreferencesContext.Provider value={value}>{children}</NotificationPreferencesContext.Provider>
}

export type {
  NotificationChannelKey,
  NotificationChannelPreferences,
  NotificationPreferences,
} from '@/contexts/NotificationPreferencesContextCore'
