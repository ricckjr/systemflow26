import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { 
  Car, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  MapPin, 
  Gauge, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Wrench,
  X
} from 'lucide-react';

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  ano: number;
  cor: string;
  km_atual: number;
  status: 'disponivel' | 'em_uso' | 'manutencao';
  imagem_url?: string;
}

const Veiculos: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // New Vehicle Form
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    modelo: '',
    placa: '',
    ano: new Date().getFullYear(),
    cor: '',
    km_atual: 0,
    status: 'disponivel'
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fleet_vehicles')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setVehicles(data);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newVehicle.modelo || !newVehicle.placa) return;
    
    const { data, error } = await supabase
      .from('fleet_vehicles')
      .insert([newVehicle])
      .select();
      
    if (!error && data) {
      setVehicles(prev => [data[0], ...prev]);
      setIsModalOpen(false);
      setNewVehicle({ modelo: '', placa: '', ano: new Date().getFullYear(), cor: '', km_atual: 0, status: 'disponivel' });
    } else {
      alert('Erro ao criar veículo: ' + error?.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponivel': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'em_uso': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'manutencao': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'disponivel': return 'Disponível';
      case 'em_uso': return 'Em Uso';
      case 'manutencao': return 'Manutenção';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
            <Car className="text-cyan-400" />
            Frota
          </h2>
          <p className="text-sm text-[var(--text-soft)]">Gerenciamento de veículos da empresa</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
        >
          <Plus size={18} />
          Novo Veículo
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por modelo ou placa..."
            className="w-full bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-cyan-500/50 outline-none"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles
          .filter(v => v.modelo.toLowerCase().includes(search.toLowerCase()) || v.placa.toLowerCase().includes(search.toLowerCase()))
          .map(vehicle => (
          <div key={vehicle.id} className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all group">
            {/* Image Placeholder or Real Image */}
            <div className="h-40 bg-[var(--bg-body)] flex items-center justify-center relative">
              {vehicle.imagem_url ? (
                <img src={vehicle.imagem_url} alt={vehicle.modelo} className="w-full h-full object-cover" />
              ) : (
                <Car size={48} className="text-[var(--text-muted)] opacity-20" />
              )}
              <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(vehicle.status)}`}>
                {getStatusLabel(vehicle.status)}
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">{vehicle.modelo}</h3>
                <p className="text-sm text-[var(--text-soft)] uppercase tracking-wider font-semibold">{vehicle.placa}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Gauge size={16} />
                  <span>{vehicle.km_atual.toLocaleString()} km</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Calendar size={16} />
                  <span>{vehicle.ano}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border)] flex justify-between items-center">
                 <button className="text-xs font-bold text-cyan-400 hover:text-cyan-300">Ver Histórico</button>
                 <button className="p-2 hover:bg-[var(--bg-body)] rounded-lg text-[var(--text-muted)]">
                   <MoreVertical size={16} />
                 </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && vehicles.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <Car size={48} className="mx-auto mb-4 opacity-20" />
          <p>Nenhum veículo cadastrado na frota.</p>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl w-full max-w-lg p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--text-main)]">Adicionar Veículo</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Modelo</label>
                <input 
                  value={newVehicle.modelo}
                  onChange={e => setNewVehicle({...newVehicle, modelo: e.target.value})}
                  className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  placeholder="Ex: Fiat Strada Endurance"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Placa</label>
                  <input 
                    value={newVehicle.placa}
                    onChange={e => setNewVehicle({...newVehicle, placa: e.target.value.toUpperCase()})}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-cyan-500/50 outline-none"
                    placeholder="ABC-1234"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Ano</label>
                  <input 
                    type="number"
                    value={newVehicle.ano}
                    onChange={e => setNewVehicle({...newVehicle, ano: parseInt(e.target.value)})}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Cor</label>
                  <input 
                    value={newVehicle.cor}
                    onChange={e => setNewVehicle({...newVehicle, cor: e.target.value})}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-cyan-500/50 outline-none"
                    placeholder="Branco"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase">KM Inicial</label>
                  <input 
                    type="number"
                    value={newVehicle.km_atual}
                    onChange={e => setNewVehicle({...newVehicle, km_atual: parseInt(e.target.value)})}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl px-4 py-2.5 mt-1 focus:ring-2 focus:ring-cyan-500/50 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-body)]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreate}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-500/20"
              >
                Salvar Veículo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Veiculos;
