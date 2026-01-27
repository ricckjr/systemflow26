import React, { useEffect, useRef, useState } from 'react';
import { 
  Send, 
  Loader2, 
  AlertCircle, 
  User, 
  Bot, 
  Sparkles, 
  Zap,
  MessageSquare,
  Eraser,
  Copy,
  Check
} from 'lucide-react';
import { Profile, ProfilePermissao } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { formatTimeBR } from '@/utils/datetime';

type ChatMsg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; at: string };

const SUGGESTIONS = [
  { icon: <Zap size={16} />, text: "Criar uma estratégia de vendas para este mês" },
  { icon: <MessageSquare size={16} />, text: "Escrever um email de follow-up para cliente" },
  { icon: <Bot size={16} />, text: "Analisar a performance do time comercial" },
];

const IAFlow: React.FC<{ profile?: Profile; perms?: ProfilePermissao[] }> = ({ profile: propProfile, perms: propPerms }) => {
  const { profile: authProfile, permissions: authPerms } = useAuth();
  const profile = propProfile || authProfile;
  const perms = propPerms || authPerms;

  const WEBHOOK_URL = 'https://flowsharp.ddns.net/webhook-test/iasystemflow';
  
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const saved = localStorage.getItem('iaflow-chat');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('iaflow-chat', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico da conversa?')) {
      setMessages([]);
      localStorage.removeItem('iaflow-chat');
    }
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || sending) return;
    
    setError(null);
    setSending(true);
    setInput('');

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: text, at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const permissions = (perms || []).map(p => ({
        modulo: p.permissoes?.modulo ?? undefined,
        submodulo: p.permissoes?.submodulo ?? undefined,
        visualizar: p.visualizar,
        editar: p.editar,
        excluir: p.excluir,
      }));

      const payload = {
        user: profile ? { id: profile.id, nome: profile.nome, email: profile.email_login, cargo: profile.cargo } : undefined,
        message: text,
        metadata: { origin: 'web', timestamp: new Date().toISOString() },
        permissions,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      };

      const apiKey = (import.meta as any).env?.VITE_N8N_API_KEY;
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
        body: JSON.stringify(payload)
      });

      const extractText = (obj: any): string => {
        if (obj == null) return 'OK';
        if (typeof obj === 'string') return obj;
        if (typeof obj !== 'object') return String(obj);
        if (typeof obj.reply === 'string') return obj.reply;
        if (typeof obj.message === 'string') return obj.message;
        if (typeof obj.mensagem === 'string') return obj.mensagem;
        if (typeof obj.text === 'string') return obj.text;
        if (Array.isArray(obj.messages)) {
          const parts = obj.messages.map((m: any) => typeof m === 'string' ? m : (m?.content ?? ''));
          const joined = parts.filter(Boolean).join('\n');
          if (joined) return joined;
        }
        if (Array.isArray(obj)) {
          const parts = obj.map((m: any) => {
            if (typeof m === 'string') return m;
            if (typeof m?.mensagem === 'string') return m.mensagem;
            if (typeof m?.message === 'string') return m.message;
            return m?.content ?? '';
          });
          const joined = parts.filter(Boolean).join('\n');
          if (joined) return joined;
        }
        if (obj.data) return extractText(obj.data);
        const candidates = ['content', 'result', 'output', 'hint'];
        for (const k of candidates) {
          if (typeof obj[k] === 'string') return obj[k];
        }
        try {
          return JSON.stringify(obj, null, 2);
        } catch {
          return String(obj);
        }
      };

      const appendAssistant = (text: string) => {
        const botMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: text, at: new Date().toISOString() };
        setMessages(prev => [...prev, botMsg]);
      };

      if (!res.ok) {
        const hintRaw = await res.text().catch(() => '');
        if (res.status === 404 && hintRaw.includes('webhook')) {
          appendAssistant('⚠️ Webhook em modo de teste. No n8n, clique em "Execute workflow" e reenvie a mensagem.');
        } else {
          appendAssistant(`⚠️ Falha (${res.status}). ${hintRaw || 'Tente novamente em instantes.'}`);
        }
      } else {
        const raw = await res.text().catch(() => '');
        if (!raw) {
          appendAssistant('Recebido, mas sem resposta de texto.');
        } else {
          const trimmed = raw.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                for (const it of parsed) {
                  const t = extractText(it);
                  if (t) appendAssistant(t);
                }
              } else {
                const t = extractText(parsed);
                if (t) appendAssistant(t);
              }
            } catch {
              appendAssistant(trimmed);
            }
          } else {
            appendAssistant(trimmed);
          }
        }
      }
    } catch (e: any) {
      setError('Erro de conexão. Verifique sua internet.');
      const botMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: 'Não foi possível conectar ao assistente.', at: new Date().toISOString() };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-cyan-500 gap-2">
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col bg-[var(--bg-panel)] rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden relative animate-in fade-in duration-700">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-cyan-500/10 opacity-50"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[120px] bg-blue-600/10 opacity-50"></div>
      </div>

      {/* Header */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-body)]/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Bot size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-main)] flex items-center gap-2">
              Assistente Flow
              <Sparkles size={12} className="text-cyan-400" />
            </h3>
            <p className="text-[10px] text-[var(--text-muted)]">Inteligência Artificial Corporativa</p>
          </div>
        </div>
        
        {messages.length > 0 && (
          <button 
            onClick={clearChat}
            className="p-2 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
            title="Limpar Conversa"
          >
            <Eraser size={16} />
            <span className="hidden sm:inline">Limpar</span>
          </button>
        )}
      </header>

      {/* Chat Area */}
      <div 
        ref={listRef} 
        className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 scroll-smooth relative z-0"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-forwards">
            <div className="w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full flex items-center justify-center mb-8 border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
              <Bot size={48} className="text-cyan-400" />
            </div>
            <h2 className="text-3xl font-bold text-[var(--text-main)] mb-3">Como posso ajudar hoje?</h2>
            <p className="text-[var(--text-soft)] max-w-md mb-12">
              Sou sua inteligência artificial integrada ao SystemFlow. Posso ajudar com análises, redação, dúvidas do sistema e muito mais.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.text)}
                  className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-[var(--bg-body)] border border-[var(--border)] hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all group text-center"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-panel)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-cyan-400 group-hover:scale-110 transition-all">
                    {s.icon}
                  </div>
                  <span className="text-xs font-medium text-[var(--text-main)] group-hover:text-cyan-400 transition-colors">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`flex items-start gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-md ${
                    m.role === 'user' 
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white' 
                      : 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white'
                  }`}>
                    {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>

                  {/* Bubble */}
                  <div className={`group relative p-4 md:p-6 rounded-2xl text-sm leading-relaxed shadow-sm
                    ${m.role === 'user' 
                      ? 'bg-[var(--bg-body)] border border-[var(--border)] text-[var(--text-main)] rounded-tr-none' 
                      : 'bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/10 text-[var(--text-main)] rounded-tl-none'}
                  `}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    
                    {/* Message Actions */}
                    <div className={`absolute -bottom-6 ${m.role === 'user' ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2`}>
                       <span className="text-[10px] text-[var(--text-muted)]">{formatTimeBR(m.at)}</span>
                       {m.role === 'assistant' && (
                         <button 
                           onClick={() => handleCopy(m.content, m.id)} 
                           className="p-1 text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
                           title="Copiar"
                         >
                           {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />}
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-start gap-4 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Bot size={16} />
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/10 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div className="h-4" /> {/* Spacer */}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-[var(--bg-body)]/80 backdrop-blur-md border-t border-[var(--border)] z-10">
        <div className="max-w-4xl mx-auto relative">
          {error && (
            <div className="absolute -top-12 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-md shadow-lg">
                <AlertCircle size={14} /> {error}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-2 shadow-inner focus-within:ring-2 focus-within:ring-cyan-500/30 focus-within:border-cyan-500/50 transition-all">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending}
              placeholder={sending ? "Aguardando resposta..." : "Envie uma mensagem para o Flow..."}
              className="flex-1 bg-transparent border-none px-4 py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:ring-0 outline-none disabled:opacity-50"
              autoFocus
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg
                ${!input.trim() || sending 
                  ? 'bg-[var(--bg-body)] text-[var(--text-muted)] shadow-none' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:shadow-cyan-500/25 hover:scale-105 active:scale-95'}
              `}
            >
              {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-3">
            O Assistente Flow pode cometer erros. Considere verificar informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default IAFlow;
