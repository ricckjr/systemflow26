import React, { useState, useEffect, useMemo, useRef } from 'react';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfiles } from '@/services/profiles';
import { useChat } from '@/hooks/useChat';
import { ChatRoom } from '@/types/chat';
import { 
  Search, 
  Send, 
  Plus, 
  Phone, 
  Video, 
  MessageSquare,
  MoreVertical,
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
import { supabase } from '@/services/supabase';

// Status Types
type UserStatus = 'online' | 'busy' | 'away' | 'offline';

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
    startDirectChat,
    uploadAttachment,
    loading,
    currentUser
  } = useChat();

  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  
  // Status State
  const [myStatus, setMyStatus] = useState<UserStatus>('online');
  const [usersStatus, setUsersStatus] = useState<Record<string, UserStatus>>({});
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

  // New Chat Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  // Mobile view state
  const [showMobileList, setShowMobileList] = useState(true);

  // Attachments & Audio & Emoji State
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  // Hidden File Inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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

  // Presence & Status Logic
  useEffect(() => {
    if (!currentUser?.id) return;

    // 1. Subscribe to presence channel
    const presenceChannel = supabase.channel('global_presence')
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState();
        const statusMap: Record<string, UserStatus> = {};
        
        Object.values(newState).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) {
              statusMap[p.user_id] = p.status || 'online';
            }
          });
        });
        setUsersStatus(prev => ({ ...prev, ...statusMap }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ 
            user_id: currentUser.id, 
            online_at: new Date().toISOString(),
            status: myStatus 
          });
        }
      });

    // 2. Idle Timer logic (Auto-Away after 5 min)
    let idleTimer: NodeJS.Timeout;
    const resetIdleTimer = () => {
        if (myStatus === 'busy') return; // Don't override busy
        
        if (myStatus === 'away') {
           setMyStatus('online'); // Auto-back
           presenceChannel.track({ user_id: currentUser.id, status: 'online' });
        }
        
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
           if (myStatus === 'online') {
             setMyStatus('away');
             presenceChannel.track({ user_id: currentUser.id, status: 'away' });
           }
        }, 5 * 60 * 1000); // 5 minutes
    };

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);

    return () => {
      presenceChannel.unsubscribe();
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [currentUser, myStatus]);

  // Update status manually
  const handleStatusChange = async (status: UserStatus) => {
    setMyStatus(status);
    setIsStatusMenuOpen(false);
    await supabase.channel('global_presence').track({ 
        user_id: currentUser?.id, 
        status 
    });
    
    // Also update in DB for persistence if needed
    if (currentUser?.id) {
      await supabase.rpc('update_user_status', { new_status: status });
    }
  };

  // ... (Keep existing helpers like handleRoomSelect, etc.)
  const handleRoomSelect = (roomId: string) => {
    setActiveRoomId(roomId);
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
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.split('/')[1].split(';')[0];
        const audioFile = new File([audioBlob], `voice_message_${Date.now()}.${ext}`, { type: mimeType });
        try {
          const url = await uploadAttachment(audioFile);
          await sendMessage('', [{ 
            type: 'audio', url, name: 'Mensagem de Voz', mime_type: mimeType, size: audioFile.size
          }]);
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
      const url = await uploadAttachment(file);
      await sendMessage('', [{ 
        type, url, name: file.name, mime_type: file.type, size: file.size
      }]);
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
    if (room.type === 'direct') {
      const otherMember = room.members?.find(m => m.user_id !== currentUser?.id);
      const otherId = otherMember?.user_id || '';
      // Prioritize realtime status, fallback to 'offline'
      const status = usersStatus[otherId] || 'offline';
      
      return {
        id: room.id,
        name: otherMember?.profile?.nome || 'Usuário Desconhecido',
        avatar_url: otherMember?.profile?.avatar_url,
        status: status, 
        lastMessage: room.last_message,
        role: otherMember?.profile?.cargo || 'Membro'
      };
    } else {
      return {
        id: room.id,
        name: room.name || 'Grupo sem nome',
        avatar_url: null,
        status: null, // Groups don't have single status
        lastMessage: room.last_message,
        role: 'Grupo'
      };
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activeRoomInfo = activeRoom ? getRoomInfo(activeRoom) : null;

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoomId) return;
    const text = message;
    setMessage('');
    setShowEmojiPicker(false); // Close picker on send
    await sendMessage(text);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-[#1e293b] border border-[var(--border)]`}>
                    {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Me" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        profile.nome?.substring(0, 2).toUpperCase()
                    )}
                 </div>
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
                    
                    {isStatusMenuOpen && (
                        <div className="absolute top-6 left-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-1 z-50 w-32 animate-in zoom-in-95 duration-200">
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
                  // If has unread messages (mock logic, ideally check last_read_at)
                  const hasUnread = false; 
                  
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
                        {info.avatar_url ? (
                          <img src={info.avatar_url} alt={info.name} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--bg-panel)] shadow-sm" />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-main)] font-bold uppercase border-2 border-[var(--bg-panel)] shadow-sm transition-colors ${
                            isActive ? 'bg-cyan-600 text-white' : 'bg-[#1e293b] text-gray-400'
                          }`}>
                            {info.name.substring(0, 2)}
                          </div>
                        )}
                        {/* Status Indicator */}
                        {info.status && (
                          <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[info.status]} shadow-sm`}></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className={`text-sm font-semibold truncate ${isActive ? 'text-cyan-400' : 'text-[var(--text-main)]'} ${hasUnread ? 'font-bold' : ''}`}>
                            {info.name}
                          </p>
                          {info.lastMessage && (
                            <span className={`text-[10px] ${isActive ? 'text-cyan-500/70' : 'text-[var(--text-muted)]'}`}>
                              {new Date(info.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate flex items-center gap-1.5 ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'} ${hasUnread ? 'font-semibold text-white' : ''}`}>
                          {info.lastMessage ? (
                            <>
                              {info.lastMessage.sender_id === currentUser?.id && (
                                <CheckCheck size={14} className={isActive ? 'text-cyan-500' : 'text-[var(--text-muted)]'} />
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

                <div className="relative">
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
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)] leading-none">{activeRoomInfo.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeRoomInfo.status ? STATUS_COLORS[activeRoomInfo.status] : 'bg-gray-500'}`}></span>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium">
                        {activeRoomInfo.status ? STATUS_LABELS[activeRoomInfo.status] : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
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
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 bg-[#0B0F14] relative">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiZmZmZmZiIvPjwvc3ZnPg==')] [mask-image:linear-gradient(to_bottom,transparent,black)]"></div>
              
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
                const hasAttachments = msg.attachments && msg.attachments.length > 0;

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} z-0`}>
                    <div className={`max-w-[75%] md:max-w-[60%] group relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && activeRoom?.type === 'group' && !isSequence && (
                        <span className="text-[10px] text-[var(--text-soft)] ml-1 mb-1 font-bold">{msg.sender?.nome}</span>
                      )}
                      
                      <div className={`
                        px-4 py-3 text-[14px] leading-relaxed shadow-sm relative break-words
                        ${isMe 
                          ? 'bg-[#0284C7] text-white rounded-2xl rounded-tr-none' 
                          : 'bg-[#1E293B] border border-[var(--border)] text-gray-200 rounded-2xl rounded-tl-none'}
                        ${isSequence ? (isMe ? 'mt-1 rounded-tr-2xl' : 'mt-1 rounded-tl-2xl') : ''}
                      `}>
                        {hasAttachments ? (
                           <div className="flex flex-col gap-2">
                             {msg.attachments?.map((att, idx) => (
                               <div key={idx} className="bg-black/20 p-2 rounded-lg">
                                 {att.type === 'image' && (
                                   <img src={att.url} alt="Attachment" className="max-w-full rounded-lg max-h-60 object-cover" />
                                 )}
                                 {att.type === 'audio' && (
                                   <div className="flex items-center gap-2 min-w-[200px]">
                                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                        <Mic size={14} />
                                      </div>
                                      <audio controls src={att.url} className="h-8 w-full max-w-[200px]" />
                                   </div>
                                 )}
                                 {att.type === 'document' && (
                                    <a href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                                      <FileText size={16} />
                                      {att.name || 'Documento'}
                                    </a>
                                 )}
                               </div>
                             ))}
                             {msg.content && <p>{msg.content}</p>}
                           </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-1 mt-1 px-1 opacity-60 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <CheckCheck size={12} className="text-cyan-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border)] relative">
              
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
                    <button type="button" onClick={() => setShowAttachmentsMenu(!showAttachmentsMenu)} className={`p-2 rounded-full transition-all mb-0.5 ${showAttachmentsMenu ? 'bg-cyan-500/10 text-cyan-500 rotate-45' : 'text-[var(--text-muted)] hover:text-cyan-500 hover:bg-[var(--bg-panel)]'}`}>
                      <Plus size={20} />
                    </button>
                    
                    <textarea 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Digite sua mensagem..."
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

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-panel)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 text-lg"><UserPlus size={20} className="text-cyan-500" /> Nova Conversa</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] rounded-lg transition-colors"><X size={20} /></button>
            </div>
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
                      <div className="relative shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.nome} className="w-12 h-12 rounded-full object-cover border border-[var(--border)]" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1e293b] to-[#0f172a] flex items-center justify-center text-white font-bold uppercase text-sm border border-[var(--border)]">{user.nome.substring(0, 2)}</div>
                        )}
                         {/* Status dot in user list */}
                         {usersStatus[user.id] && (
                             <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full ${STATUS_COLORS[usersStatus[user.id]]}`}></div>
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
        </div>
      )}
    </div>
  );
};

export default ChatInterno;
