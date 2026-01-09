import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
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
  fetchTaskAssignees,
  uploadTaskAttachment,
  TFBoard,  
  TFColumn, 
  TFTask 
} from '@/services/taskflow';
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
  Send,
  Kanban,
  List,
  Sparkles,
  Zap,
  ChevronRight,
  Hash,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useScrollLock } from '@/hooks/useScrollLock';

const priorities = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

// Helper to calculate column color with Neon Theme
const getColumnTheme = (name: string) => {
  const n = (name || '').toUpperCase();
  if (n.includes('ENTRADA') || n.includes('TODO')) return { border: 'border-t-slate-400', glow: 'shadow-slate-500/20', text: 'text-slate-400' };
  if (n.includes('ANÁLISE') || n.includes('ANALYSIS')) return { border: 'border-t-cyan-500', glow: 'shadow-cyan-500/20', text: 'text-cyan-400' };
  if (n.includes('PENDENTE') || n.includes('WAITING')) return { border: 'border-t-amber-500', glow: 'shadow-amber-500/20', text: 'text-amber-400' };
  if (n.includes('ANDAMENTO') || n.includes('PROGRESS')) return { border: 'border-t-blue-500', glow: 'shadow-blue-500/20', text: 'text-blue-400' };
  if (n.includes('REVISÃO') || n.includes('REVIEW')) return { border: 'border-t-purple-500', glow: 'shadow-purple-500/20', text: 'text-purple-400' };
  if (n.includes('CONCLUÍDO') || n.includes('DONE')) return { border: 'border-t-emerald-500', glow: 'shadow-emerald-500/20', text: 'text-emerald-400' };
  return { border: 'border-t-slate-500', glow: 'shadow-slate-500/20', text: 'text-slate-400' };
};

const TaskFlow: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-[var(--text-soft)] animate-pulse gap-2">
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );

  const user = profile; // Alias for legacy code usage

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
  const [newTaskMedia, setNewTaskMedia] = useState<File | null>(null);
  const [newTaskAssignments, setNewTaskAssignments] = useState<string[]>([]);
  const [isNewTaskAssignOpen, setIsNewTaskAssignOpen] = useState(false);
  
  // Detail View State
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; content: string; created_at: string; user_nome?: string; user_avatar?: string }[]>>({});
  const [newComment, setNewComment] = useState('');
  const [users, setUsers] = useState<{ id: string; nome: string; avatar_url?: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState(false);

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
      if (e.key.toLowerCase() === 'n' && !isNewTaskModalOpen && !activeTaskId) openNewTaskModal();
      if (e.key.toLowerCase() === 'f' && !isNewTaskModalOpen && !activeTaskId) {
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
    // Default to first column if not set, though we hide the selector now
    const targetColumnId = columns[0]?.id;
    if (!board || !newTaskTitle.trim() || !targetColumnId) return;
    
    // 1. Create Task
    const t = await createTask(board.id, targetColumnId, newTaskTitle.trim(), newTaskDesc.trim(), profile.id, newTaskPriority);
    
    // 2. Upload Media if present
    if (newTaskMedia) {
      try {
        await uploadTaskAttachment(t.id, newTaskMedia, profile.id);
      } catch (e) {
        console.error("Failed to upload media on create", e);
      }
    }

    // 3. Assign Users if selected
    if (newTaskAssignments.length > 0) {
      await assignUsers(t.id, newTaskAssignments, profile.nome);
    }

    setTasks(prev => [...prev, t]);
    
    // Reset and Close
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskMedia(null);
    setNewTaskAssignments([]);
    setIsNewTaskModalOpen(false);
    
    await logActivity(t.id, profile.id, 'task_created', newTaskTitle.trim());
  };

  const openNewTaskModal = (columnId?: string) => {
    // Always reset to defaults
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskMedia(null);
    setNewTaskAssignments([]);
    setNewTaskColumnId(columns[0]?.id || '');
    setIsNewTaskModalOpen(true);
  };

  const openTask = async (taskId: string) => {
    setActiveTaskId(taskId);
    const cs = await fetchComments(taskId);
    setComments(prev => ({ ...prev, [taskId]: cs }));
    
    const assignees = await fetchTaskAssignees(taskId);
    setAssignedUsers(assignees.map((a: any) => a.user_id));
  };

  const handleAssign = async (userIds: string[]) => {
    if (!activeTaskId) return;
    await assignUsers(activeTaskId, userIds, profile.nome);
    setAssignedUsers(userIds);
    setIsAssignOpen(false);
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
    <div className="h-[calc(100vh-6rem)] flex flex-col animate-in fade-in duration-700">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0 px-4 md:px-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
            <Kanban size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)]">TaskFlow</h2>
            <p className="text-xs text-[var(--text-soft)]">Gerenciamento de Projetos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => openNewTaskModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            NOVA TAREFA
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2 scrollbar-hide shrink-0 px-4 md:px-0">
        <div className="relative flex-1 min-w-[240px] max-w-sm group">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-cyan-400 transition-colors" />
          <input 
            id="taskflow-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tarefas..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all text-[var(--text-main)] placeholder:text-[var(--text-muted)] shadow-sm"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 px-4 md:px-0">
          <div className="flex h-full gap-5 min-w-[1200px]">
            {columns.map(col => {
              const theme = getColumnTheme(col.name);
              return (
                <div key={col.id} className="flex flex-col w-80 shrink-0">
                  {/* Column Header */}
                  <div className={`flex items-center justify-between mb-4 pb-2 border-t-4 ${theme.border} bg-[var(--bg-panel)] px-4 py-3 rounded-xl shadow-sm border-x border-b border-[var(--border)] group hover:shadow-md transition-shadow`}>
                     <div className="flex items-center gap-2">
                       <h3 className={`text-xs font-black uppercase tracking-widest ${theme.text}`}>{col.name}</h3>
                     </div>
                     <span className="text-[10px] font-bold bg-[var(--bg-body)] text-[var(--text-soft)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                       {byColumn[col.id]?.length || 0}
                     </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-2xl p-2 overflow-y-auto custom-scrollbar transition-all ${snapshot.isDraggingOver ? 'bg-cyan-500/5 ring-2 ring-cyan-500/20' : ''}`}
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
                                className={`
                                  group mb-3 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] 
                                  shadow-sm hover:shadow-lg hover:border-cyan-500/30 cursor-grab active:cursor-grabbing transition-all
                                  ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-cyan-500 z-50 bg-slate-800' : ''}
                                `}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                    task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                                    task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                    {priorities[task.priority]}
                                  </span>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical size={14} className="text-[var(--text-muted)] hover:text-[var(--text-main)]" />
                                  </div>
                                </div>
                                
                                <h4 className="text-sm font-semibold text-[var(--text-main)] mb-3 line-clamp-2 leading-relaxed group-hover:text-cyan-400 transition-colors">
                                  {task.title}
                                </h4>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                                  <div className="flex -space-x-2">
                                    {/* Mock Avatars - In real app, map assignees */}
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[8px] text-white flex items-center justify-center border-2 border-[var(--bg-panel)] shadow-sm font-bold uppercase">
                                      {user.nome.substring(0, 2)}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 text-[var(--text-soft)]">
                                    {task.due_date && (
                                      <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${new Date(task.due_date) < new Date() ? 'text-rose-400 bg-rose-500/10' : 'bg-[var(--bg-body)]'}`} title="Prazo">
                                        <Clock size={10} />
                                        <span>{format(new Date(task.due_date), 'dd/MM')}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-[10px] font-medium hover:text-cyan-400 transition-colors">
                                      <MessageCircle size={10} />
                                      <span>0</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        <button 
                          onClick={() => openNewTaskModal(col.id)}
                          className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-xs font-bold flex items-center justify-center gap-2 mt-2 group opacity-60 hover:opacity-100"
                        >
                          <Plus size={14} className="group-hover:scale-110 transition-transform" />
                          Adicionar Tarefa
                        </button>
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      {/* New Task Modal */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setIsNewTaskModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[var(--bg-panel)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]">
              <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Zap size={18} />
                </div>
                Nova Tarefa
              </h3>
              <button onClick={() => setIsNewTaskModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-2 hover:bg-[var(--bg-panel)] rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Título</label>
                  <input 
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    className="w-full rounded-xl bg-[var(--bg-body)] border border-[var(--border)] px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-[var(--text-main)] transition-all outline-none placeholder:text-[var(--text-muted)]/50"
                    placeholder="O que precisa ser feito?"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Detalhes</label>
                  <textarea 
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    className="w-full h-32 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] transition-all resize-none outline-none placeholder:text-[var(--text-muted)]/50"
                    placeholder="Adicione contexto, requisitos ou checklist..."
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  {/* Media Button */}
                  <div className="relative">
                    <input
                      type="file"
                      id="new-task-media"
                      className="hidden"
                      onChange={e => setNewTaskMedia(e.target.files?.[0] || null)}
                    />
                    <label 
                      htmlFor="new-task-media"
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed cursor-pointer transition-all ${
                        newTaskMedia 
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' 
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-cyan-500/50 hover:text-[var(--text-main)]'
                      }`}
                    >
                      <Paperclip size={16} />
                      <span className="text-xs font-bold">{newTaskMedia ? newTaskMedia.name : 'Adicionar Mídia'}</span>
                      {newTaskMedia && (
                        <button 
                          onClick={(e) => { e.preventDefault(); setNewTaskMedia(null); }}
                          className="p-1 hover:bg-rose-500/20 text-rose-400 rounded-full ml-2"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </label>
                  </div>

                  {/* Share/Assign Button */}
                  <div className="relative">
                    <button
                      onClick={() => setIsNewTaskAssignOpen(!isNewTaskAssignOpen)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed transition-all ${
                        newTaskAssignments.length > 0
                          ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-blue-500/50 hover:text-[var(--text-main)]'
                      }`}
                    >
                      <Users size={16} />
                      <span className="text-xs font-bold">
                        {newTaskAssignments.length > 0 
                          ? `${newTaskAssignments.length} Compartilhado(s)` 
                          : 'Compartilhar'
                        }
                      </span>
                    </button>

                    {isNewTaskAssignOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-panel)] rounded-xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-body)]">
                          <h5 className="text-xs font-bold text-[var(--text-main)]">Compartilhar com:</h5>
                        </div>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {users.map(u => {
                            const isSelected = newTaskAssignments.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                onClick={() => {
                                  setNewTaskAssignments(prev => 
                                    isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                  );
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-500/10 text-blue-400 font-bold' 
                                    : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]'
                                }`}
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold uppercase ${
                                  isSelected ? 'bg-blue-500 text-white' : 'bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)]'
                                }`}>
                                  {isSelected ? <CheckCircle2 size={12} /> : u.nome.substring(0, 2)}
                                </div>
                                <span>{u.nome}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Hidden Priority (Default Medium) */}
              <input type="hidden" value={newTaskPriority} />
            </div>

            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--bg-body)]/50 backdrop-blur-md">
              <button 
                onClick={() => setIsNewTaskModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-panel)] font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim()}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus size={16} />
                Criar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {activeTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setActiveTaskId(null)} />
          <div className="relative w-full max-w-6xl h-[85vh] bg-[var(--bg-panel)] rounded-3xl shadow-2xl border border-[var(--border)] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-body)]/30">
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                 {/* Header */}
                 <div className="flex items-start justify-between mb-8">
                    <div className="space-y-4 flex-1 mr-8">
                       <div className="flex items-center gap-3">
                         <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20">
                           {tasks.find(t => t.id === activeTaskId)?.id.split('-')[0]}
                         </span>
                         <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            priorities[tasks.find(t => t.id === activeTaskId)?.priority as keyof typeof priorities] === 'Alta' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                         }`}>
                           {priorities[tasks.find(t => t.id === activeTaskId)?.priority as keyof typeof priorities]}
                         </span>
                       </div>
                       <h2 className="text-3xl font-black text-[var(--text-main)] leading-tight">
                         {tasks.find(t => t.id === activeTaskId)?.title}
                       </h2>
                    </div>
                    <button onClick={() => setActiveTaskId(null)} className="p-2 rounded-xl hover:bg-[var(--bg-body)] text-[var(--text-muted)] transition-colors hover:text-rose-400">
                      <X size={24} />
                    </button>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {/* Left Column: Description & Checklist */}
                   <div className="lg:col-span-2 space-y-8">
                      <div className="group">
                         <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-soft)] mb-4 group-hover:text-cyan-400 transition-colors">
                           <AlertTriangle size={14} /> Descrição
                         </h4>
                         <div className="bg-[var(--bg-panel)] p-6 rounded-2xl border border-[var(--border)] min-h-[120px] shadow-sm">
                           <p className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
                             {tasks.find(t => t.id === activeTaskId)?.description || <span className="text-[var(--text-muted)] italic">Sem descrição fornecida.</span>}
                           </p>
                         </div>
                      </div>

                      <div>
                         <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-soft)] mb-4">
                           <CheckCircle2 size={14} /> Checklist
                         </h4>
                         <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] overflow-hidden">
                           <div className="p-8 text-center text-[var(--text-muted)] text-sm italic">
                             Checklist indisponível no momento.
                           </div>
                         </div>
                      </div>
                   </div>

                   {/* Right Column: Meta Info */}
                   <div className="space-y-6">
                      <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] space-y-5">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">Status</label>
                          <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm font-semibold text-[var(--text-main)]">
                            {columns.find(c => c.id === tasks.find(t => t.id === activeTaskId)?.column_id)?.name}
                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                          </div>
                        </div>

                        <div className="relative">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2 flex items-center justify-between">
                            Responsáveis
                            <button onClick={() => setIsAssignOpen(!isAssignOpen)} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                              <Users size={14} />
                            </button>
                          </label>
                          
                          <div className="flex flex-wrap gap-2">
                            {assignedUsers.length === 0 ? (
                               <span className="text-sm text-[var(--text-muted)] italic">Nenhum responsável</span>
                            ) : (
                              assignedUsers.map(uid => {
                                const u = users.find(u => u.id === uid);
                                if (!u) return null;
                                return (
                                  <div key={uid} className="flex items-center gap-2 bg-[var(--bg-body)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-[8px] font-bold uppercase shadow-sm">
                                      {u.nome.substring(0, 2)}
                                    </div>
                                    <span className="text-xs font-bold text-[var(--text-main)]">{u.nome.split(' ')[0]}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Assignment Dropdown */}
                          {isAssignOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-panel)] rounded-xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                              <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-body)]">
                                <h5 className="text-xs font-bold text-[var(--text-main)]">Atribuir a:</h5>
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {users.map(u => {
                                  const isAssigned = assignedUsers.includes(u.id);
                                  return (
                                    <button
                                      key={u.id}
                                      onClick={() => {
                                        const newIds = isAssigned 
                                          ? assignedUsers.filter(id => id !== u.id)
                                          : [...assignedUsers, u.id];
                                        handleAssign(newIds);
                                      }}
                                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        isAssigned 
                                          ? 'bg-cyan-500/10 text-cyan-400 font-bold' 
                                          : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]'
                                      }`}
                                    >
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold uppercase ${
                                        isAssigned ? 'bg-cyan-500 text-white' : 'bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border)]'
                                      }`}>
                                        {isAssigned ? <CheckCircle2 size={12} /> : u.nome.substring(0, 2)}
                                      </div>
                                      <span>{u.nome}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                           <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">Anexos</label>
                           <button className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-xs font-bold flex items-center justify-center gap-2">
                             <Paperclip size={14} />
                             Adicionar
                           </button>
                        </div>
                      </div>
                   </div>
                 </div>
              </div>
            </div>

            {/* Sidebar (Comments) */}
            <div className="w-full md:w-[400px] bg-[var(--bg-panel)] border-l border-[var(--border)] flex flex-col h-full">
               <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-body)]/50">
                  <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-soft)]">
                    <MessageCircle size={14} /> Comentários
                  </h4>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                 {(comments[activeTaskId] || []).map(c => (
                    <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-cyan-500/20 mt-1">
                        {c.user_nome ? c.user_nome.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-1.5 max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-main)]">{c.user_nome}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{format(new Date(c.created_at), "d MMM, HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div className="text-xs text-[var(--text-main)] bg-[var(--bg-body)] border border-[var(--border)] p-3 rounded-2xl rounded-tl-none shadow-sm leading-relaxed">
                          {c.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(comments[activeTaskId]?.length) && (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] opacity-50 gap-3">
                       <div className="w-16 h-16 rounded-full bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border)]">
                         <MessageCircle size={24} />
                       </div>
                       <p className="text-xs">Nenhum comentário ainda.</p>
                    </div>
                  )}
               </div>

               <div className="p-4 bg-[var(--bg-body)] border-t border-[var(--border)]">
                  <div className="relative">
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      placeholder="Escreva um comentário..."
                      className="w-full pl-4 pr-12 py-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-xs focus:ring-2 focus:ring-cyan-500/30 transition-all text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none shadow-inner"
                    />
                    <button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-cyan-500 text-white disabled:opacity-50 disabled:bg-[var(--text-muted)] hover:bg-cyan-400 transition-colors shadow-sm"
                    >
                      <Send size={14} />
                    </button>
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
