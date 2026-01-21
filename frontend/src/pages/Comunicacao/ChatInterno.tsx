import React, { useState, useEffect, useMemo, useRef } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfiles } from '@/services/profiles';
import { supabase } from '@/services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { chatService } from '@/services/chat';
import { useChat } from '@/hooks/useChat';
import { ChatRoom, ChatMessage } from '@/types/chat';
import { usePresence, type UserStatus } from '@/contexts/PresenceContext';
import { useChatNotifications } from '@/contexts/ChatNotificationsContext';
import { Modal } from '@/components/ui';
import { isNotificationSoundEnabled, setNotificationSoundEnabled } from '@/utils/notificationSound';
import { 
  Search, 
  Send, 
  Plus, 
  Phone, 
  Video, 
  MessageSquare,
  Check,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  MoreVertical,
  CornerUpLeft,
  Pencil,
  Pin,
  PinOff,
  Volume2,
  VolumeX,
  Smile,
  CheckCheck,
  X,
  UserPlus,
  ArrowLeft,
  Trash2,
  Image as ImageIcon,
  FileText,
  Mic,
  StopCircle,
  Circle
} from 'lucide-react';

const STATUS_COLORS = {
  online: 'bg-emerald-500',
  busy: 'bg-red-500',
  away: 'bg-amber-500',
  offline: 'bg-slate-500'
};

const STATUS_LABELS = {
  online: 'Online',
  busy: 'Ocupado',
  away: 'Ausente',
  offline: 'Offline'
};

const CHAT_TIME_ZONE = 'America/Sao_Paulo' as const

const formatTimeSP = (input: string | Date | null | undefined) => {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: CHAT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const formatDateSP = (input: string | Date | null | undefined) => {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: CHAT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const formatDateTimeSP = (input: string | Date | null | undefined) => {
  if (!input) return ''
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: CHAT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const AudioVisualizer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  // ... (keep existing implementation)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.fftSize = 64; 
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvas) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      animationRef.current = requestAnimationFrame(draw);
      
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;
        ctx.fillStyle = `rgba(239, 68, 68, ${dataArray[i] / 255})`; 
        const y = (height - barHeight) / 2; 
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - 2, barHeight || 4, 4); 
        ctx.fill();

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={150} height={40} className="w-full h-full" />;
};

const ChatInterno: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  const { 
    rooms, 
    messages, 
    activeRoomId, 
    setActiveRoomId, 
    sendMessage, 
    editMessage,
    deleteMessage,
    markActiveRoomAsRead,
    loadOlderMessages,
    startDirectChat,
    uploadAttachment,
    loading,
    currentUser
  } = useChat();

  const {
    unreadByRoomId,
    setActiveRoomId: setActiveUnreadRoomId,
    markRoomAsRead,
  } = useChatNotifications()

  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null)
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [actionSheetMessage, setActionSheetMessage] = useState<ChatMessage | null>(null)
  const messageLongPressTimerRef = useRef<number | null>(null)
  const [typingByUserId, setTypingByUserId] = useState<Record<string, number>>({})
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const typingSendTimerRef = useRef<number | null>(null)
  const lastTypingSentAtRef = useRef<number>(0)
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled())
  const [pinnedItems, setPinnedItems] = useState<Array<{ messageId: string; pinnedAt: string; pinnedBy: string | null; message?: ChatMessage | null }>>([])
  const pinsUnsubscribeRef = useRef<(() => void) | null>(null)
  const [pinBusyByMessageId, setPinBusyByMessageId] = useState<Record<string, boolean>>({})
  const pinnedItemsRef = useRef(pinnedItems)
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [messageSearchActiveIndex, setMessageSearchActiveIndex] = useState(0)
  const [reactionsByMessageId, setReactionsByMessageId] = useState<Record<string, Array<{ emoji: string; count: number; me: boolean }>>>({})
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null)
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null)
  const reactionsUnsubscribeRef = useRef<(() => void) | null>(null)
  
  const { myStatus, myStatusText, usersPresence, setStatus, setStatusText } = usePresence();
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [statusTextDraft, setStatusTextDraft] = useState('');
  const statusTextTimerRef = useRef<number | null>(null);

  // New Chat Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  // Mobile view state
  const [showMobileList, setShowMobileList] = useState(true);

  useEffect(() => {
    const roomFromUrl = new URLSearchParams(window.location.search).get('room')
    const messageFromUrl = new URLSearchParams(window.location.search).get('message')
    if (roomFromUrl) {
      setActiveRoomId(roomFromUrl)
      setShowMobileList(false)
    }
    if (messageFromUrl) setPendingScrollMessageId(messageFromUrl)
  }, [setActiveRoomId])

  useEffect(() => {
    if (!activeRoomId) return
    if (!pendingScrollMessageId) return
    const exists = messages.some((m) => m.id === pendingScrollMessageId)
    if (!exists) return

    const el = document.getElementById(`chat-message-${pendingScrollMessageId}`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setHighlightMessageId(pendingScrollMessageId)
      window.setTimeout(() => setHighlightMessageId(null), 2500)
      setPendingScrollMessageId(null)
    }
  }, [activeRoomId, messages, pendingScrollMessageId])

  useEffect(() => {
    setActiveUnreadRoomId(activeRoomId)
  }, [activeRoomId, setActiveUnreadRoomId])

  useEffect(() => {
    return () => {
      setActiveUnreadRoomId(null)
    }
  }, [setActiveUnreadRoomId])

  useEffect(() => {
    const onCustom = (e: Event) => {
      const enabled = Boolean((e as any)?.detail)
      setSoundEnabled(enabled)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'systemflow:notificationSound:enabled') return
      setSoundEnabled(isNotificationSoundEnabled())
    }
    window.addEventListener('systemflow:notificationSound', onCustom as any)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('systemflow:notificationSound', onCustom as any)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    setTypingByUserId({})
    if (!activeRoomId || !currentUser?.id) return

    const channel = supabase
      .channel(`chat_typing_${activeRoomId}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const data = (payload as any)?.payload as any
        const userId = data?.user_id as string | undefined
        const isTyping = Boolean(data?.is_typing)
        if (!userId) return
        if (userId === currentUser.id) return

        if (isTyping) {
          setTypingByUserId((prev) => ({ ...prev, [userId]: Date.now() + 3000 }))
          return
        }

        setTypingByUserId((prev) => {
          if (!(userId in prev)) return prev
          const { [userId]: _removed, ...rest } = prev
          return rest
        })
      })
      .subscribe()

    typingChannelRef.current = channel

    return () => {
      if (typingSendTimerRef.current) window.clearTimeout(typingSendTimerRef.current)
      typingSendTimerRef.current = null
      typingChannelRef.current = null
      channel.unsubscribe()
      setTypingByUserId({})
    }
  }, [activeRoomId, currentUser?.id])

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      setTypingByUserId((prev) => {
        const entries = Object.entries(prev)
        if (entries.length === 0) return prev
        let changed = false
        const next: Record<string, number> = { ...prev }
        for (const [userId, exp] of entries) {
          if (!exp || exp <= now) {
            delete next[userId]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Attachments & Audio & Emoji State
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name?: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name?: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  // Hidden File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  const messageById = useMemo(() => {
    const map = new Map<string, ChatMessage>()
    for (const m of messages) map.set(m.id, m)
    return map
  }, [messages])

  useEffect(() => {
    pinnedItemsRef.current = pinnedItems
  }, [pinnedItems])

  const togglePinMessage = async (msg: ChatMessage) => {
    if (!activeRoomId) return
    const messageId = msg.id
    if (!messageId) return
    if (pinBusyByMessageId[messageId]) return

    const before = pinnedItemsRef.current
    const wasPinned = before.some((p) => p.messageId === messageId)

    setPinBusyByMessageId((prev) => ({ ...prev, [messageId]: true }))
    setPinnedItems(() => {
      if (wasPinned) return before.filter((p) => p.messageId !== messageId)
      const now = new Date().toISOString()
      const existing = msg ?? messageById.get(messageId) ?? null
      const next = [{ messageId, pinnedAt: now, pinnedBy: currentUser?.id ?? null, message: existing }, ...before]
      next.sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime())
      return next
    })

    try {
      if (wasPinned) await chatService.unpinMessage(activeRoomId, messageId)
      else await chatService.pinMessage(activeRoomId, messageId)
    } catch (error: any) {
      setPinnedItems(before)
      alert(error?.message || 'Não foi possível atualizar o pin.')
    } finally {
      setPinBusyByMessageId((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
    }
  }

  useEffect(() => {
    setPinnedItems((prev) =>
      prev.map((p) => {
        if (p.message) return p
        const msg = messageById.get(p.messageId)
        return msg ? { ...p, message: msg } : p
      })
    )
  }, [messageById])

  useEffect(() => {
    if (pinsUnsubscribeRef.current) {
      try {
        pinsUnsubscribeRef.current()
      } catch {}
      pinsUnsubscribeRef.current = null
    }
    setPinnedItems([])

    if (!activeRoomId) return
    let cancelled = false

    const load = async () => {
      try {
        const pins = await chatService.getPinnedMessages(activeRoomId)
        if (cancelled) return
        const items = await Promise.all(
          pins.map(async (p) => {
            const msg = messageById.get(p.message_id) ?? (await chatService.getMessageById(p.message_id))
            return {
              messageId: p.message_id,
              pinnedAt: p.pinned_at,
              pinnedBy: p.pinned_by,
              message: msg,
            }
          })
        )
        if (!cancelled) setPinnedItems(items)
      } catch {}
    }

    void load()

    pinsUnsubscribeRef.current = chatService.subscribeToPins(activeRoomId, async (evt) => {
      if (evt.event === 'DELETE') {
        setPinnedItems((prev) => prev.filter((p) => p.messageId !== evt.message_id))
        return
      }
      const msg = messageById.get(evt.message_id) ?? (await chatService.getMessageById(evt.message_id))
      setPinnedItems((prev) => {
        if (prev.some((p) => p.messageId === evt.message_id)) return prev
        const next = [
          {
            messageId: evt.message_id,
            pinnedAt: evt.pinned_at || new Date().toISOString(),
            pinnedBy: evt.pinned_by ?? null,
            message: msg,
          },
          ...prev,
        ]
        next.sort((a, b) => new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime())
        return next
      })
    })

    return () => {
      cancelled = true
      if (pinsUnsubscribeRef.current) {
        try {
          pinsUnsubscribeRef.current()
        } catch {}
        pinsUnsubscribeRef.current = null
      }
    }
  }, [activeRoomId, messageById])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest?.('[data-reaction-picker]')) return
      if (target.closest?.('[data-reaction-button]')) return
      setOpenReactionPickerId(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest?.('[data-message-menu]')) return
      if (target.closest?.('[data-message-menu-button]')) return
      setOpenMessageMenuId(null)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMessageMenuId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (reactionsUnsubscribeRef.current) {
      try {
        reactionsUnsubscribeRef.current()
      } catch {}
      reactionsUnsubscribeRef.current = null
    }
    setReactionsByMessageId({})
    setOpenReactionPickerId(null)

    if (!activeRoomId) return
    if (!currentUser?.id) return

    const buildSummary = (rows: Array<{ message_id: string; user_id: string; emoji: string }>) => {
      const map: Record<string, Record<string, { count: number; me: boolean }>> = {}
      for (const r of rows) {
        if (!r?.message_id || !r?.emoji || !r?.user_id) continue
        map[r.message_id] ??= {}
        const entry = map[r.message_id][r.emoji] ?? { count: 0, me: false }
        entry.count += 1
        if (r.user_id === currentUser.id) entry.me = true
        map[r.message_id][r.emoji] = entry
      }
      const out: Record<string, Array<{ emoji: string; count: number; me: boolean }>> = {}
      for (const [messageId, emojis] of Object.entries(map)) {
        out[messageId] = Object.entries(emojis)
          .map(([emoji, v]) => ({ emoji, count: v.count, me: v.me }))
          .sort((a, b) => b.count - a.count)
      }
      return out
    }

    const refreshAll = async () => {
      try {
        const ids = messages.map((m) => m.id).filter(Boolean)
        const rows = await chatService.getReactions(activeRoomId, ids)
        setReactionsByMessageId(buildSummary(rows as any))
      } catch {}
    }

    const refreshOne = async (messageId: string) => {
      try {
        const rows = await chatService.getReactions(activeRoomId, [messageId])
        const next = buildSummary(rows as any)
        setReactionsByMessageId((prev) => {
          const merged = { ...prev }
          if (next[messageId]) merged[messageId] = next[messageId]
          else delete merged[messageId]
          return merged
        })
      } catch {}
    }

    void refreshAll()

    reactionsUnsubscribeRef.current = chatService.subscribeToReactions(activeRoomId, (evt) => {
      if (!evt?.message_id) return
      void refreshOne(evt.message_id)
    })

    return () => {
      if (reactionsUnsubscribeRef.current) {
        try {
          reactionsUnsubscribeRef.current()
        } catch {}
        reactionsUnsubscribeRef.current = null
      }
    }
  }, [activeRoomId, currentUser?.id, messages])

  useEffect(() => {
    if (!previewImage) return
    setPreviewZoom(1)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  const formatBytes = (bytes?: number) => {
    if (!bytes || Number.isNaN(bytes)) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let i = 0
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024
      i++
    }
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
  }

  const downloadFromUrl = async (url: string, filename?: string) => {
    const safeName = (filename?.trim() || 'arquivo').replace(/[/\\?%*:|"<>]/g, '-')
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = safeName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<Profile | null>(null);
  const [profileModalLoading, setProfileModalLoading] = useState(false);

  useEffect(() => {
    if (!isProfileModalOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isProfileModalOpen])

  const openProfileModal = async (userId: string) => {
    setIsProfileModalOpen(true)
    setProfileModalLoading(true)

    const cached =
      allUsers.find((u) => u.id === userId) ??
      (profile?.id === userId ? profile : null)
    if (cached) setProfileModalUser(cached)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw error
      if (data) setProfileModalUser(data as any)
    } catch {
    } finally {
      setProfileModalLoading(false)
    }
  }

  // Fetch all users
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProfiles();
        setAllUsers(data.filter(u => u.id !== currentUser?.id));
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    })();
  }, [currentUser]);

  // Update status manually
  const handleStatusChange = async (status: UserStatus) => {
    setIsStatusMenuOpen(false);
    await setStatus(status);
  };

  useEffect(() => {
    setStatusTextDraft(myStatusText || '')
  }, [myStatusText])

  const scheduleStatusTextUpdate = (next: string) => {
    setStatusTextDraft(next)
    if (statusTextTimerRef.current) window.clearTimeout(statusTextTimerRef.current)
    statusTextTimerRef.current = window.setTimeout(() => {
      void setStatusText(next.trim())
    }, 600)
  }

  // ... (Keep existing helpers like handleRoomSelect, etc.)
  const handleRoomSelect = (roomId: string) => {
    void markRoomAsRead(roomId)
    setActiveRoomId(roomId);
    setActiveUnreadRoomId(roomId)
    setShowMobileList(false);
  };

  const handleBackToList = () => {
    setShowMobileList(true);
    setActiveRoomId(null);
  };

  // Keep existing recording functions...
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (editingMessage) {
          alert('Finalize ou cancele a edição antes de enviar anexos.')
          if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
          }
          audioChunksRef.current = [];
          return
        }
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.split('/')[1].split(';')[0];
        const audioFile = new File([audioBlob], `voice_message_${Date.now()}.${ext}`, { type: mimeType });
        try {
          const uploaded = await uploadAttachment(audioFile);
          await sendMessage('', [{ 
            type: 'audio',
            url: uploaded.publicUrl,
            path: uploaded.path,
            name: 'Mensagem de Voz',
            mime_type: mimeType,
            size: audioFile.size
          }], replyingTo?.id ?? null);
          setReplyingTo(null)
        } catch (error: any) {
          console.error("Error sending audio:", error);
          alert(`Erro ao enviar áudio: ${error.message}`);
        }
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      audioChunksRef.current = [];
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (editingMessage) {
        alert('Finalize ou cancele a edição antes de enviar anexos.')
        e.target.value = '';
        return
      }
      const uploaded = await uploadAttachment(file);
      await sendMessage('', [{ 
        type,
        url: uploaded.publicUrl,
        path: uploaded.path,
        name: file.name,
        mime_type: file.type,
        size: file.size
      }], replyingTo?.id ?? null);
      setReplyingTo(null)
      e.target.value = '';
      setShowAttachmentsMenu(false);
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert("Erro ao enviar arquivo.");
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    // Don't close picker for better UX (multiple emojis)
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRoomInfo = (room: ChatRoom) => {
    const unreadCount = unreadByRoomId[room.id] ?? 0
    const hasUnread = unreadCount > 0

    if (room.type === 'direct') {
      const otherMember = room.members?.find(m => m.user_id !== currentUser?.id);
      const otherId = otherMember?.user_id || '';
      // Prioritize realtime status, fallback to 'offline'
      const status = usersPresence[otherId]?.status || 'offline';
      const statusText = usersPresence[otherId]?.statusText;

      return {
        id: room.id,
        type: room.type,
        userId: otherId,
        name: otherMember?.profile?.nome || 'Usuário Desconhecido',
        avatar_url: otherMember?.profile?.avatar_url,
        status: status, 
        statusText,
        lastMessage: room.last_message,
        role: otherMember?.profile?.cargo || 'Membro',
        hasUnread,
        unreadCount,
        membersCount: room.members?.length ?? 0,
      };
    } else {
      return {
        id: room.id,
        type: room.type,
        userId: null,
        name: room.name || 'Grupo sem nome',
        avatar_url: null,
        status: null, // Groups don't have single status
        lastMessage: room.last_message,
        role: 'Grupo',
        hasUnread,
        unreadCount,
        membersCount: room.members?.length ?? 0,
      };
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activeRoomInfo = activeRoom ? getRoomInfo(activeRoom) : null;
  const activeUnreadCount = activeRoomId ? (unreadByRoomId[activeRoomId] ?? 0) : 0

  const typingStatusText = useMemo(() => {
    const now = Date.now()
    const ids = Object.entries(typingByUserId)
      .filter(([, exp]) => !!exp && exp > now)
      .map(([id]) => id)
    if (ids.length === 0) return ''

    const resolveName = (id: string) => {
      const fromRoom = activeRoom?.members?.find((m) => m.user_id === id)?.profile?.nome
      if (fromRoom) return fromRoom
      const fromAll = allUsers.find((u) => u.id === id)?.nome
      return fromAll || 'Usuário'
    }

    const names = ids.slice(0, 2).map(resolveName)
    const rest = ids.length - names.length
    const label = rest > 0 ? `${names.join(', ')} e +${rest}` : names.join(' e ')
    return ids.length === 1 ? `${label} está digitando...` : `${label} estão digitando...`
  }, [activeRoom?.members, allUsers, typingByUserId])

  const unreadDividerIndex = useMemo(() => {
    if (!activeRoomId) return -1
    if (!activeRoom?.members || !currentUser?.id) return -1
    if (activeUnreadCount <= 0) return -1
    const me = activeRoom.members.find((m) => m.user_id === currentUser.id)
    const lastReadAt = me?.last_read_at
    if (!lastReadAt) return -1
    const lastReadMs = new Date(lastReadAt).getTime()
    if (Number.isNaN(lastReadMs)) return -1
    return messages.findIndex((m) => {
      if (!m?.created_at) return false
      if (m.sender_id === currentUser.id) return false
      const ms = new Date(m.created_at).getTime()
      return Number.isFinite(ms) && ms > lastReadMs
    })
  }, [activeRoom, activeRoomId, activeUnreadCount, currentUser?.id, messages])

  const getTicksForMessage = (msg: ChatMessage) => {
    if (!currentUser?.id) return { kind: 'none' as const }
    if (msg.sender_id !== currentUser.id) return { kind: 'none' as const }

    const room = activeRoom
    if (!room?.members || room.members.length === 0) return { kind: 'sent' as const }
    const recipients = room.members.map((m) => m.user_id).filter((id) => id && id !== currentUser.id)
    if (recipients.length === 0) return { kind: 'sent' as const }

    const receipts = Array.isArray(msg.receipts) ? msg.receipts : []
    const relevant = receipts.filter((r) => recipients.includes(r.user_id))
    if (room.type === 'direct') {
      const r = relevant[0]
      if (r?.read_at) return { kind: 'read' as const }
      if (r?.delivered_at) return { kind: 'delivered' as const }
      return { kind: 'sent' as const }
    }

    const deliveredCount = relevant.filter((r) => !!r.delivered_at).length
    const readCount = relevant.filter((r) => !!r.read_at).length
    if (relevant.length > 0 && readCount === recipients.length) return { kind: 'read' as const }
    if (relevant.length > 0 && deliveredCount === recipients.length) return { kind: 'delivered' as const }
    return { kind: 'sent' as const }
  }

  const getTicksForRoomLastMessage = (room: ChatRoom) => {
    const last = room.last_message
    if (!last) return { kind: 'none' as const }
    if (!currentUser?.id) return { kind: 'none' as const }
    if (last.sender_id !== currentUser.id) return { kind: 'none' as const }
    if (!room.members || room.members.length === 0) return { kind: 'sent' as const }

    const recipients = room.members.map((m) => m.user_id).filter((id) => id && id !== currentUser.id)
    if (recipients.length === 0) return { kind: 'sent' as const }

    const receipts = Array.isArray(last.receipts) ? last.receipts : []
    const relevant = receipts.filter((r) => recipients.includes(r.user_id))

    if (room.type === 'direct') {
      const r = relevant[0]
      if (r?.read_at) return { kind: 'read' as const }
      if (r?.delivered_at) return { kind: 'delivered' as const }
      return { kind: 'sent' as const }
    }

    const deliveredCount = relevant.filter((r) => !!r.delivered_at).length
    const readCount = relevant.filter((r) => !!r.read_at).length
    if (relevant.length > 0 && readCount === recipients.length) return { kind: 'read' as const }
    if (relevant.length > 0 && deliveredCount === recipients.length) return { kind: 'delivered' as const }
    return { kind: 'sent' as const }
  }

  const filteredRooms = rooms.filter(room => {
    const info = getRoomInfo(room);
    return info.name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredNewChatUsers = useMemo(() => {
    return allUsers.filter(u => 
      u.nome.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email_login.toLowerCase().includes(newChatSearch.toLowerCase())
    );
  }, [newChatSearch, allUsers]);

  const getMessagePreviewText = (msg: ChatMessage | null | undefined) => {
    if (!msg) return ''
    if (msg.deleted_at) return 'Mensagem excluída'
    const text = (msg.content ?? '').trim()
    if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text
    const first = msg.attachments?.[0]
    if (!first) return ''
    const name = first.name?.trim() || 'Anexo'
    if (first.type === 'image') return `Imagem: ${name}`
    if (first.type === 'video') return `Vídeo: ${name}`
    if (first.type === 'audio') return `Áudio: ${name}`
    return `Documento: ${name}`
  }

  const messageSearchResults = useMemo(() => {
    const q = messageSearchQuery.trim().toLowerCase()
    if (q.length < 2) return [] as ChatMessage[]
    return messages.filter((m) => {
      if (!m) return false
      const content = (m.content ?? '').toLowerCase()
      const sender = (m.sender?.nome ?? '').toLowerCase()
      const date = m.created_at ? formatDateSP(m.created_at) : ''
      return content.includes(q) || sender.includes(q) || date.includes(q)
    })
  }, [messageSearchQuery, messages])

  useEffect(() => {
    setMessageSearchActiveIndex(0)
  }, [messageSearchQuery, isMessageSearchOpen])

  const renderHighlightedText = (text: string) => {
    const q = messageSearchQuery.trim()
    if (q.length < 2) return text
    const lower = text.toLowerCase()
    const qLower = q.toLowerCase()
    const parts: React.ReactNode[] = []
    let from = 0
    while (from < text.length) {
      const idx = lower.indexOf(qLower, from)
      if (idx < 0) {
        parts.push(text.slice(from))
        break
      }
      if (idx > from) parts.push(text.slice(from, idx))
      parts.push(
        <span key={`${idx}-${from}`} className="bg-amber-400/25 text-white px-0.5 rounded">
          {text.slice(idx, idx + q.length)}
        </span>
      )
      from = idx + q.length
    }
    return <>{parts}</>
  }

  const canEditMessage = (msg: ChatMessage) => {
    if (!currentUser?.id) return false
    if (msg.sender_id !== currentUser.id) return false
    if (msg.deleted_at) return false
    const createdAt = new Date(msg.created_at).getTime()
    if (Number.isNaN(createdAt)) return false
    return Date.now() - createdAt <= 15 * 60 * 1000
  }

  const canDeleteMessage = (msg: ChatMessage) => {
    if (!currentUser?.id) return false
    if (msg.sender_id !== currentUser.id) return false
    if (msg.deleted_at) return false
    return true
  }

  const toggleReaction = async (msg: ChatMessage, emoji: string) => {
    if (!activeRoomId) return
    if (!currentUser?.id) return
    try {
      const summary = reactionsByMessageId[msg.id] ?? []
      const hasMine = summary.some((r) => r.emoji === emoji && r.me)
      if (hasMine) await chatService.removeReaction(activeRoomId, msg.id, emoji)
      else await chatService.addReaction(activeRoomId, msg.id, emoji)
    } catch (error: any) {
      alert(error?.message || 'Não foi possível reagir à mensagem.')
    }
  }

  const startReply = (msg: ChatMessage) => {
    setEditingMessage(null)
    setReplyingTo(msg)
    messageInputRef.current?.focus()
  }

  const startEdit = (msg: ChatMessage) => {
    setReplyingTo(null)
    setEditingMessage(msg)
    setMessage(msg.content ?? '')
    messageInputRef.current?.focus()
  }

  const cancelComposerMode = () => {
    setReplyingTo(null)
    setEditingMessage(null)
    setMessage('')
  }

  const sendTypingBroadcast = (isTyping: boolean) => {
    const channel = typingChannelRef.current
    if (!channel) return
    if (!activeRoomId) return
    if (!currentUser?.id) return
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        room_id: activeRoomId,
        user_id: currentUser.id,
        is_typing: isTyping,
        at: Date.now(),
      },
    } as any)
  }

  const stopTyping = () => {
    if (typingSendTimerRef.current) window.clearTimeout(typingSendTimerRef.current)
    typingSendTimerRef.current = null
    sendTypingBroadcast(false)
  }

  const pingTyping = () => {
    if (!activeRoomId) return
    if (!currentUser?.id) return
    const now = Date.now()
    if (now - lastTypingSentAtRef.current < 650) {
      if (typingSendTimerRef.current) window.clearTimeout(typingSendTimerRef.current)
      typingSendTimerRef.current = window.setTimeout(() => stopTyping(), 2500)
      return
    }
    lastTypingSentAtRef.current = now
    sendTypingBroadcast(true)
    if (typingSendTimerRef.current) window.clearTimeout(typingSendTimerRef.current)
    typingSendTimerRef.current = window.setTimeout(() => stopTyping(), 2500)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId) return;
    const text = message.trim()
    if (!text) return
    setMessage('');
    setShowEmojiPicker(false);
    stopTyping()
    if (editingMessage) {
      try {
        await editMessage(editingMessage.id, text)
      } catch (error: any) {
        alert(error?.message || 'Não foi possível editar a mensagem.')
      } finally {
        setEditingMessage(null)
      }
      return
    }
    await sendMessage(text, [], replyingTo?.id ?? null);
    setReplyingTo(null)
  };

  const handleStartNewChat = async (userId: string) => {
    await startDirectChat(userId);
    setIsNewChatModalOpen(false);
    setNewChatSearch('');
    setShowMobileList(false);
  };

  const handleClearChat = () => {
    if (confirm("Tem certeza que deseja limpar esta conversa? Esta ação apagará o histórico localmente.")) {
        console.log("Clearing chat for room:", activeRoomId);
    }
  };

  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const lastSeenMarkAtRef = useRef<number>(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  const [pendingNewCount, setPendingNewCount] = useState(0)
  const prevMessagesLenRef = useRef(0)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const isPrependingHistoryRef = useRef(false)
  const ignoreScrollUntilRef = useRef(0)
  const pendingInitialScrollRef = useRef(false)

  useEffect(() => {
    const root = messagesScrollRef.current
    prevMessagesLenRef.current = 0
    isAtBottomRef.current = true
    setIsAtBottom(true)
    setPendingNewCount(0)
    pendingInitialScrollRef.current = true
    requestAnimationFrame(() => {
      const el = root
      if (!el) return
      ignoreScrollUntilRef.current = Date.now() + 250
      el.scrollTop = el.scrollHeight
    })
  }, [activeRoomId])

  useEffect(() => {
    const root = messagesScrollRef.current
    if (!root) return

    const onScroll = async () => {
      if (Date.now() < ignoreScrollUntilRef.current) return
      const el = root
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      const atBottom = distanceToBottom < 80
      isAtBottomRef.current = atBottom
      setIsAtBottom(atBottom)
      if (atBottom) setPendingNewCount(0)

      if (!activeRoomId) return
      if (loadingOlder) return
      if (messages.length === 0) return
      if (el.scrollTop > 60) return

      setLoadingOlder(true)
      isPrependingHistoryRef.current = true
      const prevTop = el.scrollTop
      const prevHeight = el.scrollHeight
      const added = await loadOlderMessages(30)
      requestAnimationFrame(() => {
        const newHeight = el.scrollHeight
        el.scrollTop = prevTop + (newHeight - prevHeight)
        ignoreScrollUntilRef.current = Date.now() + 250
        setLoadingOlder(false)
        isPrependingHistoryRef.current = false
      })
      if (added === 0) {
        setLoadingOlder(false)
        isPrependingHistoryRef.current = false
      }
    }

    root.addEventListener('scroll', onScroll, { passive: true } as any)
    return () => root.removeEventListener('scroll', onScroll as any)
  }, [activeRoomId, loadOlderMessages, loadingOlder, messages.length])

  useEffect(() => {
    const prevLen = prevMessagesLenRef.current
    const nextLen = messages.length
    prevMessagesLenRef.current = nextLen
    if (nextLen === 0) return
    if (isPrependingHistoryRef.current) return

    const root = messagesScrollRef.current
    if (!root) return
    if (pendingInitialScrollRef.current) {
      pendingInitialScrollRef.current = false
      requestAnimationFrame(() => {
        ignoreScrollUntilRef.current = Date.now() + 250
        root.scrollTop = root.scrollHeight
      })
      return
    }

    const last = messages[nextLen - 1]
    const lastIsMine = !!currentUser?.id && last?.sender_id === currentUser.id
    if (!isAtBottomRef.current && nextLen > prevLen && !lastIsMine) {
      setPendingNewCount((c) => c + (nextLen - prevLen))
      return
    }

    requestAnimationFrame(() => {
      ignoreScrollUntilRef.current = Date.now() + 250
      root.scrollTop = root.scrollHeight
    })
  }, [messages]);

  useEffect(() => {
    if (!activeRoomId) return
    if (activeUnreadCount <= 0) return
    if (!isAtBottom) return
    const now = Date.now()
    if (now - lastSeenMarkAtRef.current < 800) return
    lastSeenMarkAtRef.current = now
    void markRoomAsRead(activeRoomId)
    void markActiveRoomAsRead()
  }, [activeRoomId, activeUnreadCount, isAtBottom, markActiveRoomAsRead, markRoomAsRead])

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-cyan-500 gap-2">
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 animate-in fade-in duration-700 relative overflow-hidden">
      
      {/* Hidden Inputs */}
      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
      <input type="file" ref={docInputRef} accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={(e) => handleFileUpload(e, 'document')} />

      {/* Sidebar List */}
      <div className={`
        w-full md:w-80 lg:w-96 flex-col gap-4 shrink-0 h-full transition-all duration-300
        ${showMobileList ? 'flex' : 'hidden md:flex'}
      `}>
        {/* User Status Header */}
        <div className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)] shadow-sm flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="relative">
                 <button
                   type="button"
                   onClick={() => {
                     if (profile?.id) void openProfileModal(profile.id)
                   }}
                   className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-[#1e293b] border border-[var(--border)] overflow-hidden`}
                   title="Meu perfil"
                 >
                    {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Me" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        profile.nome?.substring(0, 2).toUpperCase()
                    )}
                 </button>
                 <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[myStatus]}`}></div>
              </div>
              <div className="flex flex-col">
                 <span className="text-sm font-bold text-[var(--text-main)]">Meu Status</span>
                 <div className="relative">
                    <button 
                       onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                       className="text-xs text-[var(--text-muted)] flex items-center gap-1 hover:text-[var(--text-main)] transition-colors"
                    >
                       {STATUS_LABELS[myStatus]} <MoreVertical size={12} />
                    </button>
                    {statusTextDraft?.trim() ? (
                      <div className="text-[11px] text-[var(--text-soft)] mt-0.5 truncate max-w-[200px]">
                        {statusTextDraft.trim()}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-[200px]">
                        Defina uma mensagem de status
                      </div>
                    )}
                    
                    {isStatusMenuOpen && (
                        <div className="absolute top-6 left-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-2 z-50 w-72 animate-in zoom-in-95 duration-200">
                          <div className="space-y-1">
                            {(Object.keys(STATUS_LABELS) as UserStatus[]).map(status => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(status)}
                                  className={`flex items-center gap-2 w-full p-2 text-xs rounded-lg hover:bg-[var(--bg-main)] transition-colors ${myStatus === status ? 'text-cyan-400 bg-cyan-500/10' : 'text-[var(--text-main)]'}`}
                                >
                                   <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`}></div>
                                   {STATUS_LABELS[status]}
                                </button>
                            ))}
                          </div>

                          <div className="h-px bg-[var(--border)] my-2" />
                          <div className="px-1 pb-1">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">
                              Mensagem de Status
                            </div>
                            <input
                              value={statusTextDraft}
                              onChange={(e) => scheduleStatusTextUpdate(e.target.value)}
                              onBlur={() => void setStatusText(statusTextDraft.trim())}
                              maxLength={80}
                              placeholder="Ex.: Em reunião • Volto 14h"
                              className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-2.5 px-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 transition-all"
                              autoFocus
                            />
                          </div>
                        </div>
                    )}
                 </div>
              </div>
           </div>
        </div>

        {/* Search Header */}
        <div className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-cyan-500 transition-colors" size={18} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-all"
            />
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-panel)]">
            <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={14} className="text-cyan-500" />
              Mensagens Recentes
            </h4>
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-2 hover:bg-[var(--bg-main)] rounded-lg text-[var(--text-muted)] hover:text-cyan-500 transition-all active:scale-95"
              title="Nova Conversa"
            >
              <Plus size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading && rooms.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 gap-3 text-[var(--text-muted)]">
                 <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                 <span className="text-xs">Carregando conversas...</span>
               </div>
            ) : (
              <>
                {filteredRooms.map(room => {
                  const info = getRoomInfo(room);
                  const isActive = activeRoomId === room.id;
                  const ticks = getTicksForRoomLastMessage(room);
                  
                  return (
                    <button 
                      key={room.id}
                      onClick={() => handleRoomSelect(room.id)}
                      className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all duration-200 group border ${
                        isActive 
                          ? 'bg-cyan-500/10 border-cyan-500/20 shadow-sm' 
                          : 'hover:bg-[var(--bg-main)] border-transparent hover:border-[var(--border)]'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (info.userId) void openProfileModal(info.userId)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              e.stopPropagation()
                              if (info.userId) void openProfileModal(info.userId)
                            }
                          }}
                          className="relative rounded-full"
                          title="Ver perfil"
                        >
                          {info.avatar_url ? (
                            <img src={info.avatar_url} alt={info.name} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--bg-panel)] shadow-sm" />
                          ) : (
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-main)] font-bold uppercase border-2 border-[var(--bg-panel)] shadow-sm transition-colors ${
                              isActive ? 'bg-cyan-600 text-white' : 'bg-[#1e293b] text-gray-400'
                            }`}>
                              {info.name.substring(0, 2)}
                            </div>
                          )}
                          {info.status && (
                            <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[info.status]} shadow-sm`}></div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className={`text-sm font-semibold truncate ${isActive ? 'text-cyan-400' : 'text-[var(--text-main)]'} ${info.hasUnread ? 'text-white font-bold' : ''}`}>
                            {info.name}
                          </p>
                          {info.lastMessage && (
                            <span className={`text-[10px] ${isActive ? 'text-cyan-500/70' : 'text-[var(--text-muted)]'} ${info.hasUnread ? 'text-cyan-400 font-bold' : ''}`}>
                              {formatTimeSP(info.lastMessage.created_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                            <p className={`text-xs truncate flex items-center gap-1.5 ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'} ${info.hasUnread ? 'font-semibold text-white' : ''}`}>
                            {info.lastMessage ? (
                                <>
                                {ticks.kind !== 'none' && (
                                  ticks.kind === 'sent' ? (
                                    <Check size={14} className={isActive ? 'text-cyan-500' : 'text-[var(--text-muted)]'} />
                                  ) : (
                                    <CheckCheck
                                      size={14}
                                      className={
                                        ticks.kind === 'read'
                                          ? 'text-cyan-400'
                                          : isActive
                                            ? 'text-cyan-500'
                                            : 'text-[var(--text-muted)]'
                                      }
                                    />
                                  )
                                )}
                                <span className="truncate">
                                    {info.lastMessage.attachments?.length 
                                    ? (info.lastMessage.attachments[0].type === 'audio' ? '🎵 Áudio' : '📎 Anexo') 
                                    : info.lastMessage.content}
                                </span>
                                </>
                            ) : (
                                <span className="italic opacity-50">Nova conversa</span>
                            )}
                            </p>
                            {info.hasUnread && (
                              <div className="min-w-[22px] h-[18px] px-1.5 rounded-full bg-cyan-500 text-black text-[10px] font-black flex items-center justify-center">
                                {info.unreadCount > 99 ? '99+' : info.unreadCount}
                              </div>
                            )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {/* ... (Empty state kept same) */}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={`
        flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-xl shadow-black/10 flex-col overflow-hidden relative
        ${!showMobileList ? 'flex' : 'hidden md:flex'}
      `}>
        {activeRoomInfo ? (
          <>
            <header className="h-[72px] border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0 bg-[var(--bg-panel)] z-10 shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={handleBackToList} className="md:hidden p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <ArrowLeft size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (activeRoomInfo.userId) void openProfileModal(activeRoomInfo.userId)
                  }}
                  className="relative"
                  title="Ver perfil"
                >
                  {activeRoomInfo.avatar_url ? (
                    <img src={activeRoomInfo.avatar_url} alt={activeRoomInfo.name} className="w-10 h-10 rounded-full object-cover border border-[var(--border)]" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] flex items-center justify-center text-white font-bold uppercase text-sm border border-[var(--border)]">
                      {activeRoomInfo.name.substring(0, 2)}
                    </div>
                  )}
                  {activeRoomInfo.status && (
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[activeRoomInfo.status]}`}></div>
                  )}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRoomInfo.userId) void openProfileModal(activeRoomInfo.userId)
                    }}
                    className="text-left"
                    title="Ver perfil"
                  >
                    <h3 className="text-base font-bold text-[var(--text-main)] leading-none">{activeRoomInfo.name}</h3>
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    {activeRoomInfo.type === 'direct' ? (
                      <>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeRoomInfo.status ? STATUS_COLORS[activeRoomInfo.status] : 'bg-gray-500'}`}></span>
                        <span className="text-[11px] text-[var(--text-muted)] font-medium">
                          {activeRoomInfo.status ? STATUS_LABELS[activeRoomInfo.status] : 'Offline'}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        {activeRoomInfo.type === 'group'
                          ? `${activeRoomInfo.membersCount} membro${activeRoomInfo.membersCount === 1 ? '' : 's'}`
                          : 'Conversa'}
                      </span>
                    )}
                  </div>
                  {typingStatusText ? (
                    <div className="text-[11px] text-cyan-300 mt-0.5 truncate max-w-[50vw]">
                      {typingStatusText}
                    </div>
                  ) : activeRoomInfo.type === 'direct' && activeRoomInfo.statusText ? (
                    <div className="text-[11px] text-[var(--text-soft)] mt-0.5 truncate max-w-[50vw]">
                      {activeRoomInfo.statusText}
                    </div>
                  ) : null}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMessageSearchOpen(true)}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-xl transition-all"
                  title="Buscar nesta conversa"
                >
                  <Search size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled
                    setNotificationSoundEnabled(next)
                    setSoundEnabled(next)
                  }}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-xl transition-all"
                  title={soundEnabled ? 'Som de notificações: ligado' : 'Som de notificações: desligado'}
                >
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button 
                  onClick={handleClearChat}
                  className="flex items-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all text-xs font-medium" 
                  title="Limpar Conversa"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">Limpar Conversa</span>
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div ref={messagesScrollRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-[#0B0F14] relative">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiZmZmZmZiIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>

              {pinnedItems.length > 0 && (
                <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-[#0B0F14]/85 backdrop-blur border-b border-white/10">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                    <Pin size={14} className="text-cyan-400" />
                    Fixadas
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {pinnedItems.slice(0, 3).map((p) => {
                      const msg = p.message ?? messageById.get(p.messageId)
                      const isBusy = Boolean(pinBusyByMessageId[p.messageId])
                      return (
                        <div
                          key={p.messageId}
                          className="min-w-[220px] max-w-[280px] rounded-xl border border-white/10 hover:border-white/20 bg-black/20 transition-colors flex items-center gap-2 px-3 py-2"
                        >
                          <button
                            type="button"
                            onClick={() => setPendingScrollMessageId(p.messageId)}
                            className="flex-1 text-left min-w-0"
                            title="Ir para mensagem fixada"
                          >
                            <div className="text-[11px] font-bold text-white/85 truncate">
                              {msg?.sender?.nome || 'Mensagem'}
                            </div>
                            <div className="text-[11px] text-white/60 truncate">
                              {getMessagePreviewText(msg) || 'Mensagem fixada'}
                            </div>
                          </button>
                          {msg && activeRoomId && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation()
                                void togglePinMessage(msg)
                              }}
                              className={[
                                'w-8 h-8 grid place-items-center rounded-lg',
                                'border border-white/10 bg-black/20 hover:bg-black/30',
                                'text-white/65 hover:text-white/90',
                                'transition-colors',
                                isBusy ? 'opacity-60 pointer-events-none' : '',
                              ].join(' ')}
                              title="Desafixar"
                            >
                              {isBusy ? <Circle size={14} className="animate-spin" /> : <PinOff size={14} />}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40 text-sm gap-4">
                  <div className="w-20 h-20 bg-[var(--bg-panel)] rounded-full flex items-center justify-center border border-[var(--border)]">
                    <MessageSquare size={32} className="text-[var(--text-muted)]" />
                  </div>
                  <p className="text-[var(--text-muted)]">Nenhuma mensagem ainda.</p>
                </div>
              )}
              
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === currentUser?.id;
                const isSequence = index > 0 && messages[index - 1].sender_id === msg.sender_id;
                const isDeleted = !!msg.deleted_at
                const hasAttachments = !isDeleted && msg.attachments && msg.attachments.length > 0;
                const ticks = getTicksForMessage(msg)
                const replyTo = msg.reply_to_id ? messageById.get(msg.reply_to_id) : undefined
                const isPinned = pinnedItems.some((p) => p.messageId === msg.id)
                const reactions = reactionsByMessageId[msg.id] ?? []
                const isMessageMenuOpen = openMessageMenuId === msg.id
                const canReactToMessage = !isDeleted
                const isPinBusy = Boolean(pinBusyByMessageId[msg.id])

                return (
                  <React.Fragment key={msg.id}>
                  {index === unreadDividerIndex && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="h-px flex-1 bg-white/10" />
                      <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300/90">
                        Não lidas
                      </div>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                  )}
                  <div id={`chat-message-${msg.id}`} className={`flex ${isMe ? 'justify-end' : 'justify-start'} z-0`}>
                    <div className={`max-w-[75%] md:max-w-[60%] group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && activeRoom?.type === 'group' && !isSequence && (
                        <span className="text-[10px] text-[var(--text-soft)] ml-1 mb-1 font-bold">{msg.sender?.nome}</span>
                      )}

                      <div
                        className={[
                          'absolute top-2 flex items-center',
                          isMe ? '-left-2' : '-right-2',
                          isMessageMenuOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-1 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0',
                          'transition-all duration-150',
                        ].join(' ')}
                      >
                        <div className="relative">
                          <button
                            type="button"
                            data-message-menu-button
                            onClick={() => {
                              setOpenReactionPickerId(null)
                              setOpenMessageMenuId((prev) => (prev === msg.id ? null : msg.id))
                            }}
                            className={[
                              'w-8 h-8 grid place-items-center rounded-full',
                              'border border-white/10 shadow-sm shadow-black/20 backdrop-blur',
                              'bg-black/35 hover:bg-black/45',
                              'text-white/70 hover:text-white/90',
                              'transition-all duration-150',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F14]',
                              isMessageMenuOpen ? 'border-white/20 bg-black/55 text-white/95' : '',
                            ].join(' ')}
                            title="Opções"
                          >
                            <MoreVertical size={16} strokeWidth={1.75} />
                          </button>

                          {isMessageMenuOpen && (
                            <div
                              data-message-menu
                              className={[
                                'absolute top-0 z-30 min-w-[190px] overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-card)] shadow-2xl py-1',
                                isMe ? 'right-full mr-2' : 'left-full ml-2',
                                'animate-in fade-in zoom-in-95',
                              ].join(' ')}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  startReply(msg)
                                  setOpenMessageMenuId(null)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3"
                              >
                                <CornerUpLeft size={16} className="text-cyan-400" />
                                Responder
                              </button>

                              {canReactToMessage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMessageMenuId(null)
                                    setOpenReactionPickerId((prev) => (prev === msg.id ? null : msg.id))
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3"
                                >
                                  <Smile size={16} className="text-amber-300" />
                                  Reagir
                                </button>
                              )}

                              {canEditMessage(msg) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    startEdit(msg)
                                    setOpenMessageMenuId(null)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3"
                                >
                                  <Pencil size={16} className="text-amber-400" />
                                  Editar
                                </button>
                              )}

                              {activeRoomId && (
                                <button
                                  type="button"
                                  disabled={isPinBusy}
                                  onClick={async () => {
                                    setOpenMessageMenuId(null)
                                    await togglePinMessage(msg)
                                  }}
                                  className={[
                                    'w-full px-3 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3',
                                    isPinBusy ? 'opacity-70 pointer-events-none' : '',
                                  ].join(' ')}
                                >
                                  {isPinBusy ? (
                                    <Circle size={16} className="animate-spin text-cyan-300" />
                                  ) : isPinned ? (
                                    <PinOff size={16} className="text-cyan-300" />
                                  ) : (
                                    <Pin size={16} className="text-cyan-400" />
                                  )}
                                  {isPinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
                                </button>
                              )}

                              {canDeleteMessage(msg) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm('Excluir esta mensagem?')) return
                                    try {
                                      await deleteMessage(msg.id, msg.attachments ?? [])
                                      if (editingMessage?.id === msg.id) cancelComposerMode()
                                      if (replyingTo?.id === msg.id) setReplyingTo(null)
                                      setOpenMessageMenuId(null)
                                    } catch (error: any) {
                                      alert(error?.message || 'Não foi possível excluir a mensagem.')
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-3"
                                >
                                  <Trash2 size={16} />
                                  Excluir
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {openReactionPickerId === msg.id && (
                        <div
                          data-reaction-picker
                          className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-8 rounded-2xl border border-white/10 bg-[var(--bg-card)] shadow-2xl px-2 py-2 flex items-center gap-1`}
                        >
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={async () => {
                                await toggleReaction(msg, emoji)
                                setOpenReactionPickerId(null)
                              }}
                              className="w-9 h-9 rounded-xl hover:bg-[var(--bg-main)] transition-colors text-lg flex items-center justify-center"
                              title={`Reagir com ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className={`
                        px-4 py-3 text-[14px] leading-relaxed shadow-sm relative break-words
                        ${isMe 
                          ? 'bg-[#0284C7] text-white rounded-2xl rounded-tr-none' 
                          : 'bg-[#1E293B] border border-[var(--border)] text-gray-200 rounded-2xl rounded-tl-none'}
                        ${isSequence ? (isMe ? 'mt-1 rounded-tr-2xl' : 'mt-1 rounded-tl-2xl') : ''}
                        ${msg.id === highlightMessageId ? 'ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-[#0B0F14]' : ''}
                      `}
                      onPointerDown={(e) => {
                        if (e.pointerType !== 'touch') return
                        if (messageLongPressTimerRef.current) window.clearTimeout(messageLongPressTimerRef.current)
                        messageLongPressTimerRef.current = window.setTimeout(() => {
                          setActionSheetMessage(msg)
                        }, 450)
                      }}
                      onPointerUp={() => {
                        if (!messageLongPressTimerRef.current) return
                        window.clearTimeout(messageLongPressTimerRef.current)
                        messageLongPressTimerRef.current = null
                      }}
                      onPointerCancel={() => {
                        if (!messageLongPressTimerRef.current) return
                        window.clearTimeout(messageLongPressTimerRef.current)
                        messageLongPressTimerRef.current = null
                      }}
                      onPointerMove={() => {
                        if (!messageLongPressTimerRef.current) return
                        window.clearTimeout(messageLongPressTimerRef.current)
                        messageLongPressTimerRef.current = null
                      }}
                      >
                        {msg.reply_to_id && (
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.reply_to_id) setPendingScrollMessageId(msg.reply_to_id)
                            }}
                            className={`w-full text-left mb-2 rounded-xl px-3 py-2 border border-white/10 hover:border-white/20 transition-colors ${isMe ? 'bg-black/20' : 'bg-black/10'}`}
                            title="Ir para mensagem original"
                          >
                            <div className={`text-[11px] font-bold ${isMe ? 'text-white/90' : 'text-white/80'}`}>
                              Respondendo a {replyTo?.sender?.nome || 'mensagem'}
                            </div>
                            <div className={`text-[11px] truncate ${isMe ? 'text-white/70' : 'text-white/60'}`}>
                              {getMessagePreviewText(replyTo) || 'Mensagem original'}
                            </div>
                          </button>
                        )}

                        {isDeleted ? (
                          <em className={isMe ? 'text-white/80' : 'text-white/70'}>Mensagem excluída</em>
                        ) : hasAttachments ? (
                           <div className="flex flex-col gap-2">
                             {msg.attachments?.map((att, idx) => (
                               <div key={idx} className="bg-black/20 p-2 rounded-lg">
                                 {att.type === 'image' && (
                                   <div className="flex flex-col gap-2">
                                     <button
                                       type="button"
                                       onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                                       className="block overflow-hidden rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                                       title="Abrir imagem"
                                     >
                                       <img
                                         src={att.url}
                                         alt={att.name || 'Imagem'}
                                         className="max-w-full max-h-60 object-cover"
                                         loading="lazy"
                                         decoding="async"
                                       />
                                     </button>
                                     <div className="flex items-center justify-between gap-2">
                                       <div className="text-xs text-white/70 truncate">
                                         {att.name || 'Imagem'} {att.size ? `• ${formatBytes(att.size)}` : ''}
                                       </div>
                                       <div className="flex items-center gap-1 shrink-0">
                                         <button
                                           type="button"
                                           onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                                           className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                           title="Visualizar"
                                         >
                                           <ExternalLink size={14} />
                                         </button>
                                         <button
                                           type="button"
                                           onClick={() => downloadFromUrl(att.url, att.name)}
                                           className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                           title="Baixar"
                                         >
                                           <Download size={14} />
                                         </button>
                                       </div>
                                     </div>
                                   </div>
                                 )}
                                 {att.type === 'audio' && (
                                   <div className="flex flex-col gap-2">
                                     <div className="flex items-center gap-2 min-w-[200px]">
                                       <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                         <Mic size={14} />
                                       </div>
                                       <audio
                                         controls
                                         preload="none"
                                         src={att.url}
                                         className="h-8 w-full max-w-[220px]"
                                       />
                                       <button
                                         type="button"
                                         onClick={() => downloadFromUrl(att.url, att.name || 'audio')}
                                         className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                         title="Baixar"
                                       >
                                         <Download size={14} />
                                       </button>
                                     </div>
                                     <div className="text-[11px] text-white/70 truncate">
                                       {att.name || 'Áudio'} {att.size ? `• ${formatBytes(att.size)}` : ''}
                                     </div>
                                   </div>
                                 )}
                                 {att.type === 'document' && (
                                   <div className="flex items-center justify-between gap-2">
                                     <a
                                       href={att.url}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="flex items-center gap-2 text-sm hover:underline min-w-0"
                                       title="Abrir documento"
                                     >
                                       <FileText size={16} />
                                       <span className="truncate">{att.name || 'Documento'}</span>
                                       {att.size ? (
                                         <span className="text-xs text-white/60 shrink-0">
                                           {formatBytes(att.size)}
                                         </span>
                                       ) : null}
                                    </a>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {att.mime_type?.includes('pdf') && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDoc({ url: att.url, name: att.name || 'PDF' })}
                                          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                          title="Pré-visualizar"
                                        >
                                          <ZoomIn size={14} />
                                        </button>
                                      )}
                                      <a
                                        href={att.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                        title="Abrir"
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => downloadFromUrl(att.url, att.name)}
                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                        title="Baixar"
                                      >
                                        <Download size={14} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                                 {att.type === 'video' && (
                                   <div className="flex flex-col gap-2">
                                     <video
                                       controls
                                       preload="metadata"
                                       src={att.url}
                                       className="w-full max-h-72 rounded-lg border border-white/10"
                                     />
                                     <div className="flex items-center justify-between gap-2">
                                       <div className="text-xs text-white/70 truncate">
                                         {att.name || 'Vídeo'} {att.size ? `• ${formatBytes(att.size)}` : ''}
                                       </div>
                                       <div className="flex items-center gap-1 shrink-0">
                                         <a
                                           href={att.url}
                                           target="_blank"
                                           rel="noreferrer"
                                           className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                           title="Abrir"
                                         >
                                           <ExternalLink size={14} />
                                         </a>
                                         <button
                                           type="button"
                                           onClick={() => downloadFromUrl(att.url, att.name)}
                                           className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                           title="Baixar"
                                         >
                                           <Download size={14} />
                                         </button>
                                       </div>
                                     </div>
                                   </div>
                                 )}
                                 {att.type !== 'image' &&
                                   att.type !== 'audio' &&
                                   att.type !== 'document' &&
                                   att.type !== 'video' && (
                                     <div className="flex items-center justify-between gap-2">
                                       <div className="text-sm truncate">{att.name || 'Arquivo'}</div>
                                       <button
                                         type="button"
                                         onClick={() => downloadFromUrl(att.url, att.name)}
                                         className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                         title="Baixar"
                                       >
                                         <Download size={14} />
                                       </button>
                                     </div>
                                   )}
                             </div>
                           ))}
                            {msg.content && <p>{renderHighlightedText(msg.content)}</p>}
                          </div>
                        ) : (
                          renderHighlightedText(msg.content)
                        )}
                      </div>

                      {reactions.length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {reactions.map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              onClick={() => toggleReaction(msg, r.emoji)}
                              className={`px-2 py-1 rounded-full text-[11px] border transition-colors ${r.me ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-white/10 bg-black/10 text-white/90 hover:bg-white/5'}`}
                              title={r.me ? 'Remover reação' : 'Reagir'}
                            >
                              {r.emoji} <span className="opacity-70 font-bold">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className={`flex items-center gap-1 mt-1 px-1 opacity-60 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {formatTimeSP(msg.created_at)}
                        </span>
                        {(msg.is_edited || msg.edited_at) && !msg.deleted_at && (
                          <span className="text-[10px] text-[var(--text-muted)] font-medium">(editada)</span>
                        )}
                        {isMe && ticks.kind !== 'none' && (
                          ticks.kind === 'sent' ? (
                            <Check size={12} className="text-[var(--text-muted)]" />
                          ) : (
                            <CheckCheck
                              size={12}
                              className={ticks.kind === 'read' ? 'text-cyan-400' : 'text-[var(--text-muted)]'}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}
              {pendingNewCount > 0 && !isAtBottom && (
                <div className="sticky bottom-4 z-10 flex justify-center pointer-events-none">
                  <button
                    type="button"
                    onClick={() => {
                      const root = messagesScrollRef.current
                      root?.scrollTo({ top: root.scrollHeight, behavior: 'smooth' })
                      setPendingNewCount(0)
                      if (activeRoomId) {
                        void markRoomAsRead(activeRoomId)
                        void markActiveRoomAsRead()
                      }
                    }}
                    className="pointer-events-auto px-4 py-2 rounded-full bg-cyan-500 text-black text-xs font-black shadow-lg hover:bg-cyan-400 transition-colors"
                    title="Ir para a última mensagem"
                  >
                    Novas mensagens{pendingNewCount > 0 ? ` (+${pendingNewCount})` : ''} ↓
                  </button>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border)] relative">
              {(replyingTo || editingMessage) && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3">
                  <div className="min-w-0 flex items-start gap-3">
                    {editingMessage ? (
                      <Pencil size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <CornerUpLeft size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-main)]">
                        {editingMessage
                          ? 'Editando mensagem'
                          : `Respondendo a ${replyingTo?.sender?.nome || 'mensagem'}`}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[70vw]">
                        {editingMessage
                          ? getMessagePreviewText(editingMessage)
                          : getMessagePreviewText(replyingTo)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={cancelComposerMode}
                    className="p-2 rounded-full hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    title="Cancelar"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              
              {showAttachmentsMenu && (
                <div className="absolute bottom-20 left-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl p-2 flex flex-col gap-1 z-20 animate-in slide-in-from-bottom-5 duration-200 min-w-[180px]">
                  <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-main)] rounded-lg text-sm text-[var(--text-main)] transition-colors text-left w-full">
                    <ImageIcon size={18} className="text-purple-400" />
                    Enviar Imagem
                  </button>
                  <button onClick={() => docInputRef.current?.click()} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-main)] rounded-lg text-sm text-[var(--text-main)] transition-colors text-left w-full">
                    <FileText size={18} className="text-blue-400" />
                    Enviar Documento
                  </button>
                </div>
              )}

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-20 right-4 z-20 shadow-2xl border border-[var(--border)] rounded-xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
                    <EmojiPicker 
                        onEmojiClick={onEmojiClick}
                        theme={Theme.DARK}
                        width={320}
                        height={400}
                        searchPlaceHolder="Buscar emoji..."
                        previewConfig={{ showPreview: false }}
                    />
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center gap-4 bg-red-500/5 border border-red-500/20 rounded-3xl p-3 px-6 animate-in fade-in duration-200 h-[64px]">
                   <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shrink-0"></div>
                   <div className="flex-1 h-10 flex items-center justify-center overflow-hidden mx-2">
                      <AudioVisualizer stream={audioStream} />
                   </div>
                   <span className="text-red-400 font-mono font-medium text-sm shrink-0 w-12 text-right">{formatTime(recordingTime)}</span>
                   <div className="flex items-center gap-2 shrink-0">
                      <button onClick={cancelRecording} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-main)] rounded-full transition-colors"><X size={20} /></button>
                      <button onClick={stopRecording} className="p-2 bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors shadow-lg shadow-red-500/20"><Send size={18} /></button>
                   </div>
                </div>
              ) : (
                <form className="flex items-end gap-2" onSubmit={handleSendMessage}>
                  <div className="flex-1 flex items-end gap-2 bg-[var(--bg-main)] border border-[var(--border)] rounded-3xl p-2 pl-2 shadow-inner focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500/50 transition-all">
                    <button
                      type="button"
                      disabled={!!editingMessage}
                      onClick={() => setShowAttachmentsMenu(!showAttachmentsMenu)}
                      className={`p-2 rounded-full transition-all mb-0.5 ${editingMessage ? 'opacity-40 cursor-not-allowed text-[var(--text-muted)]' : (showAttachmentsMenu ? 'bg-cyan-500/10 text-cyan-500 rotate-45' : 'text-[var(--text-muted)] hover:text-cyan-500 hover:bg-[var(--bg-panel)]')}`}
                      title={editingMessage ? 'Finalize ou cancele a edição para anexar arquivos' : 'Anexos'}
                    >
                      <Plus size={20} />
                    </button>
                    
                    <textarea 
                      ref={messageInputRef}
                      value={message}
                      onChange={(e) => {
                        const next = e.target.value
                        setMessage(next)
                        if (next.trim()) pingTyping()
                        else stopTyping()
                      }}
                      onBlur={() => stopTyping()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={editingMessage ? "Edite sua mensagem..." : "Digite sua mensagem..."}
                      className="flex-1 bg-transparent border-none py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:ring-0 resize-none max-h-32 custom-scrollbar"
                      rows={1}
                      style={{ minHeight: '44px' }}
                    />
                    
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full transition-all mb-0.5 ${showEmojiPicker ? 'text-amber-400 bg-amber-500/10' : 'text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-panel)]'}`}
                    >
                      <Smile size={20} />
                    </button>
                  </div>

                  {message.trim() ? (
                    <button type="submit" className="p-3.5 bg-cyan-600 text-white rounded-full hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/20 hover:scale-105 active:scale-95 flex-shrink-0">
                      <Send size={20} className="ml-0.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={startRecording} className="p-3.5 bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500 hover:border-red-500/30 rounded-full transition-all shadow-sm hover:scale-105 active:scale-95 flex-shrink-0">
                      <Mic size={20} />
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-soft)] p-8 text-center opacity-60 bg-[var(--bg-panel)]">
            {/* Empty state kept same */}
            <div className="w-32 h-32 bg-[var(--bg-main)] rounded-full flex items-center justify-center mb-8 border border-[var(--border)] shadow-2xl">
              <MessageSquare size={48} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-2xl font-bold text-[var(--text-main)] mb-3">Chat Interno</h3>
            <p className="max-w-xs text-sm text-[var(--text-muted)] mb-8 leading-relaxed">Selecione um colega de equipe para iniciar uma conversa segura e direta.</p>
            <button onClick={() => setIsNewChatModalOpen(true)} className="flex items-center gap-3 bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 font-bold text-sm tracking-wide">
              <Plus size={20} /> NOVA CONVERSA
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        size="md"
        title={
          <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {profileModalUser?.avatar_url ? (
                    <img
                      src={profileModalUser.avatar_url}
                      alt={profileModalUser.nome}
                      className="w-10 h-10 rounded-full object-cover border border-[var(--border)]"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] flex items-center justify-center text-white font-bold uppercase text-sm border border-[var(--border)]">
                      {(profileModalUser?.nome || 'U').substring(0, 2)}
                    </div>
                  )}
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[usersPresence[profileModalUser?.id || '']?.status || 'offline']}`}></div>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--text-main)] truncate">
                    {profileModalUser?.nome || (profileModalLoading ? 'Carregando...' : 'Usuário')}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {profileModalUser?.cargo || 'Membro da equipe'} • {STATUS_LABELS[usersPresence[profileModalUser?.id || '']?.status || 'offline']}
                  </div>
                  {usersPresence[profileModalUser?.id || '']?.statusText ? (
                    <div className="text-[10px] text-[var(--text-soft)] mt-0.5 truncate">
                      {usersPresence[profileModalUser?.id || '']?.statusText}
                    </div>
                  ) : null}
                </div>
          </div>
        }
      >
        <div className="space-y-4">
              {profileModalLoading && !profileModalUser ? (
                <div className="flex items-center justify-center py-10 text-[var(--text-muted)] gap-3">
                  <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                  <span className="text-sm">Carregando perfil...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Email</div>
                    <div className="text-[var(--text-main)] break-all">{profileModalUser?.email_login || '-'}</div>
                  </div>
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Email Corporativo</div>
                    <div className="text-[var(--text-main)] break-all">{profileModalUser?.email_corporativo || '-'}</div>
                  </div>
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Telefone</div>
                    <div className="text-[var(--text-main)] break-all">{profileModalUser?.telefone || '-'}</div>
                  </div>
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Ramal</div>
                    <div className="text-[var(--text-main)] break-all">{profileModalUser?.ramal || '-'}</div>
                  </div>
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Ativo</div>
                    <div className="text-[var(--text-main)]">{profileModalUser?.ativo ? 'Sim' : 'Não'}</div>
                  </div>
                  <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">Criado Em</div>
                    <div className="text-[var(--text-main)]">{profileModalUser?.created_at ? formatDateTimeSP(profileModalUser.created_at) : '-'}</div>
                  </div>
                </div>
              )}
            </div>
      </Modal>

      <Modal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        size="4xl"
        noPadding
        title={
            <div className="flex items-center justify-between w-full pr-8">
                <div className="min-w-0">
                    <div className="text-sm font-bold text-[var(--text-main)] truncate">
                      {previewImage?.name || 'Imagem'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] hidden sm:block">
                      Clique fora para fechar • ESC
                    </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                      className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                      title="Zoom -"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                      className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                      title="Zoom +"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFromUrl(previewImage?.url || '', previewImage?.name || '')}
                      className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                      title="Baixar"
                    >
                      <Download size={18} />
                    </button>
                    <a
                      href={previewImage?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                      title="Abrir em nova aba"
                    >
                      <ExternalLink size={18} />
                    </a>
                </div>
            </div>
        }
      >
        <div
              className="flex-1 bg-black/20 overflow-auto min-h-[400px]"
              onWheel={(e) => {
                if (!e.ctrlKey) return
                e.preventDefault()
                const delta = e.deltaY > 0 ? -0.15 : 0.15
                setPreviewZoom((z) => Math.min(4, Math.max(1, Math.round((z + delta) * 100) / 100)))
              }}
            >
              <div className="min-h-full w-full flex items-center justify-center p-4">
                <img
                  src={previewImage?.url}
                  alt={previewImage?.name || 'Imagem'}
                  className="max-w-full max-h-[75vh] object-contain select-none"
                  style={{ transform: `scale(${previewZoom})` }}
                  draggable={false}
                />
              </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        size="4xl"
        noPadding
        title={
          <div className="flex items-center justify-between w-full pr-8">
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--text-main)] truncate">
                {previewDoc?.name || 'Documento'}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] hidden sm:block">
                Clique fora para fechar • ESC
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => downloadFromUrl(previewDoc?.url || '', previewDoc?.name || '')}
                className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                title="Baixar"
              >
                <Download size={18} />
              </button>
              <a
                href={previewDoc?.url}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl hover:bg-[var(--bg-main)] text-[var(--text-main)] transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        }
      >
        <div className="flex-1 bg-black/20 overflow-hidden min-h-[400px]">
          <iframe
            src={previewDoc?.url || ''}
            title={previewDoc?.name || 'Documento'}
            className="w-full h-[75vh]"
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!actionSheetMessage}
        onClose={() => setActionSheetMessage(null)}
        size="sm"
        noPadding
        title="Ações da mensagem"
      >
        <div className="p-2 bg-[var(--bg-panel)]">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {actionSheetMessage && (
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-1">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={async () => {
                      await toggleReaction(actionSheetMessage, emoji)
                      setActionSheetMessage(null)
                    }}
                    className="w-10 h-10 rounded-xl hover:bg-[var(--bg-main)] transition-colors text-lg flex items-center justify-center"
                    title={`Reagir com ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!actionSheetMessage) return
                startReply(actionSheetMessage)
                setActionSheetMessage(null)
              }}
              className="w-full px-4 py-3 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3"
            >
              <CornerUpLeft size={18} className="text-cyan-400" />
              Responder
            </button>
            {actionSheetMessage && canEditMessage(actionSheetMessage) && (
              <button
                type="button"
                onClick={() => {
                  startEdit(actionSheetMessage)
                  setActionSheetMessage(null)
                }}
                className="w-full px-4 py-3 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3"
              >
                <Pencil size={18} className="text-amber-400" />
                Editar
              </button>
            )}
            {actionSheetMessage && activeRoomId && (
              <button
                type="button"
                disabled={Boolean(actionSheetMessage && pinBusyByMessageId[actionSheetMessage.id])}
                onClick={async () => {
                  if (!actionSheetMessage) return
                  await togglePinMessage(actionSheetMessage)
                  setActionSheetMessage(null)
                }}
                className={[
                  'w-full px-4 py-3 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] flex items-center gap-3',
                  Boolean(actionSheetMessage && pinBusyByMessageId[actionSheetMessage.id]) ? 'opacity-70 pointer-events-none' : '',
                ].join(' ')}
              >
                {Boolean(actionSheetMessage && pinBusyByMessageId[actionSheetMessage.id]) ? (
                  <Circle size={18} className="animate-spin text-cyan-300" />
                ) : pinnedItems.some((p) => p.messageId === actionSheetMessage.id) ? (
                  <PinOff size={18} className="text-cyan-300" />
                ) : (
                  <Pin size={18} className="text-cyan-400" />
                )}
                {pinnedItems.some((p) => p.messageId === actionSheetMessage.id) ? 'Desafixar mensagem' : 'Fixar mensagem'}
              </button>
            )}
            {actionSheetMessage && canDeleteMessage(actionSheetMessage) && (
              <button
                type="button"
                onClick={async () => {
                  if (!actionSheetMessage) return
                  if (!confirm('Excluir esta mensagem?')) return
                  try {
                    await deleteMessage(actionSheetMessage.id, actionSheetMessage.attachments ?? [])
                    if (editingMessage?.id === actionSheetMessage.id) cancelComposerMode()
                    if (replyingTo?.id === actionSheetMessage.id) setReplyingTo(null)
                    setActionSheetMessage(null)
                  } catch (error: any) {
                    alert(error?.message || 'Não foi possível excluir a mensagem.')
                  }
                }}
                className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-3"
              >
                <Trash2 size={18} />
                Excluir
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isMessageSearchOpen}
        onClose={() => setIsMessageSearchOpen(false)}
        size="md"
        noPadding
        title="Buscar na conversa"
      >
        <div className="flex flex-col h-[70vh] max-h-[520px] bg-[var(--bg-panel)]">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-main)]">
            <input
              value={messageSearchQuery}
              onChange={(e) => setMessageSearchQuery(e.target.value)}
              placeholder="Buscar por texto, usuário ou data (dd/mm/aaaa)..."
              className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/40 text-[var(--text-main)] outline-none transition-all"
              autoFocus
            />
            <div className="flex items-center justify-between mt-3 text-[11px] text-[var(--text-muted)]">
              <div>
                {messageSearchQuery.trim().length < 2
                  ? 'Digite pelo menos 2 caracteres'
                  : `${messageSearchResults.length} resultado(s)`}
              </div>
              {messageSearchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const total = messageSearchResults.length
                      if (total === 0) return
                      const next = (messageSearchActiveIndex - 1 + total) % total
                      setMessageSearchActiveIndex(next)
                      setPendingScrollMessageId(messageSearchResults[next].id)
                      setIsMessageSearchOpen(false)
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-main)] transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const total = messageSearchResults.length
                      if (total === 0) return
                      const next = (messageSearchActiveIndex + 1) % total
                      setMessageSearchActiveIndex(next)
                      setPendingScrollMessageId(messageSearchResults[next].id)
                      setIsMessageSearchOpen(false)
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-main)] transition-colors"
                  >
                    Próximo
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {messageSearchResults.length === 0 ? (
              <div className="text-center p-10 text-[var(--text-muted)] text-sm">
                {messageSearchQuery.trim().length < 2 ? ' ' : 'Nenhum resultado encontrado.'}
              </div>
            ) : (
              <div className="space-y-1">
                {messageSearchResults.slice(0, 50).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setPendingScrollMessageId(m.id)
                      setIsMessageSearchOpen(false)
                    }}
                    className="w-full p-3 rounded-xl border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-main)] text-left transition-all"
                    title="Ir para mensagem"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold text-[var(--text-main)] truncate">
                        {m.sender?.nome || 'Usuário'}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] shrink-0">
                        {m.created_at ? formatDateTimeSP(m.created_at) : ''}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-soft)] truncate mt-1">
                      {getMessagePreviewText(m)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* New Chat Modal */}
      <Modal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        size="sm"
        noPadding
        title={
            <div className="flex items-center gap-2">
                <UserPlus size={20} className="text-cyan-500" /> 
                Nova Conversa
            </div>
        }
      >
        <div className="flex flex-col h-[60vh] max-h-[500px]">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-main)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input type="text" value={newChatSearch} onChange={(e) => setNewChatSearch(e.target.value)} placeholder="Buscar por nome ou email..." className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] outline-none" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-[var(--bg-panel)]">
              {filteredNewChatUsers.length === 0 ? (
                <div className="text-center p-10 text-[var(--text-muted)] text-sm">Nenhum usuário encontrado.</div>
              ) : (
                <div className="space-y-1">
                  {filteredNewChatUsers.map(user => (
                    <button key={user.id} onClick={() => handleStartNewChat(user.id)} className="w-full p-3 flex items-center gap-4 rounded-xl hover:bg-[var(--bg-main)] border border-transparent hover:border-[var(--border)] transition-all duration-200 text-left group">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation()
                          void openProfileModal(user.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            e.stopPropagation()
                            void openProfileModal(user.id)
                          }
                        }}
                        className="relative shrink-0"
                        title="Ver perfil"
                      >
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.nome} className="w-10 h-10 rounded-full object-cover border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] flex items-center justify-center text-white font-bold uppercase text-sm border border-[var(--border)]">{user.nome.substring(0, 2)}</div>
                        )}
                         {usersPresence[user.id]?.status && (
                             <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[usersPresence[user.id].status]}`}></div>
                         )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors truncate">{user.nome}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{user.cargo || 'Membro da equipe'}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500 bg-cyan-500/10 p-2 rounded-full"><MessageSquare size={16} /></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default ChatInterno;
