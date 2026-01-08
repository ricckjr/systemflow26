
import React, { useState } from 'react';
import { Profile } from '../../types';
import { useAuth } from '../../src/contexts/AuthContext';
import { Search, Send, Plus, Phone, Video, Info } from 'lucide-react';

const contacts = [
  { id: '1', name: 'Heinrik Nascimento', status: 'online', role: 'TI & Dev' },
  { id: '2', name: 'Amanda Silva', status: 'offline', role: 'Comercial' },
  { id: '3', name: 'Carlos Eduardo', status: 'online', role: 'Marketing' },
  { id: '4', name: 'Julia Costa', status: 'away', role: 'Vendas' },
];

const ChatInterno: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return <div className="p-8 text-center text-white">Carregando perfil...</div>;

  const [activeChat, setActiveChat] = useState(contacts[0]);
  const [message, setMessage] = useState('');

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-surface rounded-2xl shadow-soft border border-line overflow-hidden">
      {/* Sidebar: Chats List */}
      <div className="w-80 border-r border-line flex flex-col shrink-0">
        <div className="p-4 border-b border-line">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-ink-700" size={18} />
            <input 
              type="text" 
              placeholder="Buscar conversas..."
              className="w-full bg-background border-none rounded-lg py-2 pl-10 pr-3 text-sm focus:ring-2 focus:ring-brand-500 text-white placeholder:text-ink-700"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 flex items-center justify-between">
            <h4 className="text-xs font-bold text-ink-700 uppercase tracking-widest">Contatos</h4>
            <button className="p-1 hover:bg-background rounded text-ink-700"><Plus size={16} /></button>
          </div>
          {contacts.map(contact => (
            <button 
              key={contact.id}
              onClick={() => setActiveChat(contact)}
              className={`w-full p-4 flex items-center gap-3 transition-colors ${
                activeChat.id === contact.id ? 'bg-background border-r-2 border-brand-500' : 'hover:bg-background/50'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-ink-700 font-bold uppercase border border-line">
                  {contact.name[0]}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-surface rounded-full ${
                  contact.status === 'online' ? 'bg-green-500' : contact.status === 'away' ? 'bg-yellow-500' : 'bg-slate-500'
                }`}></div>
              </div>
              <div className="text-left overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{contact.name}</p>
                <p className="text-xs text-ink-700 truncate">{contact.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: Active Chat Area */}
      <div className="flex-1 flex flex-col bg-background/30">
        <header className="h-16 bg-surface border-b border-line px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-500 flex items-center justify-center font-bold">
              {activeChat.name[0]}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-none">{activeChat.name}</h3>
              <p className="text-[10px] text-green-500 mt-1 uppercase font-bold tracking-wider">{activeChat.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-ink-700 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors"><Phone size={18} /></button>
            <button className="p-2 text-ink-700 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors"><Video size={18} /></button>
            <button className="p-2 text-ink-700 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg transition-colors"><Info size={18} /></button>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          <div className="flex justify-start">
            <div className="bg-surface p-3 rounded-2xl rounded-tl-none border border-line shadow-soft max-w-[70%]">
              <p className="text-sm text-ink-900">Olá {profile.nome.split(' ')[0]}, tudo bem? Como está o andamento daquela proposta da Cloud?</p>
              <span className="text-[10px] text-ink-700 mt-2 block text-right">14:20</span>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-brand-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[70%]">
              <p className="text-sm">Oi! Estou finalizando agora mesmo. Devo te enviar o rascunho em 10 minutos para revisão.</p>
              <span className="text-[10px] text-brand-200 mt-2 block text-right">14:22</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface border-t border-line">
          <form className="flex items-center gap-3" onSubmit={(e) => e.preventDefault()}>
            <button type="button" className="p-2 text-ink-700 hover:text-white"><Plus size={20} /></button>
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-background border border-line rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-white placeholder:text-ink-700"
            />
            <button 
              type="submit"
              className="bg-brand-600 text-white p-2.5 rounded-xl hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterno;
