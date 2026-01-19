import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { chatService } from '@/services/chat';
import { ChatRoom, ChatMessage } from '@/types/chat';
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

  // Load messages when active room changes
  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const msgs = await chatService.getMessages(activeRoomId);
        setMessages(msgs);
        
        // Mark messages as read in chat_room_members
        await chatService.markAsRead(activeRoomId);
        
        // Also mark notifications as read for this room
        const { error: notifError } = await supabase
          .from('chat_notifications')
          .update({ is_read: true })
          .eq('room_id', activeRoomId)
          .eq('user_id', profile?.id);
          
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

    activeRoomUnsubscribe.current = chatService.subscribeToNewMessages(
      activeRoomId,
      async (enrichedMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === enrichedMessage.id)) return prev
          return [...prev, enrichedMessage]
        })

        try {
          await chatService.markAsRead(activeRoomId)
        } catch {}
      }
    )

    return () => {
      if (activeRoomUnsubscribe.current) {
        try {
          activeRoomUnsubscribe.current()
        } catch {}
        activeRoomUnsubscribe.current = null
      }
    };
    // CRITICAL FIX: Removed 'rooms' dependency to prevent re-fetching messages/re-subscribing when room list updates
  }, [activeRoomId]);

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

  const sendMessage = async (content: string, attachments: any[] = []) => {
    if (!activeRoomId || (!content.trim() && attachments.length === 0)) return;
    
    try {
      setSending(true);
      // Optimistic update could happen here
      const newMsg = await chatService.sendMessage(activeRoomId, content, attachments);
      
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
    uploadAttachment: chatService.uploadAttachment,
    startDirectChat,
    loading,
    sending,
    currentUser: profile
  };
}
