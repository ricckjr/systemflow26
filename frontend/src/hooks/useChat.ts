import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { chatService } from '@/services/chat';
import { ChatRoom, ChatMessage, ChatAttachment } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

export function useChat() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Keep track of subscriptions to clean up
  const activeRoomUnsubscribe = useRef<(() => void) | null>(null);
  const activeRoomReceiptUnsubscribe = useRef<(() => void) | null>(null);
  const activeRoomUpdateUnsubscribe = useRef<(() => void) | null>(null);
  const messagesCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());
  const roomListUnsubscribeByRoomId = useRef<Map<string, () => void>>(new Map())

  const sortRoomsByRecency = useCallback((next: ChatRoom[]) => {
    return [...next].sort((a, b) => {
      const aRef = a.last_message_at || a.last_message?.created_at || a.updated_at || a.created_at
      const bRef = b.last_message_at || b.last_message?.created_at || b.updated_at || b.created_at
      return new Date(bRef ?? 0).getTime() - new Date(aRef ?? 0).getTime()
    })
  }, [])

  const upsertRoomLastMessage = useCallback((roomId: string, msg: ChatMessage) => {
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.id === roomId)
      if (idx < 0) return prev
      const next = [...prev]
      const current = next[idx]
      next[idx] = {
        ...current,
        last_message: msg,
        last_message_at: msg.created_at,
      }
      return sortRoomsByRecency(next)
    })
  }, [sortRoomsByRecency])

  // Initial load of rooms
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadRooms = async () => {
        try {
          // Don't set global loading true on refresh to avoid UI flicker if we already have rooms
          if (rooms.length === 0) setLoading(true);
          const data = await chatService.getRooms();
          setRooms(data);
        } catch (error) {
          console.error('Error loading chat rooms:', error);
        } finally {
          setLoading(false);
        }
    };
    
    loadRooms();
    
    // Subscribe to global room updates (e.g. new messages in any room to update list)
    // For now, we'll just reload rooms on new message event in the list view context
    // Ideally, we'd listen to 'chat_rooms' updates or 'chat_messages' inserts globally
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return
    const desired = new Set(
      rooms
        .map((r) => r.id)
        .filter(Boolean)
        .filter((id) => id !== activeRoomId)
    )

    const subs = roomListUnsubscribeByRoomId.current
    for (const [roomId, unsubscribe] of subs.entries()) {
      if (desired.has(roomId)) continue
      try {
        unsubscribe()
      } catch {}
      subs.delete(roomId)
    }

    for (const roomId of desired.values()) {
      if (subs.has(roomId)) continue
      const unsubscribe = chatService.subscribeToNewMessages(roomId, (msg) => {
        upsertRoomLastMessage(roomId, msg)
      })
      subs.set(roomId, unsubscribe)
    }
  }, [activeRoomId, profile?.id, rooms, upsertRoomLastMessage])

  useEffect(() => {
    return () => {
      const subs = roomListUnsubscribeByRoomId.current
      for (const unsubscribe of subs.values()) {
        try {
          unsubscribe()
        } catch {}
      }
      subs.clear()
    }
  }, [])

  // Load messages when active room changes
  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    const cached = messagesCacheRef.current.get(activeRoomId)
    if (cached && cached.length > 0) setMessages(cached)

    const loadMessages = async () => {
      try {
        const msgs = await chatService.getMessages(activeRoomId);
        setMessages(msgs);
        messagesCacheRef.current.set(activeRoomId, msgs)
        
        // Mark messages as read in chat_room_members
        await chatService.markAsRead(activeRoomId);
        
        const { error: notifError } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('type', 'chat')
          .eq('user_id', profile?.id)
          .eq('is_read', false)
          .contains('metadata', { room_id: activeRoomId } as any);
          
        if (notifError && notifError.code !== '42P01') {
           console.error('Error marking notifications as read:', notifError);
        }

      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();

    // Setup Realtime Subscription for this room
    if (activeRoomUnsubscribe.current) {
      try {
        activeRoomUnsubscribe.current()
      } catch {}
      activeRoomUnsubscribe.current = null
    }
    if (activeRoomReceiptUnsubscribe.current) {
      try {
        activeRoomReceiptUnsubscribe.current()
      } catch {}
      activeRoomReceiptUnsubscribe.current = null
    }
    if (activeRoomUpdateUnsubscribe.current) {
      try {
        activeRoomUpdateUnsubscribe.current()
      } catch {}
      activeRoomUpdateUnsubscribe.current = null
    }

    activeRoomUnsubscribe.current = chatService.subscribeToNewMessages(
      activeRoomId,
      async (enrichedMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === enrichedMessage.id)) return prev
          return [...prev, enrichedMessage]
        })
        upsertRoomLastMessage(activeRoomId, enrichedMessage)

        try {
          await chatService.markAsRead(activeRoomId)
        } catch {}
      }
    )

    activeRoomReceiptUnsubscribe.current = chatService.subscribeToReceiptUpdates(
      activeRoomId,
      (receipt) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== receipt.message_id) return m
            const nextReceipts = Array.isArray(m.receipts) ? [...m.receipts] : []
            const idx = nextReceipts.findIndex((r) => r.user_id === receipt.user_id)
            const merged = {
              user_id: receipt.user_id,
              delivered_at: receipt.delivered_at,
              read_at: receipt.read_at,
            }
            if (idx >= 0) nextReceipts[idx] = { ...nextReceipts[idx], ...merged }
            else nextReceipts.push(merged)
            return { ...m, receipts: nextReceipts }
          })
        )

        setRooms((prev) =>
          prev.map((r) => {
            if (r.last_message?.id !== receipt.message_id) return r
            const nextReceipts = Array.isArray(r.last_message.receipts)
              ? [...r.last_message.receipts]
              : []
            const idx = nextReceipts.findIndex((x) => x.user_id === receipt.user_id)
            const merged = {
              user_id: receipt.user_id,
              delivered_at: receipt.delivered_at,
              read_at: receipt.read_at,
            }
            if (idx >= 0) nextReceipts[idx] = { ...nextReceipts[idx], ...merged }
            else nextReceipts.push(merged)
            return {
              ...r,
              last_message: { ...r.last_message, receipts: nextReceipts },
            }
          })
        )
      }
    )

    activeRoomUpdateUnsubscribe.current = chatService.subscribeToMessageUpdates(
      activeRoomId,
      (updatedMessage) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== updatedMessage.id) return m
            return {
              ...m,
              ...updatedMessage,
              sender: m.sender ?? updatedMessage.sender,
              receipts: m.receipts ?? updatedMessage.receipts,
            }
          })
        )

        setRooms((prev) =>
          prev.map((r) => {
            if (r.last_message?.id !== updatedMessage.id) return r
            return {
              ...r,
              last_message: {
                ...(r.last_message as any),
                ...updatedMessage,
                sender: r.last_message?.sender ?? updatedMessage.sender,
                receipts: r.last_message?.receipts ?? updatedMessage.receipts,
              },
            }
          })
        )
      }
    )

    return () => {
      if (activeRoomUnsubscribe.current) {
        try {
          activeRoomUnsubscribe.current()
        } catch {}
        activeRoomUnsubscribe.current = null
      }
      if (activeRoomReceiptUnsubscribe.current) {
        try {
          activeRoomReceiptUnsubscribe.current()
        } catch {}
        activeRoomReceiptUnsubscribe.current = null
      }
      if (activeRoomUpdateUnsubscribe.current) {
        try {
          activeRoomUpdateUnsubscribe.current()
        } catch {}
        activeRoomUpdateUnsubscribe.current = null
      }
    };
    // CRITICAL FIX: Removed 'rooms' dependency to prevent re-fetching messages/re-subscribing when room list updates
  }, [activeRoomId, profile?.id, upsertRoomLastMessage]);

  useEffect(() => {
    if (!activeRoomId) return
    messagesCacheRef.current.set(activeRoomId, messages)
  }, [activeRoomId, messages])

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await chatService.getRooms();
      setRooms(data);
    } catch (error) {
      console.error('Error loading chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const markRoomAsRead = async (roomId: string) => {
    if (!profile?.id) return
    await chatService.markAsRead(roomId)
    const { error: notifError } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('type', 'chat')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .contains('metadata', { room_id: roomId } as any)
    if (notifError && notifError.code !== '42P01') throw notifError
  }

  const markActiveRoomAsRead = async () => {
    if (!activeRoomId) return
    try {
      await markRoomAsRead(activeRoomId)
    } catch (error) {
      console.error('Error marking room as read:', error)
    }
  }

  const sendMessage = async (content: string, attachments: any[] = [], replyToId?: string | null) => {
    if (!activeRoomId || (!content.trim() && attachments.length === 0)) return;
    
    try {
      setSending(true);
      // Optimistic update could happen here
      const newMsg = await chatService.sendMessage(activeRoomId, content, attachments, replyToId);
      
      // We rely on the subscription to add the message usually, but to be snappy we can add it 
      // check if it's already added by subscription to avoid dupe?
      // Actually subscription is fast, but let's append just in case subscription is slow
      // Ideally we filter by ID to avoid dupes
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      
      // Update room list last message
      setRooms(prev => prev.map(r => {
        if (r.id === activeRoomId) {
          return {
            ...r,
            last_message: newMsg,
            last_message_at: newMsg.created_at
          };
        }
        return r;
      }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    if (!activeRoomId) return
    try {
      const updated = await chatService.updateMessage(messageId, content)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? { ...m, ...updated, sender: m.sender ?? updated.sender, receipts: m.receipts }
            : m
        )
      )
      setRooms((prev) =>
        prev.map((r) => {
          if (r.last_message?.id !== updated.id) return r
          return {
            ...r,
            last_message: {
              ...(r.last_message as any),
              ...updated,
              sender: r.last_message?.sender ?? updated.sender,
              receipts: r.last_message?.receipts,
            },
          }
        })
      )
      return updated
    } catch (error) {
      console.error('Error editing message:', error)
      throw error
    }
  }

  const deleteMessage = async (messageId: string, attachments: ChatAttachment[] = []) => {
    if (!activeRoomId) return
    try {
      const paths = attachments.map((a) => a.path).filter((p): p is string => !!p)
      if (paths.length > 0) {
        try {
          await chatService.removeAttachmentPaths(paths)
        } catch (e) {
          console.error('Error removing attachments:', e)
        }
      }
      const updated = await chatService.softDeleteMessage(messageId)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? { ...m, ...updated, sender: m.sender ?? updated.sender, receipts: m.receipts }
            : m
        )
      )
      setRooms((prev) =>
        prev.map((r) => {
          if (r.last_message?.id !== updated.id) return r
          return {
            ...r,
            last_message: {
              ...(r.last_message as any),
              ...updated,
              sender: r.last_message?.sender ?? updated.sender,
              receipts: r.last_message?.receipts,
            },
          }
        })
      )
      return updated
    } catch (error) {
      console.error('Error deleting message:', error)
      throw error
    }
  }

  const loadOlderMessages = async (limit = 30) => {
    if (!activeRoomId) return 0
    const oldest = messages[0]?.created_at
    if (!oldest) return 0
    try {
      const older = await chatService.getMessagesBefore(activeRoomId, oldest, limit)
      if (older.length === 0) return 0
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const uniqueOlder = older.filter((m) => !existingIds.has(m.id))
        return [...uniqueOlder, ...prev]
      })
      return older.length
    } catch (error) {
      console.error('Error loading older messages:', error)
      return 0
    }
  }

  const startDirectChat = async (userId: string) => {
    try {
      const roomId = await chatService.createDirectChat(userId);
      await loadRooms(); // Refresh list
      setActiveRoomId(roomId);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  return {
    rooms,
    messages,
    activeRoomId,
    setActiveRoomId,
    sendMessage,
    editMessage,
    deleteMessage,
    markActiveRoomAsRead,
    loadOlderMessages,
    uploadAttachment: chatService.uploadAttachment,
    startDirectChat,
    loading,
    sending,
    currentUser: profile
  };
}
