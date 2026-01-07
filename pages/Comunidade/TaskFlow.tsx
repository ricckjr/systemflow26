
import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Profile } from '../../types';
import { 
  ensureDefaultBoard, 
  fetchBoardData, 
  fetchTasksPaged,
  createTask, 
  moveTask, 
  fetchComments, 
  addComment, 
  logActivity, 
  fetchUsers,
  assignUsers,
  TFBoard, 
  TFColumn, 
  TFTask 
} from '../../services/taskflow';
import { 
  Plus, 
  Calendar, 
  AlertTriangle, 
  UserPlus, 
  Bell, 
  Search, 
  Filter, 
  Download, 
  MoreVertical,
  Paperclip,
  X,
  Clock,
  CheckCircle2,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useScrollLock } from '../../hooks/useScrollLock';

const priorities = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

// Helper to calculate column color
const getColumnColor = (name: string) => {
  switch (name) {
    case 'ENTRADA': return 'border-l-slate-500';
    case 'EM ANÁLISE': return 'border-l-blue-500';
    case 'PENDENTE': return 'border-l-amber-500';
    case 'EM ANDAMENTO': return 'border-l-indigo-500';
    case 'EM REVISÃO': return 'border-l-purple-500';
    case 'CONCLUÍDO': return 'border-l-emerald-500';
    default: return 'border-l-slate-500';
  }
};

const TaskFlow: React.FC<{ profile: Profile }> = ({ profile }) => {
  const [board, setBoard] = useState<TFBoard | null>(null);
  const [columns, setColumns] = useState<TFColumn[]>([]);
  const [tasks, setTasks] = useState<TFTask[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [pageByColumn, setPageByColumn] = useState<Record<string, number>>({});
  const [hasMoreByColumn, setHasMoreByColumn] = useState<Record<string, boolean>>({});
  const [infinite, setInfinite] = useState(true);
  
  // Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskColumnId, setNewTaskColumnId] = useState<string>('');
  
  // Detail View State
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; content: string; created_at: string; user_nome?: string; user_avatar?: string }[]>>({});
  const [newComment, setNewComment] = useState('');
  const [users, setUsers] = useState<{ id: string; nome: string; avatar_url?: string }[]>([]);

  // Computed
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.toLowerCase()), 250)
    return () => clearTimeout(id)
  }, [search])

  const filteredTasks = useMemo(() => {
    if (!debouncedSearch) return tasks
    return tasks.filter(t => (t.title || '').toLowerCase().includes(debouncedSearch) || (t.description || '').toLowerCase().includes(debouncedSearch))
  }, [tasks, debouncedSearch])

  const byColumn = useMemo(() => {
    const map: Record<string, TFTask[]> = {};
    columns.forEach(c => (map[c.id] = []));
    filteredTasks.forEach(t => {
      if (!map[t.column_id]) map[t.column_id] = [];
      map[t.column_id].push(t);
    });
    return map;
  }, [columns, filteredTasks]);

  useEffect(() => {
    (async () => {
      const { board, columns } = await ensureDefaultBoard(user);
      setBoard(board);
      setColumns(columns);
      const data = await fetchBoardData(board.id);
      setColumns(data.columns.length > 0 ? data.columns : columns);
      const initialPages: Record<string, number> = {}
      const initialMore: Record<string, boolean> = {}
      const allTasks: TFTask[] = []
      for (const col of (data.columns.length ? data.columns : columns)) {
        initialPages[col.id] = 1
        const { items, total } = await fetchTasksPaged(board.id, col.id, 1, pageSize)
        allTasks.push(...items)
        initialMore[col.id] = items.length < total
      }
      setTasks(allTasks)
      setPageByColumn(initialPages)
      setHasMoreByColumn(initialMore)
      
      const allUsers = await fetchUsers();
      setUsers(allUsers);
    })();
  }, [profile.id, pageSize]);

  useScrollLock(isNewTaskModalOpen || !!activeTaskId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isNewTaskModalOpen) setIsNewTaskModalOpen(false);
        if (activeTaskId) setActiveTaskId(null);
      }
      if (e.key.toLowerCase() === 'n') openNewTaskModal();
      if (e.key.toLowerCase() === 'f') {
        const el = document.getElementById('taskflow-search') as HTMLInputElement | null
        el?.focus()
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNewTaskModalOpen, activeTaskId, columns]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newColumnId = destination.droppableId;
    
    // Optimistic Update
    setTasks(prev => prev.map(t => (t.id === draggableId ? { ...t, column_id: newColumnId, updated_at: new Date().toISOString() } : t)));

    await moveTask(draggableId, newColumnId);
    await logActivity(draggableId, profile.id, 'status_changed', newColumnId);
  };

  const handleCreateTask = async () => {
    if (!board || !newTaskTitle.trim() || !newTaskColumnId) return;
    
    const t = await createTask(board.id, newTaskColumnId, newTaskTitle.trim(), newTaskDesc.trim(), profile.id, newTaskPriority);
    setTasks(prev => [...prev, t]);
    
    // Reset and Close
    setNewTaskTitle('');
    setNewTaskDesc('');
    setIsNewTaskModalOpen(false);
    
    await logActivity(t.id, profile.id, 'task_created', newTaskTitle.trim());
  };

  const openNewTaskModal = (columnId?: string) => {
    setNewTaskColumnId(columnId || columns[0]?.id || '');
    setIsNewTaskModalOpen(true);
  };

  const openTask = async (taskId: string) => {
    setActiveTaskId(taskId);
    const cs = await fetchComments(taskId);
    setComments(prev => ({ ...prev, [taskId]: cs }));
  };

  const handleAddComment = async () => {
    if (!activeTaskId || !newComment.trim()) return;
    const c = await addComment(activeTaskId, profile.id, newComment.trim());
    
    // Optimistic append with user info (mocked until refresh)
    const optimisticComment = {
      ...c,
      user_nome: profile.nome,
      user_avatar: profile.avatar_url
    };
    
    setComments(prev => ({ ...prev, [activeTaskId]: [...(prev[activeTaskId] || []), optimisticComment] }));
    setNewComment('');
    await logActivity(activeTaskId, profile.id, 'comment_added');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-ink-900">TaskFlow</h2>
          <p className="text-xs text-ink-800 font-medium">Gerenciamento Avançado de Tarefas</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-800">Itens por página</span>
            <select value={pageSize} onChange={e => setPageSize(parseInt(e.target.value))} className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <label className="ml-3 flex items-center gap-2 text-xs text-ink-800">
              <input type="checkbox" checked={infinite} onChange={e => setInfinite(e.target.checked)} />
              Rolagem infinita
            </label>
          </div>
          <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-3 py-2 shadow-sm">
             <Calendar size={18} className="text-ink-800" />
             <span className="text-xs font-bold text-ink-800">Agenda</span>
          </div>
          
          <div className="relative">
             <button className="bg-surface border border-line rounded-xl p-2 shadow-sm text-ink-800 hover:text-brand-500 transition-colors">
               <Bell size={20} />
               <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-background"></span>
             </button>
          </div>

          <button 
            onClick={() => openNewTaskModal()}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-brand-600/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            NOVA TAREFA
          </button>
        </div>
      </div>

      {/* Filters Bar (Visual Only for now) */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
          <input 
            id="taskflow-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarefas..." 
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0f2538]/60 border border-white/10 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-all text-white placeholder:text-blue-200"
          />
        </div>
        
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink-800 hover:bg-background transition-colors">
          <Filter size={16} />
          Filtros
        </button>
        
        <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink-800 hover:bg-background transition-colors ml-auto">
          <Download size={16} />
          Exportar
        </button>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex h-full gap-4 min-w-[1200px]">
            {columns.map(col => (
              <div key={col.id} className="flex flex-col w-72 shrink-0">
                {/* Column Header */}
                <div className={`flex items-center justify-between mb-3 pl-3 border-l-4 ${getColumnColor(col.name)}`}>
                   <h3 className="text-xs font-black uppercase tracking-widest text-ink-800">{col.name}</h3>
                   <span className="text-[10px] font-bold bg-surface border border-line text-ink-800 px-2 py-0.5 rounded-full">
                     {byColumn[col.id]?.length || 0}
                   </span>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-2xl bg-[#0f2538]/50 border border-white/10 p-2 overflow-y-auto custom-scrollbar transition-colors ${snapshot.isDraggingOver ? 'bg-[#0f2538]/60' : ''}`}
                    >
                      {byColumn[col.id]?.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => openTask(task.id)}
                              style={{ ...provided.draggableProps.style }}
                              className={`group mb-2 p-3 rounded-xl bg-[#0f2538]/60 border border-white/10 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-blue-500 z-50' : ''}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide ${
                                  task.priority === 'high' ? 'bg-rose-500/10 text-rose-400' : 
                                  task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' : 
                                  'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  {priorities[task.priority]}
                                </span>
                                <button className="text-industrial-text-secondary hover:text-industrial-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical size={14} />
                                </button>
                              </div>
                              
                              <h4 className="text-xs font-bold text-white mb-2 line-clamp-2 leading-relaxed">
                                {task.title}
                              </h4>
                              
                              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                <div className="flex -space-x-1.5">
                                  {/* Mock Avatars */}
                                  <div className="w-5 h-5 rounded-full bg-blue-600/30 text-[8px] text-white flex items-center justify-center border-2 border-[#0f2538]">RN</div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-blue-200">
                                  {task.due_date && (
                                    <div className="flex items-center gap-1 text-[10px]" title="Prazo">
                                      <Clock size={12} />
                                      <span>{format(new Date(task.due_date), 'dd/MM')}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <Paperclip size={12} />
                                    <span>0</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      <div className="flex gap-2 mt-2">
                        <button 
                          onClick={() => openNewTaskModal(col.id)}
                          className="flex-1 py-2 rounded-xl border border-dashed border-white/20 text-blue-200 hover:text-blue-400 hover:border-blue-400 hover:bg-blue-500/10 transition-all text-xs font-bold flex items-center justify-center gap-2 opacity-70 hover:opacity-100"
                        >
                          <Plus size={14} />
                          Adicionar
                        </button>
                        {!infinite && (
                          <button
                            onClick={async () => {
                              if (!board) return
                              const next = (pageByColumn[col.id] || 1) + 1
                              const { items, total } = await fetchTasksPaged(board.id, col.id, next, pageSize)
                              if (items.length) {
                                setTasks(prev => [...prev, ...items])
                                setPageByColumn(p => ({ ...p, [col.id]: next }))
                                setHasMoreByColumn(m => ({ ...m, [col.id]: (next * pageSize) < total }))
                              } else {
                                setHasMoreByColumn(m => ({ ...m, [col.id]: false }))
                              }
                            }}
                            disabled={!hasMoreByColumn[col.id]}
                            className="px-3 py-2 rounded-xl border border-white/20 text-blue-200 hover:text-blue-400 hover:border-blue-400 hover:bg-blue-500/10 transition-all text-xs font-bold"
                          >
                            {hasMoreByColumn[col.id] ? 'Mais' : 'Fim'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>

      {/* New Task Modal */}
      {isNewTaskModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog w-full max-w-lg bg-surface rounded-3xl shadow-2xl border border-line overflow-hidden animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="new-task-title">
            <div className="modal-header px-6 py-4 border-b border-line flex items-center justify-between bg-background/50">
              <h3 id="new-task-title" className="font-black text-white uppercase tracking-widest text-sm">Nova Tarefa</h3>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-industrial-text-secondary hover:text-rose-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-800 uppercase tracking-widest">Título da Tarefa <span className="text-rose-500">*</span></label>
                <input 
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-xl bg-background border border-line px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-500 text-white transition-all"
                  placeholder="Ex: Implementar nova landing page"
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-800 uppercase tracking-widest">Prioridade</label>
                  <select 
                    value={newTaskPriority}
                    onChange={(e: any) => setNewTaskPriority(e.target.value)}
                    className="w-full rounded-xl bg-background border border-line px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 text-white transition-all appearance-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-800 uppercase tracking-widest">Coluna</label>
                  <select 
                    value={newTaskColumnId}
                    onChange={(e) => setNewTaskColumnId(e.target.value)}
                    className="w-full rounded-xl bg-background border border-line px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 text-white transition-all appearance-none"
                  >
                    {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-800 uppercase tracking-widest">Descrição</label>
                <textarea 
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  className="w-full h-24 rounded-xl bg-background border border-line px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-brand-500 text-white transition-all resize-none"
                  placeholder="Detalhes adicionais..."
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                 <button className="flex-1 py-3 rounded-xl border border-line text-ink-800 font-bold text-xs hover:bg-background transition-colors flex items-center justify-center gap-2">
                   <Paperclip size={16} />
                   Anexar Arquivo
                 </button>
                 <button className="flex-1 py-3 rounded-xl border border-line text-ink-800 font-bold text-xs hover:bg-background transition-colors flex items-center justify-center gap-2">
                   <UserPlus size={16} />
                   Compartilhar
                 </button>
              </div>
            </div>

            <div className="modal-footer p-4 bg-background/50 border-t border-line flex justify-end gap-3">
              <button 
                onClick={() => setIsNewTaskModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-ink-800 hover:text-white font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim()}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
              >
                Criar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {activeTaskId && (
        <div className="modal-overlay" onClick={() => setActiveTaskId(null)}>
          <div className="modal-dialog w-full max-w-4xl bg-surface rounded-3xl shadow-2xl border border-line overflow-hidden flex flex-col md:flex-row" role="dialog" aria-modal="true" aria-labelledby="task-details-title" onClick={e => e.stopPropagation()}>
            {/* Main Content */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar border-r border-line">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-industrial-text-secondary mb-2 block">
                     {selectedTask?.id.split('-')[0]}
                  </span>
                  <h2 id="task-details-title" className="text-2xl font-black text-white leading-tight">
                    {tasks.find(t => t.id === activeTaskId)?.title}
                  </h2>
                </div>
                <button onClick={() => setActiveTaskId(null)} className="p-2 rounded-xl hover:bg-industrial-bg text-industrial-text-secondary transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                   <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-industrial-text-secondary mb-3">
                     <AlertTriangle size={14} /> Descrição
                   </h4>
                   <p className="text-sm text-industrial-text-primary leading-relaxed whitespace-pre-wrap">
                     {tasks.find(t => t.id === activeTaskId)?.description || 'Sem descrição.'}
                   </p>
                </div>

                <div>
                   <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-industrial-text-secondary mb-3">
                     <Paperclip size={14} /> Anexos
                   </h4>
                   <div className="border-2 border-dashed border-industrial-border rounded-xl p-6 text-center">
                     <p className="text-xs text-industrial-text-secondary font-medium">Nenhum arquivo anexado</p>
                     <button className="mt-2 text-brand-600 font-bold text-xs hover:underline">Fazer upload</button>
                   </div>
                </div>

                <div>
                   <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-industrial-text-secondary mb-3">
                     <CheckCircle2 size={14} /> Atividade
                   </h4>
                   {/* Activity Log Placeholder */}
                   <div className="text-xs text-industrial-text-secondary italic">Histórico de atividades em breve...</div>
                </div>
              </div>
            </div>

            {/* Sidebar (Comments & Meta) */}
            <div className="w-full md:w-80 bg-industrial-bg/50 flex flex-col">
              <div className="p-4 border-b border-industrial-border">
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-industrial-text-secondary block mb-1">Status</label>
                    <div className="text-xs font-bold text-white bg-industrial-bg border border-industrial-border px-3 py-2 rounded-lg">
                     {columns.find(c => c.id === selectedTask?.column_id)?.name}
                  </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-industrial-text-secondary block mb-1">Responsáveis</label>
                    <div className="flex flex-wrap gap-2">
                      <button className="w-8 h-8 rounded-full bg-industrial-bg flex items-center justify-center text-industrial-text-secondary hover:text-brand-500 hover:bg-industrial-surface transition-all border border-transparent hover:border-industrial-border shadow-sm">
                        <UserPlus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-industrial-border">
                   <h4 className="text-xs font-black uppercase tracking-widest text-industrial-text-secondary">Comentários</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {(comments[activeTaskId] || []).map(c => (
                    <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-[10px] font-black shrink-0">
                        {c.user_nome ? c.user_nome.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{c.user_nome}</span>
                          <span className="text-[10px] text-industrial-text-secondary">{format(new Date(c.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-xs text-industrial-text-primary bg-industrial-surface border border-industrial-border p-3 rounded-r-xl rounded-bl-xl shadow-sm">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!(comments[activeTaskId]?.length) && (
                    <div className="text-center py-8">
                       <div className="w-12 h-12 rounded-full bg-industrial-bg mx-auto flex items-center justify-center text-industrial-text-secondary mb-2">
                         <Clock size={20} />
                       </div>
                       <p className="text-xs text-industrial-text-secondary">Nenhum comentário ainda.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-industrial-surface border-t border-industrial-border">
                  <div className="relative">
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      placeholder="Escreva um comentário..."
                      className="w-full pl-4 pr-12 py-3 rounded-xl bg-industrial-bg border border-industrial-border text-xs focus:ring-2 focus:ring-brand-500 transition-all text-white placeholder:text-industrial-text-secondary"
                    />
                    <button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-brand-600 text-white disabled:opacity-50 disabled:bg-slate-600 hover:bg-brand-500 transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskFlow;
