
import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { Permissao, Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Plus, Info, Settings, Edit3, Trash2 } from 'lucide-react';

const Permissoes: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return <div className="p-8 text-center text-white">Carregando perfil...</div>;

  const [modulos, setModulos] = useState<Permissao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissoes();
  }, []);

  const fetchPermissoes = async () => {
    try {
      const { data, error } = await supabase
        .from('permissoes')
        .select('*')
        .order('modulo');
      
      if (error) throw error;
      setModulos(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Controle de Módulos</h2>
          <p className="text-industrial-text-secondary">Defina os módulos disponíveis no sistema</p>
        </div>
        <button className="bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-brand-700 transition-all flex items-center gap-2">
          <Plus size={20} />
          <span>Novo Módulo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : modulos.length === 0 ? (
          <div className="col-span-full bg-industrial-surface p-12 rounded-2xl border border-industrial-border text-center">
            <Shield size={48} className="mx-auto text-industrial-text-secondary mb-4" />
            <p className="text-industrial-text-secondary">Nenhum módulo cadastrado no sistema.</p>
          </div>
        ) : modulos.map(modulo => (
          <div key={modulo.id} className="bg-industrial-surface p-6 rounded-2xl border border-industrial-border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-brand-500/10 text-brand-500 rounded-xl flex items-center justify-center">
                <Settings size={24} />
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 text-industrial-text-secondary hover:text-brand-500 rounded-md"><Edit3 size={16} /></button>
                <button className="p-1.5 text-industrial-text-secondary hover:text-rose-500 rounded-md"><Trash2 size={16} /></button>
              </div>
            </div>
            <h3 className="font-bold text-white mb-2 uppercase tracking-tight">{modulo.modulo}</h3>
            <p className="text-xs text-industrial-text-secondary mb-6 leading-relaxed">
              {modulo.descricao || 'Sem descrição definida para este módulo.'}
            </p>
            <div className="flex items-center gap-3 border-t border-industrial-border pt-4">
               <div className="flex -space-x-2">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-7 h-7 rounded-full bg-industrial-bg border-2 border-industrial-surface flex items-center justify-center text-[10px] font-bold text-industrial-text-secondary">
                     U{i}
                   </div>
                 ))}
               </div>
               <span className="text-[10px] text-industrial-text-secondary font-bold uppercase">12 usuários vinculados</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-brand-500/10 rounded-2xl p-6 border border-brand-500/20">
        <div className="flex gap-4">
          <Info className="text-brand-500 shrink-0" size={24} />
          <div>
            <h4 className="font-bold text-white text-sm">Estrutura de Permissões Corporativa</h4>
            <p className="text-sm text-industrial-text-secondary mt-1 leading-relaxed">
              As permissões granulares (Visualizar, Editar, Excluir) são aplicadas individualmente a cada usuário através do menu 
              <strong> Usuários &gt; Perfil &gt; Permissões</strong>. O Administrador possui acesso irrestrito a todos os módulos independente das flags.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Permissoes;
