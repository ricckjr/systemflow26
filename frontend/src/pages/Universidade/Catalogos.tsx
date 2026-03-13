import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Plus, Download, Trash2, FileText, 
  Image as ImageIcon, Loader2, ExternalLink, Filter, Upload, X, Pen 
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Catalogo selecionado para visualização
  const [selectedCatalogo, setSelectedCatalogo] = useState<Catalogo | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo: 'Apliflow' as 'Apliflow' | 'Tecnotron',
  });
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [arquivoFile, setArquivoFile] = useState<File | null>(null);
  
  // Para visualização no modal de edição
  const [currentCapaUrl, setCurrentCapaUrl] = useState<string | null>(null);
  const [currentArquivoUrl, setCurrentArquivoUrl] = useState<string | null>(null);

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

  const handleEditClick = (e: React.MouseEvent, catalogo: Catalogo) => {
    e.stopPropagation(); 
    // Fecha modal de visualização se estiver aberto
    setIsViewModalOpen(false);
    
    setEditingId(catalogo.id);
    setFormData({
      nome: catalogo.nome,
      descricao: catalogo.descricao || '',
      tipo: catalogo.tipo,
    });
    setCurrentCapaUrl(catalogo.capa_url);
    setCurrentArquivoUrl(catalogo.arquivo_url);
    setCapaFile(null);
    setArquivoFile(null);
    setIsEditModalOpen(true);
  };

  const handleViewClick = (catalogo: Catalogo) => {
    setSelectedCatalogo(catalogo);
    setIsViewModalOpen(true);
  };

  const handleNewClick = () => {
    setEditingId(null);
    resetForm();
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm('Tem certeza que deseja excluir este catálogo permanentemente?')) return;
    
    setIsSubmitting(true);
    try {
      await universidadeService.deleteCatalogo(editingId);
      setCatalogos(prev => prev.filter(c => c.id !== editingId));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir catálogo');
    } finally {
      setIsSubmitting(false);
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
      let capa_url = currentCapaUrl;
      let arquivo_url = currentArquivoUrl;

      // Se tiver arquivo novo, faz upload
      if (capaFile) {
        capa_url = await universidadeService.uploadFile(capaFile, 'capas');
      }

      if (arquivoFile) {
        arquivo_url = await universidadeService.uploadFile(arquivoFile, 'arquivos');
      }
      
      console.log('Dados para salvar:', { editingId, nome: formData.nome, capa_url, arquivo_url });

      if (editingId) {
        // Update
        const updated = await universidadeService.updateCatalogo(editingId, {
          nome: formData.nome,
          descricao: formData.descricao,
          tipo: formData.tipo,
          capa_url,
          arquivo_url,
        });
        setCatalogos(prev => prev.map(c => c.id === editingId ? updated : c));
      } else {
        // Create
        const newCatalogo = await universidadeService.createCatalogo({
          nome: formData.nome,
          descricao: formData.descricao,
          tipo: formData.tipo,
          capa_url,
          arquivo_url,
        });
        setCatalogos(prev => [newCatalogo, ...prev]);
      }

      setIsEditModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar catálogo:', error);
      alert('Erro ao salvar catálogo. Verifique permissões.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', descricao: '', tipo: 'Apliflow' });
    setCapaFile(null);
    setArquivoFile(null);
    setCurrentCapaUrl(null);
    setCurrentArquivoUrl(null);
  };

  const filteredCatalogos = catalogos.filter(c => {
    const matchesSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (c.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesType = filterTipo === 'Todos' || c.tipo === filterTipo;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] text-[var(--text-soft)] p-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Catálogos de Produtos</h1>
          <p className="text-[var(--text-muted)] text-sm">Gerencie e visualize os catálogos da Apliflow e Tecnotron.</p>
        </div>
        
        <button
          onClick={handleNewClick}
          className="flex items-center gap-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-cyan-900/20"
        >
          <Plus size={18} />
          Novo Catálogo
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 sticky top-0 bg-[var(--bg-main)]/95 backdrop-blur-sm z-10 py-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
          <input
            type="text"
            placeholder="Buscar catálogos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[var(--bg-panel)]/50 border border-[var(--border)] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all placeholder:text-[var(--text-soft)]"
          />
        </div>

        <div className="flex p-1 bg-[var(--bg-panel)]/50 rounded-lg border border-[var(--border)] w-fit">
          {(['Todos', 'Apliflow', 'Tecnotron'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFilterTipo(tipo)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                filterTipo === tipo
                  ? 'bg-[var(--bg-card)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-soft)] hover:bg-white/5'
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
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] mt-10">
          <div className="w-16 h-16 bg-[var(--bg-panel)]/50 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} className="opacity-50" />
          </div>
          <p className="text-lg font-medium text-[var(--text-muted)]">Nenhum catálogo encontrado</p>
          <p className="text-sm">Tente ajustar os filtros ou adicione um novo catálogo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-10">
          {filteredCatalogos.map((catalogo) => (
            <div 
              key={catalogo.id} 
              onClick={() => handleViewClick(catalogo)}
              className="group bg-[var(--bg-panel)]/40 border border-[var(--border)]/50 rounded-xl overflow-hidden hover:border-[var(--primary)]/30 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 flex flex-col cursor-pointer relative"
            >
              {/* Capa */}
              <div className="relative aspect-[4/3] bg-[var(--bg-main)] overflow-hidden">
                {catalogo.capa_url ? (
                  <img 
                    src={catalogo.capa_url} 
                    alt={catalogo.nome} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--text-soft)] bg-[var(--bg-panel)]/50">
                    <ImageIcon size={48} strokeWidth={1} />
                  </div>
                )}
                
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-md border backdrop-blur-md ${
                    catalogo.tipo === 'Apliflow' 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                      : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                  }`}>
                    {catalogo.tipo}
                  </span>
                </div>

                {/* Edit Overlay (on hover) */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                   <div className="bg-[var(--bg-main)]/90 text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <ExternalLink size={14} />
                      Visualizar Detalhes
                   </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-base font-semibold text-white line-clamp-1" title={catalogo.nome}>
                    {catalogo.nome}
                  </h3>
                  {/* Botão de Editar (Caneta) */}
                  <button 
                    onClick={(e) => handleEditClick(e, catalogo)}
                    className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-1 rounded-md hover:bg-[var(--bg-card)]/50"
                    title="Editar"
                  >
                    <Pen size={14} />
                  </button>
                </div>

                {catalogo.descricao && (
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-4 flex-1">
                    {catalogo.descricao}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--border)]/50">
                  {catalogo.arquivo_url ? (
                    <a 
                      href={catalogo.arquivo_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center justify-center gap-2 bg-[var(--bg-card)]/50 hover:bg-[var(--primary)]/20 hover:text-[var(--primary)] text-[var(--text-soft)] py-2 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download size={14} />
                      Download PDF
                    </a>
                  ) : (
                    <span className="flex-1 text-center text-xs text-[var(--text-muted)] py-2 cursor-not-allowed">
                      Sem arquivo
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal View (Somente Visualização) */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={null} // Sem título padrão para usar header customizado ou imagem full
        size="2xl"
        className="overflow-hidden"
        noPadding
      >
        {selectedCatalogo && (
          <div className="flex flex-col h-full bg-[var(--bg-main)]">
             {/* Header com Imagem */}
             <div className="relative h-64 sm:h-80 bg-[var(--bg-main)] shrink-0">
               {selectedCatalogo.capa_url ? (
                 <>
                  <div className="absolute inset-0">
                    <img 
                      src={selectedCatalogo.capa_url} 
                      alt={selectedCatalogo.nome} 
                      className="w-full h-full object-cover opacity-60 blur-xl scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-[#0B0F14]/60 to-transparent" />
                  </div>
                  <div className="relative h-full flex items-center justify-center p-6">
                    <img 
                      src={selectedCatalogo.capa_url} 
                      alt={selectedCatalogo.nome} 
                      className="max-h-full w-auto object-contain rounded-lg border border-[var(--border)]"
                    />
                  </div>
                 </>
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-[var(--text-soft)]">
                   <ImageIcon size={64} strokeWidth={1} />
                 </div>
               )}
               {/* Botão de fechar duplicado removido daqui */}
             </div>

             {/* Conteúdo */}
             <div className="p-6 md:p-8 flex-1 overflow-y-auto">
               <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                 <div>
                   <div className="flex items-center gap-3 mb-2">
                     <span className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md border ${
                        selectedCatalogo.tipo === 'Apliflow' 
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                          : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                      }`}>
                        {selectedCatalogo.tipo}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        Adicionado em {new Date(selectedCatalogo.created_at).toLocaleDateString('pt-BR')}
                      </span>
                   </div>
                   <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{selectedCatalogo.nome}</h2>
                 </div>
                 
                 <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleEditClick(e, selectedCatalogo)}
                      className="p-2.5 bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-white rounded-lg hover:bg-[var(--bg-card)] transition-colors"
                      title="Editar"
                    >
                      <Pen size={18} />
                    </button>
                    {selectedCatalogo.arquivo_url && (
                      <a 
                        href={selectedCatalogo.arquivo_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary)] text-white font-medium rounded-lg shadow-cyan-900/20 transition-all hover:scale-105"
                      >
                        <Download size={18} />
                        Baixar PDF
                      </a>
                    )}
                 </div>
               </div>

               {selectedCatalogo.descricao ? (
                 <div className="prose prose-invert prose-sm max-w-none text-[var(--text-soft)]">
                   <p className="whitespace-pre-wrap leading-relaxed">{selectedCatalogo.descricao}</p>
                 </div>
               ) : (
                 <p className="text-[var(--text-muted)] italic">Sem descrição.</p>
               )}
             </div>
          </div>
        )}
      </Modal>

      {/* Modal Criar/Editar */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
        title={editingId ? "Editar Catálogo" : "Novo Catálogo"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coluna Esquerda: Imagens e Arquivos */}
            <div className="space-y-4">
               {/* Preview Capa */}
               <div>
                  <label className="block text-sm font-medium text-[var(--text-soft)] mb-2">Capa</label>
                  <div className="relative group rounded-xl overflow-hidden bg-[var(--bg-main)] border border-[var(--border)] aspect-video flex items-center justify-center">
                    {(capaFile || currentCapaUrl) ? (
                      <>
                        <img 
                          src={capaFile ? URL.createObjectURL(capaFile) : currentCapaUrl!} 
                          alt="Capa" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                           <label 
                             htmlFor="edit-capa-upload"
                             className="cursor-pointer p-2 bg-[var(--bg-panel)] text-white rounded-full hover:bg-[var(--primary)] transition-colors"
                             title="Alterar imagem"
                           >
                             <Pen size={16} />
                           </label>
                        </div>
                      </>
                    ) : (
                      <label 
                        htmlFor="edit-capa-upload"
                        className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-[var(--bg-panel)]/50 transition-colors"
                      >
                        <ImageIcon size={32} className="text-[var(--text-soft)] mb-2" />
                        <span className="text-xs text-[var(--text-muted)]">Adicionar Capa</span>
                      </label>
                    )}
                    
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => setCapaFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="edit-capa-upload"
                    />
                  </div>
               </div>

               {/* Arquivo PDF */}
               <div>
                 <label className="block text-sm font-medium text-[var(--text-soft)] mb-2">Arquivo PDF</label>
                 <div className="flex items-center gap-3 p-3 bg-[var(--bg-main)]/50 border border-[var(--border)] rounded-lg">
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {arquivoFile ? (
                        <p className="text-sm text-white truncate">{arquivoFile.name}</p>
                      ) : currentArquivoUrl ? (
                        <a href={currentArquivoUrl} target="_blank" className="text-sm text-[var(--primary)] hover:underline truncate block">
                           Visualizar PDF Atual
                        </a>
                      ) : (
                        <p className="text-sm text-[var(--text-muted)]">Nenhum arquivo selecionado</p>
                      )}
                    </div>
                    <label 
                      htmlFor="edit-pdf-upload" 
                      className="p-2 text-[var(--text-muted)] hover:text-white cursor-pointer hover:bg-[var(--bg-panel)] rounded-lg transition-colors"
                    >
                      <Upload size={18} />
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={e => setArquivoFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="edit-pdf-upload"
                    />
                 </div>
               </div>
            </div>

            {/* Coluna Direita: Campos */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text-soft)] mb-1.5">Nome</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                  placeholder="Nome do Catálogo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-soft)] mb-1.5">Tipo</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Apliflow', 'Tecnotron'] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFormData({ ...formData, tipo })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                        formData.tipo === tipo
                          ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]'
                          : 'bg-[var(--bg-main)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border)]'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-soft)] mb-1.5">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--primary)] transition-colors h-32 resize-none"
                  placeholder="Descrição detalhada..."
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-between border-t border-[var(--border)] mt-6">
             {editingId ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Excluir Catálogo
                </button>
             ) : <div />}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-[var(--primary)] hover:bg-[var(--primary)] text-white text-sm font-medium rounded-lg transition-colors shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
