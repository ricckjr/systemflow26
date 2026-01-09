import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Car, 
  MapPin, 
  Gauge, 
  Calendar, 
  ArrowRight,
  History,
  Play,
  Square,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  km_atual: number;
  status: 'disponivel' | 'em_uso' | 'manutencao';
}

interface Log {
  id: string;
  vehicle_id: string;
  user_id: string;
  data_saida: string;
  data_retorno?: string;
  km_saida: number;
  km_retorno?: number;
  destino: string;
  observacao?: string;
  vehicle?: Vehicle;
  user_name?: string; // Join manually or via view
}

const DiarioBordo: React.FC = () => {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeLog, setActiveLog] = useState<Log | null>(null); // Se o usuário tem um log aberto
  const [loading, setLoading] = useState(true);

  // Form States
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [destino, setDestino] = useState('');
  const [kmRetorno, setKmRetorno] = useState<number>(0);
  const [obs, setObs] = useState('');

  useEffect(() => {
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    setLoading(true);
    // 1. Fetch Vehicles
    const { data: vData } = await supabase.from('fleet_vehicles').select('*');
    if (vData) setVehicles(vData);

    // 2. Fetch User's Active Log (if any)
    if (profile) {
      const { data: activeData } = await supabase
        .from('fleet_logs')
        .select('*, vehicle:fleet_vehicles(*)')
        .eq('user_id', profile.id)
        .is('data_retorno', null)
        .single();
      
      if (activeData) {
        setActiveLog(activeData);
        setKmRetorno(activeData.vehicle.km_atual); // Default return KM to current
      }
    }

    // 3. Fetch Recent History
    const { data: historyData } = await supabase
      .from('fleet_logs')
      .select('*, vehicle:fleet_vehicles(*)')
      .not('data_retorno', 'is', null)
      .order('data_retorno', { ascending: false })
      .limit(10);
      
    if (historyData) setLogs(historyData);
    
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!selectedVehicle || !destino || !profile) return;
    
    const vehicle = vehicles.find(v => v.id === selectedVehicle);
    if (!vehicle) return;

    // 1. Create Log
    const { error: logError } = await supabase.from('fleet_logs').insert([{
      vehicle_id: selectedVehicle,
      user_id: profile.id,
      km_saida: vehicle.km_atual,
      destino,
      observacao: obs
    }]);

    if (logError) {
      alert('Erro ao iniciar viagem: ' + logError.message);
      return;
    }

    // 2. Update Vehicle Status
    await supabase.from('fleet_vehicles').update({ status: 'em_uso' }).eq('id', selectedVehicle);

    // Refresh
    setDestino('');
    setObs('');
    fetchData();
  };

  const handleCheckIn = async () => {
    if (!activeLog) return;
    
    if (kmRetorno < activeLog.km_saida) {
      alert('KM de retorno não pode ser menor que KM de saída!');
      return;
    }

    // 1. Update Log
    const { error: logError } = await supabase.from('fleet_logs').update({
      data_retorno: new Date().toISOString(),
      km_retorno: kmRetorno,
      observacao: obs ? (activeLog.observacao ? activeLog.observacao + ' | Retorno: ' + obs : 'Retorno: ' + obs) : activeLog.observacao
    }).eq('id', activeLog.id);

    if (logError) {
      alert('Erro ao finalizar viagem: ' + logError.message);
      return;
    }

    // 2. Update Vehicle
    await supabase.from('fleet_vehicles').update({ 
      status: 'disponivel',
      km_atual: kmRetorno
    }).eq('id', activeLog.vehicle_id);

    // Refresh
    setActiveLog(null);
    setObs('');
    fetchData();
  };

  if (loading) return <div className="p-8 text-center">Carregando frota...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      
      <div className="text-center md:text-left">
        <h2 className="text-2xl font-bold text-[var(--text-main)]">Diário de Bordo</h2>
        <p className="text-sm text-[var(--text-soft)]">Registro de utilização da frota</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* ACTIVE TRIP CARD */}
        <div className="md:col-span-2">
          {activeLog ? (
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-cyan-500/30 rounded-3xl p-8 relative overflow-hidden shadow-2xl shadow-cyan-500/10">
              <div className="absolute top-0 right-0 p-4 bg-cyan-500 text-white rounded-bl-2xl font-bold text-xs shadow-lg animate-pulse">
                EM VIAGEM
              </div>
              
              <div className="flex flex-col md:flex-row gap-8 items-center">
                 <div className="w-32 h-32 bg-cyan-500/10 rounded-full flex items-center justify-center border-4 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                   <Car size={48} className="text-cyan-400" />
                 </div>
                 
                 <div className="flex-1 space-y-4 text-center md:text-left">
                   <div>
                     <h3 className="text-2xl font-bold text-white mb-1">{activeLog.vehicle?.modelo}</h3>
                     <p className="text-cyan-400 font-mono text-lg">{activeLog.vehicle?.placa}</p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4 bg-[var(--bg-panel)]/50 p-4 rounded-xl border border-[var(--border)]">
                     <div>
                       <span className="text-xs text-[var(--text-muted)] uppercase font-bold">Saída</span>
                       <p className="text-lg font-bold text-[var(--text-main)]">{format(new Date(activeLog.data_saida), "HH:mm")}</p>
                     </div>
                     <div>
                       <span className="text-xs text-[var(--text-muted)] uppercase font-bold">KM Inicial</span>
                       <p className="text-lg font-bold text-[var(--text-main)]">{activeLog.km_saida} km</p>
                     </div>
                     <div className="col-span-2">
                        <span className="text-xs text-[var(--text-muted)] uppercase font-bold">Destino</span>
                        <p className="text-sm font-medium text-[var(--text-main)]">{activeLog.destino}</p>
                     </div>
                   </div>
                 </div>

                 <div className="w-full md:w-80 bg-[var(--bg-panel)] p-6 rounded-2xl border border-[var(--border)] space-y-4">
                    <h4 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      Finalizar Viagem
                    </h4>
                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase">KM Final</label>
                      <input 
                        type="number" 
                        value={kmRetorno}
                        onChange={e => setKmRetorno(parseInt(e.target.value))}
                        className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg font-mono mt-1 focus:ring-2 focus:ring-emerald-500/50 outline-none"
                      />
                    </div>
                    <div>
                       <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Observações (Opcional)</label>
                       <input 
                         value={obs}
                         onChange={e => setObs(e.target.value)}
                         placeholder="Ex: Abastecido, Barulho no freio..."
                         className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2 mt-1 text-sm outline-none"
                       />
                    </div>
                    <button 
                      onClick={handleCheckIn}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                      Registrar Retorno
                    </button>
                 </div>
              </div>
            </div>
          ) : (
            /* START TRIP FORM */
            <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-3xl p-8 shadow-xl">
               <h3 className="text-xl font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                 <Play size={20} className="text-cyan-400" />
                 Iniciar Nova Viagem
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Selecione o Veículo</label>
                   <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                     {vehicles.filter(v => v.status === 'disponivel').map(v => (
                       <div 
                         key={v.id}
                         onClick={() => setSelectedVehicle(v.id)}
                         className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group
                           ${selectedVehicle === v.id 
                             ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500/50' 
                             : 'bg-[var(--bg-body)] border-[var(--border)] hover:border-cyan-500/30'}
                         `}
                       >
                         <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${selectedVehicle === v.id ? 'bg-cyan-500 text-white' : 'bg-[var(--bg-panel)] text-[var(--text-muted)]'}`}>
                             <Car size={20} />
                           </div>
                           <div>
                             <p className="font-bold text-sm text-[var(--text-main)]">{v.modelo}</p>
                             <p className="text-xs text-[var(--text-soft)] font-mono">{v.placa}</p>
                           </div>
                         </div>
                         <div className="text-right">
                           <span className="text-xs font-bold text-[var(--text-muted)]">{v.km_atual} km</span>
                         </div>
                       </div>
                     ))}
                     {vehicles.filter(v => v.status === 'disponivel').length === 0 && (
                       <div className="p-4 text-center text-[var(--text-muted)] italic">
                         Nenhum veículo disponível no momento.
                       </div>
                     )}
                   </div>
                 </div>

                 <div className="space-y-6">
                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Destino / Motivo</label>
                      <input 
                        value={destino}
                        onChange={e => setDestino(e.target.value)}
                        placeholder="Ex: Visita ao Cliente X, Banco, etc."
                        className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-3 mt-2 focus:ring-2 focus:ring-cyan-500/50 outline-none text-[var(--text-main)]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Observações Iniciais</label>
                      <textarea 
                        value={obs}
                        onChange={e => setObs(e.target.value)}
                        placeholder="Alguma avaria pré-existente?"
                        className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-3 mt-2 focus:ring-2 focus:ring-cyan-500/50 outline-none text-[var(--text-main)] h-24 resize-none"
                      />
                    </div>
                    <button 
                      onClick={handleCheckOut}
                      disabled={!selectedVehicle || !destino}
                      className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                    >
                      Pegar Chave Digital
                    </button>
                 </div>
               </div>
            </div>
          )}
        </div>

        {/* HISTORY LIST */}
        <div className="md:col-span-2">
           <div className="flex items-center gap-2 mb-6">
             <History size={20} className="text-[var(--text-muted)]" />
             <h3 className="text-lg font-bold text-[var(--text-main)]">Histórico Recente</h3>
           </div>
           
           <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl overflow-hidden">
             <table className="w-full text-sm text-left">
               <thead className="bg-[var(--bg-body)] text-[var(--text-muted)] font-bold uppercase text-xs">
                 <tr>
                   <th className="px-6 py-4">Veículo</th>
                   <th className="px-6 py-4">Data</th>
                   <th className="px-6 py-4">Destino</th>
                   <th className="px-6 py-4">Distância</th>
                   <th className="px-6 py-4">Obs</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-[var(--border)]">
                 {logs.map(log => (
                   <tr key={log.id} className="hover:bg-[var(--bg-body)] transition-colors">
                     <td className="px-6 py-4">
                       <div className="font-bold text-[var(--text-main)]">{log.vehicle?.modelo}</div>
                       <div className="text-xs text-[var(--text-soft)] font-mono">{log.vehicle?.placa}</div>
                     </td>
                     <td className="px-6 py-4 text-[var(--text-soft)]">
                       {format(new Date(log.data_saida), "dd/MM HH:mm")}
                       <ArrowRight size={12} className="inline mx-2 opacity-50" />
                       {log.data_retorno ? format(new Date(log.data_retorno), "HH:mm") : '...'}
                     </td>
                     <td className="px-6 py-4 text-[var(--text-main)] font-medium">
                       {log.destino}
                     </td>
                     <td className="px-6 py-4">
                       {log.km_retorno ? (
                         <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-400 font-mono text-xs">
                           {log.km_retorno - log.km_saida} km
                         </span>
                       ) : (
                         <span className="text-amber-400 text-xs animate-pulse">Em andamento</span>
                       )}
                     </td>
                     <td className="px-6 py-4 text-[var(--text-muted)] text-xs max-w-xs truncate">
                       {log.observacao || '-'}
                     </td>
                   </tr>
                 ))}
                 {logs.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)] italic">
                       Nenhum registro encontrado.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>

      </div>
    </div>
  );
};

export default DiarioBordo;
