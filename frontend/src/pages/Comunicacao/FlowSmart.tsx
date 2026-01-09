
import React from 'react';
import { Smartphone, MessageCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const FlowSmart: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">FlowSmart</h2>
          <p className="text-industrial-text-secondary">Gestão de WhatsApp e Atendimento Externo</p>
        </div>
        <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-500/20 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          Conectado: (11) 99999-9999
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-industrial-surface p-6 rounded-2xl shadow-sm border border-industrial-border flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-brand-500/10 text-brand-500 rounded-2xl flex items-center justify-center mb-4">
            <MessageCircle size={32} />
          </div>
          <h4 className="font-bold text-white">Ativos Hoje</h4>
          <p className="text-3xl font-black text-brand-500 mt-2">1,248</p>
          <p className="text-xs text-industrial-text-secondary mt-1">Mensagens enviadas via API</p>
        </div>
        <div className="bg-industrial-surface p-6 rounded-2xl shadow-sm border border-industrial-border flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h4 className="font-bold text-white">Taxa de Leitura</h4>
          <p className="text-3xl font-black text-brand-500 mt-2">94.2%</p>
          <p className="text-xs text-industrial-text-secondary mt-1">Engajamento de broadcast</p>
        </div>
        <div className="bg-industrial-surface p-6 rounded-2xl shadow-sm border border-industrial-border flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
            <Clock size={32} />
          </div>
          <h4 className="font-bold text-white">Tempo de Resposta</h4>
          <p className="text-3xl font-black text-brand-500 mt-2">02m 45s</p>
          <p className="text-xs text-industrial-text-secondary mt-1">Média por atendimento</p>
        </div>
      </div>

      <div className="bg-industrial-surface rounded-2xl border border-industrial-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-industrial-border bg-industrial-bg/50 flex items-center justify-between">
          <h3 className="font-bold text-white">Últimas Interações FlowSmart</h3>
          <button className="text-xs font-bold text-brand-500 hover:underline">Ver Histórico Completo</button>
        </div>
        <div className="divide-y divide-industrial-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-6 flex items-center justify-between gap-4 hover:bg-industrial-bg/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-industrial-bg rounded-xl flex items-center justify-center text-industrial-text-secondary">
                  <Smartphone size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Cliente #4920 - Marcos Paulo</p>
                  <p className="text-xs text-industrial-text-secondary">Status: Aguardando Resposta Humana</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex flex-col items-end">
                  <p className="text-xs font-bold text-white">IA Respondendo</p>
                  <p className="text-[10px] text-industrial-text-secondary">Ativado há 5min</p>
                </div>
                <button className="bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-700 transition-all">Assumir Chat</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlowSmart;
