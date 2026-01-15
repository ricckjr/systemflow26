import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Info, 
  MessageSquare,
  MoreVertical,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  X,
  UserPlus
} from 'lucide-react';

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
    loading,
    currentUser
  } = useChat();

  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  
  // New Chat Modal State
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');

  // Fetch all users for "New Chat" search
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

  // Helper to get room display info
  const getRoomInfo = (room: ChatRoom) => {
    if (room.type === 'direct') {
      const otherMember = room.members?.find(m => m.user_id !== currentUser?.id);
      return {
        id: room.id,
        name: otherMember?.profile?.nome || 'Usuário Desconhecido',
        avatar_url: otherMember?.profile?.avatar_url,
        isOnline: true, // TODO: Implement presence
        lastMessage: room.last_message
      };
    } else {
      return {
        id: room.id,
        name: room.name || 'Grupo sem nome',
        avatar_url: null, // Could be a group icon
        isOnline: false,
        lastMessage: room.last_message
      };
    }
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId);
  const activeRoomInfo = activeRoom ? getRoomInfo(activeRoom) : null;

  // Filter rooms based on search
  const filteredRooms = rooms.filter(room => {
    const info = getRoomInfo(room);
    return info.name.toLowerCase().includes(search.toLowerCase());
  });

  // Filter users for the New Chat Modal
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
    setMessage(''); // Optimistic clear
    await sendMessage(text);
  };

  const handleStartNewChat = async (userId: string) => {
    await startDirectChat(userId);
    setIsNewChatModalOpen(false);
    setNewChatSearch('');
  };

  // Scroll to bottom of messages
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
    <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-700 relative">
      
      {/* Sidebar List */}
      <div className="w-full md:w-80 lg:w-96 flex flex-col gap-4 shrink-0 h-full">
        {/* Search Header */}
        <div className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)] shadow-lg shadow-black/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversas..."
              className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-all"
            />
          </div>
        </div>

        {/* Rooms List */}
        <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-lg shadow-black/5 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]/50">
            <h4 className="text-xs font-black text-[var(--text-soft)] uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={14} className="text-cyan-400" />
              Mensagens
            </h4>
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="p-1.5 hover:bg-[var(--bg-body)] rounded-lg text-[var(--text-muted)] hover:text-cyan-400 transition-colors tooltip-trigger"
              title="Nova Conversa"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loading && rooms.length === 0 ? (
               <div className="text-center p-4 text-[var(--text-muted)] text-sm">Carregando conversas...</div>
            ) : (
              <>
                {filteredRooms.map(room => {
                  const info = getRoomInfo(room);
                  const isActive = activeRoomId === room.id;
                  
                  return (
                    <button 
                      key={room.id}
                      onClick={() => setActiveRoomId(room.id)}
                      className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                        isActive 
                          ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20' 
                          : 'hover:bg-[var(--bg-body)] border border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {info.avatar_url ? (
                          <img src={info.avatar_url} alt={info.name} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--bg-panel)] shadow-sm" />
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-main)] font-bold uppercase border-2 border-[var(--bg-panel)] shadow-sm ${
                            isActive ? 'bg-cyan-500 text-white' : 'bg-gradient-to-br from-slate-700 to-slate-800'
                          }`}>
                            {info.name.substring(0, 2)}
                          </div>
                        )}
                        {/* Online Status Mock - replace with Real Presence later */}
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-[var(--bg-panel)] rounded-full bg-emerald-500 shadow-sm"></div>
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-0.5">
                          <p className={`text-sm font-bold truncate ${isActive ? 'text-cyan-400' : 'text-[var(--text-main)]'}`}>
                            {info.name}
                          </p>
                          {info.lastMessage && (
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {new Date(info.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs truncate ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                          {info.lastMessage ? (
                            <span className="flex items-center gap-1">
                              {info.lastMessage.sender_id === currentUser?.id && <CheckCheck size={12} className="text-cyan-500" />}
                              {info.lastMessage.content}
                            </span>
                          ) : (
                            <span className="italic opacity-50">Nova conversa</span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {filteredRooms.length === 0 && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-[var(--text-muted)] mb-3">Nenhuma conversa encontrada.</p>
                    <button 
                      onClick={() => setIsNewChatModalOpen(true)}
                      className="text-xs bg-cyan-500/10 text-cyan-500 px-3 py-2 rounded-lg hover:bg-cyan-500/20 transition-colors font-medium"
                    >
                      Iniciar nova conversa
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-xl shadow-black/5 flex flex-col overflow-hidden relative">
        {activeRoomInfo ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0 bg-[var(--bg-body)]/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                   {activeRoomInfo.avatar_url ? (
                      <img src={activeRoomInfo.avatar_url} alt={activeRoomInfo.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold uppercase text-sm shadow-lg shadow-cyan-500/20">
                        {activeRoomInfo.name.substring(0, 2)}
                      </div>
                    )}
                   <div className="absolute bottom-0 right-0 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full bg-emerald-500"></div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)] leading-none">{activeRoomInfo.name}</h3>
                  <p className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    Online agora
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all">
                  <Phone size={20} />
                </button>
                <button className="p-2.5 text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all">
                  <Video size={20} />
                </button>
                <div className="w-px h-6 bg-[var(--border)] mx-1"></div>
                <button className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] rounded-xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-opacity-5">
              {messages.length === 0 && (
                <div className="flex-1 flex items-center justify-center opacity-50 text-sm italic">
                  Nenhuma mensagem ainda. Diga olá!
                </div>
              )}
              
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUser?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] group relative ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {/* Show sender name in group chats if not me */}
                      {!isMe && activeRoom?.type === 'group' && (
                        <span className="text-[10px] text-[var(--text-muted)] ml-1 mb-1">{msg.sender?.nome}</span>
                      )}
                      
                      <div className={`
                        p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative
                        ${isMe 
                          ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm' 
                          : 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-main)] rounded-tl-sm'}
                      `}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
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
            <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border)]">
              <form 
                className="flex items-end gap-3 bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-cyan-500/30 focus-within:border-cyan-500/50 transition-all"
                onSubmit={handleSendMessage}
              >
                <button type="button" className="p-3 text-[var(--text-muted)] hover:text-cyan-400 hover:bg-[var(--bg-panel)] rounded-xl transition-colors">
                  <Paperclip size={20} />
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
                
                <div className="flex items-center gap-1 pb-1">
                  <button type="button" className="p-2 text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-panel)] rounded-xl transition-colors">
                    <Smile size={20} />
                  </button>
                  <button 
                    type="submit"
                    disabled={!message.trim()}
                    className="p-2 bg-cyan-500 text-white rounded-xl hover:bg-cyan-400 disabled:opacity-50 disabled:bg-[var(--text-muted)] transition-all shadow-lg shadow-cyan-500/20"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-soft)] p-8 text-center opacity-60">
            <div className="w-24 h-24 bg-[var(--bg-body)] rounded-full flex items-center justify-center mb-6 border-4 border-[var(--border)]">
              <MessageSquare size={40} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Chat Interno</h3>
            <p className="max-w-xs text-sm text-[var(--text-muted)] mb-6">
              Selecione um colega de equipe ao lado para iniciar uma conversa.
            </p>
            <button 
              onClick={() => setIsNewChatModalOpen(true)}
              className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/20 font-bold"
            >
              <Plus size={20} />
              Iniciar Nova Conversa
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal Overlay */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--bg-panel)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                <UserPlus size={18} className="text-cyan-500" />
                Nova Conversa
              </h3>
              <button 
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-body)]/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
                <input 
                  type="text" 
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl py-2.5 pl-9 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* Users List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {filteredNewChatUsers.length === 0 ? (
                <div className="text-center p-8 text-[var(--text-muted)] text-sm">
                  Nenhum usuário encontrado.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNewChatUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleStartNewChat(user.id)}
                      className="w-full p-3 flex items-center gap-3 rounded-xl hover:bg-[var(--bg-body)] border border-transparent transition-all duration-200 text-left group"
                    >
                      <div className="relative shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.nome} className="w-10 h-10 rounded-full object-cover border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold uppercase text-xs border border-[var(--border)]">
                            {user.nome.substring(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors truncate">
                          {user.nome}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {user.cargo || 'Membro da equipe'}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500">
                        <MessageSquare size={16} />
                      </div>
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
