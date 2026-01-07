
import React, { useEffect, useRef, useState } from 'react';
import { Send, Loader2, AlertCircle, User, Bot, Sparkles } from 'lucide-react';
import { Profile, ProfilePermissao } from '../../types';

type ChatMsg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; at: string };

const IAFlow: React.FC<{ profile: Profile; perms: ProfilePermissao[] }> = ({ profile, perms }) => {
  const WEBHOOK_URL = 'https://flowsharp.ddns.net/webhook-test/iasystemflow';
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const saved = localStorage.getItem('iaflow-chat');
    return saved ? JSON.parse(saved) : [
      { id: crypto.randomUUID(), role: 'system', content: 'Bem-vindo ao Assistente Flow. Envie sua pergunta para começar.', at: new Date().toISOString() }
    ];
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('iaflow-chat', JSON.stringify(messages));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: text, at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const permissions = (perms || []).map(p => ({
        modulo: p.permissoes?.modulo ?? undefined,
        submodulo: p.permissoes?.submodulo ?? undefined,
        visualizar: p.visualizar,
        editar: p.editar,
        excluir: p.excluir,
      }));
      const payload = {
        user: { id: profile.id, nome: profile.nome, email: profile.email_login, role: profile.role },
        message: text,
        metadata: { origin: 'web', timestamp: new Date().toISOString() },
        permissions,
        history: messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
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
          appendAssistant('Webhook em modo de teste. No n8n, clique em "Execute workflow" e reenvie a mensagem.');
        } else {
          appendAssistant(`Falha (${res.status}). ${hintRaw || 'Tente novamente em instantes.'}`);
        }
      } else {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/event-stream') && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n');
            buffer = parts.pop() || '';
            for (const line of parts) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const payloadStr = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
              try {
                const obj = JSON.parse(payloadStr);
                if (Array.isArray(obj)) {
                  for (const it of obj) {
                    const t = extractText(it);
                    if (t) appendAssistant(t);
                  }
                } else {
                  const t = extractText(obj);
                  if (t) appendAssistant(t);
                }
              } catch {
                appendAssistant(payloadStr);
              }
            }
          }
          if (buffer.trim()) appendAssistant(buffer.trim());
        } else {
          const raw = await res.text().catch(() => '');
          if (!raw) {
            appendAssistant('OK');
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
      }
    } catch (e: any) {
      setError('Conexão falhou. Verifique o webhook e sua rede.');
      const botMsg: ChatMsg = { id: crypto.randomUUID(), role: 'assistant', content: 'Não foi possível conectar ao webhook.', at: new Date().toISOString() };
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

  return (
    <div className="relative h-[calc(100vh-10rem)] bg-industrial-bg rounded-[2.5rem] border border-industrial-border overflow-hidden p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 bg-brand-500/30"></div>
        <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 bg-indigo-500/30"></div>
      </div>
      <div className="relative h-full grid grid-cols-1 gap-6">
        <div className="bg-industrial-surface/50 backdrop-blur-sm rounded-[2rem] border border-industrial-border flex flex-col overflow-hidden">
          <div className="p-6 flex items-center justify-between border-b border-industrial-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-industrial-text-secondary">Assistente Flow</h3>
                <p className="text-[10px] text-industrial-text-secondary">Interface conversacional avançada</p>
              </div>
            </div>
            <Sparkles size={18} className="text-brand-600" />
          </div>
          <div ref={listRef} className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {(() => {
                  let isJson = false;
                  try {
                    if (m.role === 'assistant' && typeof m.content === 'string' && m.content.trim().length) {
                      const trimmed = m.content.trim();
                      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                        JSON.parse(trimmed);
                        isJson = true;
                      }
                    }
                  } catch {}
                  const bubbleBase = 'max-w-[90%] p-4 rounded-3xl text-sm shadow-sm';
                  const userBubble = 'bg-gradient-to-br from-brand-600 to-brand-700 text-white';
                  const botBubble = 'bg-industrial-bg border border-industrial-border text-white';
                  return (
                    <div className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`h-8 w-8 rounded-xl ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-brand-500/10 text-brand-400'} flex items-center justify-center shrink-0`}>
                        {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={`${bubbleBase} ${m.role === 'user' ? userBubble : botBubble}`}>
                        {isJson ? (
                          <pre className="mono whitespace-pre-wrap break-words">{m.content}</pre>
                        ) : (
                          <p className="leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                        )}
                        <p className="mt-2 text-[10px] opacity-60">{new Date(m.at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-industrial-border">
            {error && (
              <div className="mb-3 flex items-center gap-2 text-rose-500 text-xs font-bold">
                <AlertCircle size={16} /> {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-industrial-bg text-industrial-text-secondary border border-industrial-border">
                <User size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{profile.nome}</span>
              </div>
              <div className="flex-1 flex items-center gap-3 bg-industrial-bg rounded-2xl px-3 py-2 border border-industrial-border">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-transparent border-none px-2 py-2 text-sm text-white outline-none placeholder:text-industrial-text-secondary"
                />
                <button
                  onClick={send}
                  disabled={sending}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  <span className="text-sm font-bold">Enviar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IAFlow;
