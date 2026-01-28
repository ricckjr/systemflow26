const express = require('express')
const { supabaseAdmin } = require('../supabase')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

router.post('/realtime-test', authenticate, async (req, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const created = { systemNotificationId: null, chatNotificationId: null }

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title: 'Realtime Test',
        content: 'Teste automático de realtime (system).',
        type: 'rt_test',
        is_read: false,
      })
      .select('id')
      .single()

    if (!error && data?.id) created.systemNotificationId = data.id
  } catch {}

  try {
    const { data: member } = await supabaseAdmin
      .from('chat_room_members')
      .select('room_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    const roomId = member?.room_id ?? null
    if (roomId) {
      const { data: otherMember } = await supabaseAdmin
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', roomId)
        .neq('user_id', userId)
        .limit(1)
        .maybeSingle()

      const senderId = otherMember?.user_id ?? userId

      let messageId = null
      try {
        const { data: lastMsg } = await supabaseAdmin
          .from('chat_messages')
          .select('id')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        messageId = lastMsg?.id ?? null
      } catch {}

      if (!messageId) {
        try {
          const { data: createdMsg, error: msgErr } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              room_id: roomId,
              sender_id: senderId,
              content: 'Teste automático de realtime (chat).',
            })
            .select('id')
            .single()
          if (!msgErr && createdMsg?.id) messageId = createdMsg.id
        } catch {}
      }

      if (messageId) {
        const { data: notif, error: notifErr } = await supabaseAdmin
          .from('chat_notifications')
          .insert({
            user_id: userId,
            room_id: roomId,
            message_id: messageId,
            sender_id: senderId,
            type: 'message',
            is_read: false,
          })
          .select('id')
          .single()
        if (!notifErr && notif?.id) created.chatNotificationId = notif.id
      }
    }
  } catch {}

  return res.json({
    ok: true,
    created,
  })
})

module.exports = router

