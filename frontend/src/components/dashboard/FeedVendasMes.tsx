import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { startOfMonth, endOfMonth, parseISO, format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, DollarSign, User, Briefcase, CalendarDays, Zap } from 'lucide-react';

const FASE_CONQUISTADO_ID = '88a8b9bb-30db-4eb7-a351-182daeeb0f02';

type Venda = {
  id: string;
  cliente: string;
  vendedor: string;
  vendedor_avatar_url?: string | null;
  produto: string;
  valor: number;
  data_conquistado: string;
  is_new?: boolean;
};

export function FeedVendasMes() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load sound
  useEffect(() => {
    audioRef.current = new Audio('/src/assets/sounds/som_venda.mp3');
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchVendasIniciais();
  }, []);

  // Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel('feed-vendas-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and UPDATE
          schema: 'public',
          table: 'crm_oportunidades',
        },
        async (payload) => {
          const newRec = payload.new as any;
          
          // Check if it matches criteria: Conquered AND has date AND is current month
          if (
            newRec.id_fase === FASE_CONQUISTADO_ID &&
            newRec.data_conquistado
          ) {
             const dataConquistado = parseISO(newRec.data_conquistado);
             const now = new Date();
             const start = startOfMonth(now);
             const end = endOfMonth(now);

             // Must be within current month
             if (isWithinInterval(dataConquistado, { start, end })) {
                // Fetch full details
                const fullData = await fetchFullVendaDetails(newRec.id_oport);
                
                if (fullData) {
                    setVendas((prev) => {
                        const exists = prev.find(v => v.id === fullData.id);
                        if (exists) {
                            // Update existing
                            return prev.map(v => v.id === fullData.id ? fullData : v)
                                       .sort((a, b) => new Date(b.data_conquistado).getTime() - new Date(a.data_conquistado).getTime());
                        } else {
                            // New to the list! Play sound.
                            playSound();
                            // Add with highlight flag
                            const newList = [{ ...fullData, is_new: true }, ...prev]
                                   .sort((a, b) => new Date(b.data_conquistado).getTime() - new Date(a.data_conquistado).getTime())
                                   .slice(0, 20);
                            return newList;
                        }
                    });
                }
             }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Error playing sound:", e));
    }
  };

  const fetchFullVendaDetails = async (id: string): Promise<Venda | null> => {
      const { data, error } = await supabase
        .from('crm_oportunidades')
        .select('*')
        .eq('id_oport', id)
        .single();
      
      if (error || !data) return null;

      let produtoNome = data.solucao === 'PRODUTO' ? 'Produto' : (data.solucao === 'SERVICO' ? 'Serviço' : 'Produto/Serviço');
      
      // Removed specific product fetching as requested by user

      return {
          id: data.id_oport,
          cliente: data.cliente_nome || 'Cliente não identificado',
          vendedor: data.vendedor_nome || 'Vendedor não identificado',
          vendedor_avatar_url: data.vendedor_avatar_url,
          produto: produtoNome,
          valor: Number(data.ticket_valor || data.valor_proposta || 0),
          data_conquistado: data.data_conquistado,
          is_new: false
      };
  };

  const fetchVendasIniciais = async () => {
    const now = new Date();
    const start = startOfMonth(now).toISOString();
    const end = endOfMonth(now).toISOString();

    const { data, error } = await supabase
        .from('crm_oportunidades')
        .select('*')
        .eq('id_fase', FASE_CONQUISTADO_ID)
        .gte('data_conquistado', start)
        .lte('data_conquistado', end)
        .order('data_conquistado', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Erro ao buscar vendas iniciais:', error);
        return;
    }

    // Enhance data with product names
    const enrichedData = await Promise.all(data.map(async (row: any) => {
         let produtoNome = row.solucao === 'PRODUTO' ? 'Produto' : (row.solucao === 'SERVICO' ? 'Serviço' : 'Produto/Serviço');
         
         // Removed specific product fetching as requested by user

        return {
            id: row.id_oport,
            cliente: row.cliente_nome || 'Cliente não identificado',
            vendedor: row.vendedor_nome || 'Vendedor não identificado',
            vendedor_avatar_url: row.vendedor_avatar_url,
            produto: produtoNome,
            valor: Number(row.ticket_valor || row.valor_proposta || 0),
            data_conquistado: row.data_conquistado,
            is_new: false
        };
    }));

    setVendas(enrichedData);
  };

  return (
    <div className="bg-[var(--bg-panel)] rounded-lg shadow-sm border border-[var(--border)] flex flex-col h-full min-h-[400px]">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-emerald-500/5 to-transparent rounded-t-lg">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg shadow-sm border border-emerald-500/20">
                <Zap className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
                <h2 className="font-bold text-[var(--text-main)] text-lg">Feed de Vendas</h2>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Tempo Real • Mês Atual</p>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={listRef}>
        {vendas.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-60 min-h-[200px]">
                <Trophy className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">Nenhuma venda registrada este mês</p>
            </div>
        ) : (
            vendas.map((venda) => (
                <div 
                    key={venda.id}
                    className={`
                        relative overflow-hidden rounded-xl border p-4 transition-all duration-500 ease-out group
                        ${venda.is_new 
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-md translate-x-1 animate-in fade-in slide-in-from-right-4' 
                            : 'bg-[var(--bg-body)] border-[var(--border)] hover:border-emerald-500/30 hover:shadow-md hover:-translate-y-0.5'
                        }
                    `}
                >
                    {/* Visual Highlight for new items */}
                    {venda.is_new && (
                        <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            NOVA VENDA!
                        </div>
                    )}

                    <div className="flex justify-between items-start mb-3 relative z-0">
                        <div className="flex items-center gap-3">
                            <div className={`relative w-10 h-10 min-w-[2.5rem] rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold text-sm shadow-sm border border-emerald-500/20 overflow-hidden`}>
                                {venda.vendedor_avatar_url ? (
                                    <div className="w-full h-full relative">
                                        <img 
                                            src={venda.vendedor_avatar_url} 
                                            alt={venda.vendedor} 
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                                // Find the fallback div which is the next sibling
                                                const fallback = target.nextElementSibling;
                                                if (fallback) fallback.classList.remove('hidden');
                                            }}
                                        />
                                        <div className="hidden absolute inset-0 flex items-center justify-center bg-emerald-500/10 text-emerald-500 w-full h-full">
                                            {venda.vendedor.substring(0, 2).toUpperCase()}
                                        </div>
                                   </div>
                                ) : (
                                    <span>{venda.vendedor.substring(0, 2).toUpperCase()}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-[var(--text-main)] text-sm leading-tight group-hover:text-emerald-500 transition-colors">
                                    {venda.vendedor}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-[var(--text-soft)] mt-0.5">
                                    <User className="w-3 h-3" />
                                    <span>{venda.cliente}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right pl-2">
                             <span className="block font-bold text-emerald-500 text-base">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.valor)}
                             </span>
                             <div className="flex items-center justify-end gap-1 text-xs text-[var(--text-muted)] mt-1">
                                <CalendarDays className="w-3 h-3" />
                                <span>{format(parseISO(venda.data_conquistado), 'dd/MM/yyyy')}</span>
                             </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-dashed border-[var(--border)]">
                        <Briefcase className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs text-[var(--text-soft)] font-medium truncate w-full" title={venda.produto}>
                            {venda.produto}
                        </span>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
}
