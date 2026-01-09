import React, { useState, useEffect } from 'react';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProfiles } from '@/services/profiles';
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
  CheckCheck
} from 'lucide-react';

const ChatInterno: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  const [users, setUsers] = useState<Profile[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  
  // Mock messages for demo (since we don't have a full realtime message table schema yet)
  // In a real implementation, we would fetch from 'chat_messages' table
  const [messages, setMessages] = useState<Record<string, { id: string; text: string; sender: 'me' | 'them'; time: string; read: boolean }[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchProfiles();
        // Filter out current user
        const otherUsers = data.filter(u => u.id !== profile?.id);
        setUsers(otherUsers);
        
        // Select first user by default if available
        if (otherUsers.length > 0 && !activeChatId) {
          setActiveChatId(otherUsers[0].id);
        }
      } catch (error) {
        console.error("Error fetching users for chat:", error);
      }
    })();
  }, [profile?.id]);

  // Initial mock messages generator
  useEffect(() => {
    if (users.length > 0 && Object.keys(messages).length === 0) {
      const initialMsgs: typeof messages = {};
      users.forEach(u => {
        initialMsgs[u.id] = [
          { id: '1', text: `Olá ${u.nome.split(' ')[0]}, tudo bem?`, sender: 'me', time: '09:00', read: true },
          { id: '2', text: 'Tudo ótimo! E com você?', sender: 'them', time: '09:05', read: true },
          { id: '3', text: 'Precisamos alinhar aquele projeto.', sender: 'me', time: '09:10', read: true },
        ];
      });
      setMessages(initialMsgs);
    }
  }, [users]);

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-cyan-500 gap-2">
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );

  const activeUser = users.find(u => u.id === activeChatId);
  const filteredUsers = users.filter(u => u.nome.toLowerCase().includes(search.toLowerCase()));

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeChatId) return;

    const newMsg = {
      id: Date.now().toString(),
      text: message,
      sender: 'me' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };

    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMsg]
    }));
    setMessage('');

    // Mock auto-reply
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [activeChatId]: [...(prev[activeChatId] || []), {
          id: (Date.now() + 1).toString(),
          text: 'Entendido! Vou verificar isso agora mesmo.',
          sender: 'them' as const,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: true
        }]
      }));
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-700">
      
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

        {/* Users List */}
        <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-lg shadow-black/5 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]/50">
            <h4 className="text-xs font-black text-[var(--text-soft)] uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={14} className="text-cyan-400" />
              Mensagens
            </h4>
            <button className="p-1.5 hover:bg-[var(--bg-body)] rounded-lg text-[var(--text-muted)] hover:text-cyan-400 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredUsers.map(u => {
              const lastMsg = messages[u.id]?.[messages[u.id]?.length - 1];
              const isActive = activeChatId === u.id;
              
              return (
                <button 
                  key={u.id}
                  onClick={() => setActiveChatId(u.id)}
                  className={`w-full p-3 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20' 
                      : 'hover:bg-[var(--bg-body)] border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.nome} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--bg-panel)] shadow-sm" />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[var(--text-main)] font-bold uppercase border-2 border-[var(--bg-panel)] shadow-sm ${
                        isActive ? 'bg-cyan-500 text-white' : 'bg-gradient-to-br from-slate-700 to-slate-800'
                      }`}>
                        {u.nome.substring(0, 2)}
                      </div>
                    )}
                    {/* Online Status Mock */}
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-[var(--bg-panel)] rounded-full bg-emerald-500 shadow-sm"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className={`text-sm font-bold truncate ${isActive ? 'text-cyan-400' : 'text-[var(--text-main)]'}`}>
                        {u.nome}
                      </p>
                      {lastMsg && (
                        <span className="text-[10px] text-[var(--text-muted)]">{lastMsg.time}</span>
                      )}
                    </div>
                    <p className={`text-xs truncate ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-soft)]'}`}>
                      {lastMsg ? (
                        <span className="flex items-center gap-1">
                          {lastMsg.sender === 'me' && <CheckCheck size={12} className="text-cyan-500" />}
                          {lastMsg.text}
                        </span>
                      ) : (
                        <span className="italic opacity-50">Nova conversa</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-xl shadow-black/5 flex flex-col overflow-hidden relative">
        {activeUser ? (
          <>
            {/* Chat Header */}
            <header className="h-20 border-b border-[var(--border)] px-6 flex items-center justify-between shrink-0 bg-[var(--bg-body)]/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <div className="relative">
                   {activeUser.avatar_url ? (
                      <img src={activeUser.avatar_url} alt={activeUser.nome} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold uppercase text-sm shadow-lg shadow-cyan-500/20">
                        {activeUser.nome.substring(0, 2)}
                      </div>
                    )}
                   <div className="absolute bottom-0 right-0 w-3 h-3 border-2 border-[var(--bg-panel)] rounded-full bg-emerald-500"></div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)] leading-none">{activeUser.nome}</h3>
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
              <div className="text-center my-4">
                <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-body)] px-3 py-1 rounded-full border border-[var(--border)]">
                  Hoje
                </span>
              </div>
              
              {(messages[activeUser.id] || []).map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] group relative ${msg.sender === 'me' ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`
                      p-4 rounded-2xl text-sm leading-relaxed shadow-sm relative
                      ${msg.sender === 'me' 
                        ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-sm' 
                        : 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-main)] rounded-tl-sm'}
                    `}>
                      {msg.text}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <span className="text-[10px] text-[var(--text-muted)] font-medium">{msg.time}</span>
                      {msg.sender === 'me' && (
                        <CheckCheck size={12} className={msg.read ? 'text-cyan-400' : 'text-[var(--text-muted)]'} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            <p className="max-w-xs">Selecione um colega de equipe ao lado para iniciar uma conversa segura e direta.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterno;
