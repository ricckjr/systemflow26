import React, { useState } from 'react';
import { 
  MessageCircle, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Paperclip, 
  Smile, 
  Mic, 
  Send,
  Check,
  CheckCheck,
  Smartphone,
  Clock,
  Filter
} from 'lucide-react';
import { formatTimeBR } from '@/utils/datetime';

interface ChatContact {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  status: 'online' | 'offline';
  source: 'whatsapp' | 'instagram' | 'web';
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
  status: 'sent' | 'delivered' | 'read';
  type: 'text' | 'image' | 'audio';
}

const mockContacts: ChatContact[] = [
  { id: '1', name: 'Marcos Paulo', lastMessage: 'Gostaria de saber mais sobre o plano Enterprise.', time: '10:42', unread: 2, status: 'online', source: 'whatsapp' },
  { id: '2', name: 'Ana Clara', lastMessage: 'Ok, aguardo o retorno.', time: '09:15', unread: 0, status: 'offline', source: 'whatsapp' },
  { id: '3', name: 'Tech Solutions Ltda', lastMessage: 'Enviamos o comprovante de pagamento.', time: 'Ontem', unread: 0, status: 'online', source: 'web' },
  { id: '4', name: 'Ricardo Oliveira', lastMessage: 'Pode me ligar?', time: 'Ontem', unread: 5, status: 'offline', source: 'instagram' },
  { id: '5', name: 'Fernanda Costa', lastMessage: 'Obrigada!', time: 'Segunda', unread: 0, status: 'offline', source: 'whatsapp' },
];

const mockMessages: Record<string, ChatMessage[]> = {
  '1': [
    { id: '1', text: 'Olá, bom dia!', sender: 'them', time: '10:40', status: 'read', type: 'text' },
    { id: '2', text: 'Vi o anúncio de vocês no Instagram.', sender: 'them', time: '10:40', status: 'read', type: 'text' },
    { id: '3', text: 'Olá Marcos! Tudo bem? Como posso ajudar?', sender: 'me', time: '10:41', status: 'read', type: 'text' },
    { id: '4', text: 'Gostaria de saber mais sobre o plano Enterprise.', sender: 'them', time: '10:42', status: 'read', type: 'text' },
  ]
};

const FlowSmart: React.FC = () => {
  const [activeChatId, setActiveChatId] = useState<string | null>(mockContacts[0].id);
  const [inputText, setInputText] = useState('');
  const [search, setSearch] = useState('');

  const activeContact = mockContacts.find(c => c.id === activeChatId);
  const currentMessages = activeChatId ? (mockMessages[activeChatId] || []) : [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;
    
    // In a real app, this would push to backend
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'me',
      time: formatTimeBR(new Date()),
      status: 'sent',
      type: 'text'
    };
    
    mockMessages[activeChatId] = [...(mockMessages[activeChatId] || []), newMessage];
    setInputText('');
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 animate-in fade-in duration-700">
      
      {/* Sidebar - Contacts List */}
      <div className="w-full md:w-[400px] flex flex-col gap-4 shrink-0">
        
        {/* Status Header */}
        <div className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)] shadow-lg shadow-cyan-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 animate-pulse">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">WhatsApp Business</h3>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Conectado • (11) 9999-9999</p>
            </div>
          </div>
          <button className="p-2 hover:bg-[var(--bg-body)] rounded-xl text-[var(--text-muted)] transition-colors">
            <MoreVertical size={18} />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa ou cliente..."
              className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none transition-all shadow-sm"
            />
          </div>
          <button className="p-3 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-cyan-500/30 transition-all shadow-sm">
            <Filter size={18} />
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-xl shadow-black/5 overflow-hidden flex flex-col">
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {mockContacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(contact => (
              <div 
                key={contact.id}
                onClick={() => setActiveChatId(contact.id)}
                className={`p-4 border-b border-[var(--border)] cursor-pointer transition-all hover:bg-[var(--bg-body)] group relative
                  ${activeChatId === contact.id ? 'bg-[var(--bg-body)] border-l-4 border-l-cyan-500' : 'border-l-4 border-l-transparent'}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-[var(--text-main)] font-bold text-lg border border-[var(--border)]">
                        {contact.name.substring(0, 1)}
                      </div>
                      {contact.source === 'whatsapp' && (
                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full border-2 border-[var(--bg-panel)]">
                          <MessageCircle size={10} fill="currentColor" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${activeChatId === contact.id ? 'text-[var(--text-main)]' : 'text-[var(--text-main)]'}`}>
                        {contact.name}
                      </h4>
                      <span className="text-[10px] text-[var(--text-soft)] capitalize">{contact.source}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-medium ${contact.unread > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                      {contact.time}
                    </span>
                    {contact.unread > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm shadow-emerald-500/20">
                        {contact.unread}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-soft)] line-clamp-1 pl-[60px] pr-4">
                  {contact.lastMessage}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-2xl shadow-black/10 flex flex-col overflow-hidden relative">
        {activeContact ? (
          <>
            {/* Header */}
            <header className="h-20 border-b border-[var(--border)] bg-[var(--bg-body)]/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/20">
                  {activeContact.name.substring(0, 1)}
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-main)]">{activeContact.name}</h3>
                  <p className="text-xs text-[var(--text-soft)] flex items-center gap-1">
                    {activeContact.source === 'whatsapp' && <MessageCircle size={12} className="text-emerald-400" />}
                    +55 11 99999-9999
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all" title="Ligar">
                  <Phone size={20} />
                </button>
                <button className="p-2.5 text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all" title="Pesquisar na conversa">
                  <Search size={20} />
                </button>
                <button className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-body)] rounded-xl transition-all">
                  <MoreVertical size={20} />
                </button>
              </div>
            </header>

            {/* Chat Background & Messages */}
            <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-opacity-5 relative flex flex-col">
              <div className="absolute inset-0 bg-[var(--bg-body)]/30 pointer-events-none" />
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 relative z-0">
                {currentMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[65%] rounded-2xl p-3 shadow-sm relative group
                      ${msg.sender === 'me' 
                        ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-tr-none' 
                        : 'bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] rounded-tl-none'}
                    `}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender === 'me' ? 'text-emerald-100' : 'text-[var(--text-muted)]'}`}>
                        <span className="text-[10px] font-medium">{msg.time}</span>
                        {msg.sender === 'me' && (
                          <CheckCheck size={14} className={msg.status === 'read' ? 'text-cyan-300' : 'opacity-70'} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer / Input */}
            <div className="p-4 bg-[var(--bg-panel)] border-t border-[var(--border)]">
              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                <div className="flex items-center gap-1 bg-[var(--bg-body)] border border-[var(--border)] rounded-2xl px-2 py-1 shadow-inner flex-1 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500/50 transition-all">
                  <button type="button" className="p-2 text-[var(--text-muted)] hover:text-amber-400 transition-colors">
                    <Smile size={20} />
                  </button>
                  <button type="button" className="p-2 text-[var(--text-muted)] hover:text-cyan-400 transition-colors">
                    <Paperclip size={20} />
                  </button>
                  <input 
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 bg-transparent border-none py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:ring-0 outline-none"
                  />
                </div>
                
                {inputText.trim() ? (
                  <button type="submit" className="p-3.5 bg-emerald-500 text-white rounded-full hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                    <Send size={20} className="ml-0.5" />
                  </button>
                ) : (
                  <button type="button" className="p-3.5 bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)] rounded-full hover:text-emerald-400 hover:border-emerald-500/30 transition-all active:scale-95">
                    <Mic size={20} />
                  </button>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50">
            <div className="w-24 h-24 bg-[var(--bg-body)] rounded-full flex items-center justify-center mb-6 border-4 border-[var(--border)]">
              <Smartphone size={40} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--text-main)]">FlowSmart Web</h3>
            <p className="text-[var(--text-soft)] text-sm mt-2 max-w-xs text-center">
              Selecione uma conversa para iniciar o atendimento ao cliente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowSmart;
