import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Download, Trash2, FileText, 
  Image as ImageIcon, Loader2, ExternalLink, Filter, Upload, X 
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { universidadeService, Catalogo } from '@/services/universidade';
import { useAuth } from '@/contexts/AuthContext';

export default function Catalogos() {
  const { profile } = useAuth();
  const [catalogos, setCatalogos] = useState<Catalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'Todos' | 'Apliflow' | 'Tecnotron'>('Todos');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'Apliflow' as 'Apliflow' | 'Tecnotron',
  });
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);

  useEffect(() => {
    loadCatalogos();
  }, []);

  const loadCatalogos = async () => {
    setLoading(true);
    try {
      const data = await universidadeService.fetchCatalogos();
      setCatalogos(data);
    } catch (error) {
      console.error('Erro ao carregar catálogos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este catálogo?')) return;
    try {
      await universidadeService.deleteCatalogo(id);
      setCatalogos(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir catálogo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.tipo) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      let capa_url = null;
      let arquivo_url = null;

      if (capaFile) {
        capa_url = await universidadeService.uploadFile(capaFile, 'capas');
      }

      if (arquivoFile) {
        arquivo_url = await universidadeService.uploadFile(arquivoFile, 'arquivos');
      }

      const newCatalogo = await universidadeService.createCatalogo({
        nome: formData.nome,
        descricao: formData.descricao,
        tipo: formData.tipo,
        capa_url,
        arquivo_url,
      });

      setCatalogos(prev => [newCatalogo, ...prev]);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao criar catálogo:', error);
      alert('Erro ao criar catálogo. Verifique se você tem permissão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', descricao: '', tipo: 'Apliflow' });
    setCapaFile(null);
    setArquivoFile(null);
  };

  const filteredCatalogos = catalogos.filter(c => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = filterTipo === 'Todos' || c.tipo === filterTipo;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-[#0B0F14] text-slate-200 p-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Catálogos de Produtos</h1>
          <p className="text-slate-400 text-sm">Gerencie e visualize os catálogos da Apliflow e Tecnotron.</p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-900/20"
        >
          <Plus size={18} />
          Novo Catálogo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 sticky top-0 bg-[#0B0F14]/95 backdrop-blur-sm z-10 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar catálogos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="flex p-1 bg-slate-800/50 rounded-lg border border-slate-700 w-fit">
          {(['Todos', 'Apliflow', 'Tecnotron'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFilterTipo(tipo)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                filterTipo === tipo
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : filteredCatalogos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 mt-10">
          <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} className="opacity-50" />
          </div>
          <p className="text-lg font-medium text-slate-400">Nenhum catálogo encontrado</p>
          <p className="text-sm">Tente ajustar os filtros ou adicione um novo catálogo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {filteredCatalogos.map((catalogo) => (
            <div 
              key={catalogo.id} 
              className="group bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden hover:border-cyan-500/30 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 flex flex-col"
            >
              {/* Capa */}
              <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                {catalogo.capa_url ? (
                  <img 
                    src={catalogo.capa_url} 
                    alt={catalogo.nome} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-800/50">
                    <ImageIcon size={48} strokeWidth={1} />
                  </div>
                )}
                
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border backdrop-blur-md ${
                    catalogo.tipo === 'Apliflow' 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                      : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  }`}>
                    {catalogo.tipo}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-base font-semibold text-white mb-1 line-clamp-1" title={catalogo.nome}>
                  {catalogo.nome}
                </h3>
                {catalogo.descricao && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 flex-1">
                    {catalogo.descricao}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-700/50">
                  {catalogo.arquivo_url ? (
                    <a 
                      href={catalogo.arquivo_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-cyan-600/20 hover:text-cyan-400 text-slate-300 py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download size={14} />
                      Download PDF
                    </a>
                  ) : (
                    <span className="flex-1 text-center text-xs text-slate-500 py-2 cursor-not-allowed">
                      Sem arquivo
                    </span>
                  )}
                  
                  {/* Delete Button (Simple permission check: can be improved) */}
                  <button
                    onClick={() => handleDelete(catalogo.id)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Criar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Novo Catálogo"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome do Catálogo <span className="text-red-400">*</span></label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
              placeholder="Ex: Catálogo Geral 2026"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {(['Apliflow', 'Tecnotron'] as const).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo })}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                    formData.tipo === tipo
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Descrição</label>
            <textarea
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors h-24 resize-none"
              placeholder="Breve descrição sobre o conteúdo..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Capa Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Imagem de Capa</label>
              <div className="relative group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setCapaFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="capa-upload"
                />
                <label
                  htmlFor="capa-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    capaFile 
                      ? 'border-cyan-500/50 bg-cyan-500/5' 
                      : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  {capaFile ? (
                    <div className="text-center px-4">
                      <ImageIcon className="mx-auto h-6 w-6 text-cyan-500 mb-2" />
                      <p className="text-xs text-cyan-400 font-medium truncate max-w-[200px]">{capaFile.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">Clique para trocar</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-8 w-8 text-slate-500 mb-2" />
                      <span className="text-xs text-slate-400">Clique para selecionar imagem</span>
                    </div>
                  )}
                </label>
                {capaFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCapaFile(null);
                    }}
                    className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-full text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Arquivo PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Arquivo PDF</label>
              <div className="relative group">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => setArquivoFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex flex-col items-center justify-center w-full h-20 border border-slate-700 rounded-lg cursor-pointer transition-colors ${
                    arquivoFile 
                      ? 'bg-slate-800 border-l-4 border-l-red-500 border-y-slate-700 border-r-slate-700' 
                      : 'bg-slate-900/50 hover:bg-slate-800'
                  }`}
                >
                  {arquivoFile ? (
                    <div className="flex items-center gap-3 px-4 w-full">
                      <FileText className="h-6 w-6 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-slate-200 truncate">{arquivoFile.name}</p>
                        <p className="text-xs text-slate-500">{(arquivoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload size={16} />
                      <span className="text-sm">Selecionar arquivo PDF</span>
                    </div>
                  )}
                </label>
                {arquivoFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setArquivoFile(null);
                    }}
                    className="absolute top-1/2 -translate-y-1/2 right-4 p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                'Criar Catálogo'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
