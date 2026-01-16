import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useLocation } from 'react-router-dom';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
  import { supabase } from '@/services/supabase'; // <--- Added import
  import { 
    ensureDefaultBoard, 
    fetchBoards,
    fetchBoardData, 
    fetchUnifiedTasks,
    createTask, 
    updateTask, 
    deleteTask,
    moveTask, 
    fetchComments, 
    addComment, 
    logActivity, 
    fetchUsers,
    assignUsers,
    fetchTaskAssignees,
    uploadTaskAttachment,
    fetchTaskAttachments,
    deleteTaskAttachment, // <--- Added
    fetchActivityLog,
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
  Trash2,
  X,
  Clock,
  CheckCircle2,
  Send,
  Kanban,
  List,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronRight,
  Hash,
  Users,
  MessageCircle,
  Pencil // <--- Added
} from 'lucide-react';
import { format, isValid } from 'date-fns';
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

  const location = useLocation();
  const [board, setBoard] = useState<TFBoard | null>(null);
  const [boards, setBoards] = useState<TFBoard[]>([]);
  const [columns, setColumns] = useState<TFColumn[]>([]);
  const [tasks, setTasks] = useState<TFTask[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [pageByColumn, setPageByColumn] = useState<Record<string, number>>({});
  const [hasMoreByColumn, setHasMoreByColumn] = useState<Record<string, boolean>>({});
  const [infinite, setInfinite] = useState(true);
  
  // Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskColumnId, setNewTaskColumnId] = useState<string>('');
  const [newTaskMedia, setNewTaskMedia] = useState<File | null>(null);
  const [newTaskAssignments, setNewTaskAssignments] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareDraft, setShareDraft] = useState<string[]>([]);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  
  // Detail View State
  const [comments, setComments] = useState<Record<string, { id: string; user_id: string; content: string; created_at: string; user_nome?: string; user_avatar?: string }[]>>({});
  const [newComment, setNewComment] = useState('');
  const [users, setUsers] = useState<{ id: string; nome: string; avatar_url?: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Description Edit State
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescContent, setEditDescContent] = useState('');
  const [isUpdatingDesc, setIsUpdatingDesc] = useState(false);

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
      // Find matching column by name instead of ID
      // This allows mapping tasks from other boards to local visual columns
      const targetCol = columns.find(c => c.name === (t as any).original_column_name) || columns[0];
      
      if (targetCol) {
        if (!map[targetCol.id]) map[targetCol.id] = [];
        map[targetCol.id].push(t);
      }
    });
    return map;
  }, [columns, filteredTasks]);

  useEffect(() => {
    (async () => {
      // 1. Fetch all boards first
      let allBoards: TFBoard[] = [];
      try {
        allBoards = await fetchBoards();
        setBoards(allBoards);
      } catch {}

      // 2. Determine target board
      const params = new URLSearchParams(location.search);
      const urlBoardId = params.get('boardId');
      const urlTaskId = params.get('taskId');

      let targetBoard: TFBoard | null = null;

      if (urlBoardId) {
        targetBoard = allBoards.find(b => b.id === urlBoardId) || null;
      }

      // 3. Always use default board for structure
      const { board: defaultBoard, columns: defaultCols } = await ensureDefaultBoard(user);
      targetBoard = defaultBoard;
      setBoard(defaultBoard);
      setColumns(defaultCols);

      // 4. Fetch ALL accessible tasks (Unified View)
      // This ignores board_id filter and brings everything the user can see
      const allTasks = await fetchUnifiedTasks(defaultBoard.id);
      setTasks(allTasks);

      const allUsers = await fetchUsers();
      setUsers(allUsers);

      // 5. Open Task if in URL
      if (urlTaskId) {
         setActiveTaskId(urlTaskId);
      }

    })();
  }, [profile.id, pageSize, location.search]);

  // --- REALTIME SUBSCRIPTIONS ---

  // 1. Board Level Subscription (Tasks)
  useEffect(() => {
    const channel = supabase
      .channel('taskflow_global_tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taskflow_tasks' },
        async (payload) => {
          // Handle DELETE
          if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
            return;
          }

          // Handle INSERT / UPDATE
          // We need to fetch the full enriched task (with owner, column name, etc.)
          // because the realtime payload only gives raw table data.
          const { data } = await supabase
            .from('taskflow_tasks')
            .select(`
              *,
              column:taskflow_columns(name),
              owner:profiles!created_by(id, nome, avatar_url),
              assignees:taskflow_task_users(
                user_id,
                profiles:user_id(id, nome, avatar_url)
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            const enrichedTask: TFTask = {
              ...data,
              original_column_name: data.column?.name,
              owner_avatar: data.owner?.avatar_url,
              owner_name: data.owner?.nome,
              assignees_list: data.assignees?.map((a: any) => ({
                id: a.profiles?.id,
                nome: a.profiles?.nome,
                avatar_url: a.profiles?.avatar_url
              })) || []
            };

            setTasks(prev => {
              const exists = prev.find(t => t.id === enrichedTask.id);
              if (exists) {
                return prev.map(t => t.id === enrichedTask.id ? enrichedTask : t);
              } else {
                return [...prev, enrichedTask];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Task Detail Subscription (Comments, Activity, Attachments)
  useEffect(() => {
    if (!activeTaskId) return;

    const channel = supabase
      .channel(`task_detail:${activeTaskId}`)
      // Comments
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'taskflow_comments', filter: `task_id=eq.${activeTaskId}` },
        async (payload) => {
          // Fetch user info for the new comment
          const { data: userData } = await supabase
            .from('profiles')
            .select('nome, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newComment = {
            ...payload.new,
            user_nome: userData?.nome || 'Usuário',
            user_avatar: userData?.avatar_url
          };

          setComments(prev => ({
            ...prev,
            [activeTaskId]: [...(prev[activeTaskId] || []), newComment]
          }));
        }
      )
      // Activity Log
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'taskflow_activity_log', filter: `task_id=eq.${activeTaskId}` },
        async (payload) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('nome, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const newLog = {
            ...payload.new,
            user_nome: userData?.nome,
            user_avatar: userData?.avatar_url
          };

          setActivityLog(prev => [newLog, ...prev]);
        }
      )
      // Attachments
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taskflow_attachments', filter: `task_id=eq.${activeTaskId}` },
        async (payload) => {
           if (payload.eventType === 'DELETE') {
             setTaskAttachments(prev => prev.filter(a => a.id !== payload.old.id));
           } else {
             // INSERT
             setTaskAttachments(prev => [payload.new as any, ...prev]);
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTaskId]);

  const loadBoard = async (b: TFBoard) => {
    // Legacy support: We now use unified view, but keep this if needed for admin purposes
    setBoard(b);
    // ...
  };

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
    const targetColumn = columns.find(c => c.id === newColumnId);
    
    setTasks(prev => prev.map(t => (
      t.id === draggableId 
        ? { 
            ...t, 
            column_id: newColumnId, 
            updated_at: new Date().toISOString(),
            // CRITICAL FIX: Update the mapped property too so 'byColumn' re-groups correctly
            original_column_name: targetColumn?.name || (t as any).original_column_name
          } 
        : t
    )));

    await moveTask(draggableId, newColumnId);
    await logActivity(draggableId, profile.id, 'status_changed', targetColumn?.name || 'outra coluna');
  };

  const handleCreateTask = async () => {
    setNewTaskError(null);
    const title = newTaskTitle.trim();
    if (!title) return;

    let effectiveBoard = board;
    let effectiveColumns = columns;

    if (!effectiveBoard || effectiveColumns.length === 0) {
      try {
        const ensured = await ensureDefaultBoard(user);
        effectiveBoard = ensured.board;
        effectiveColumns = ensured.columns;

        setBoard(ensured.board);
        if (ensured.columns.length > 0) setColumns(ensured.columns);

        if (ensured.board?.id) {
          const data = await fetchBoardData(ensured.board.id);
          if (data.columns.length > 0) {
            effectiveColumns = data.columns;
            setColumns(data.columns);
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha ao carregar board';
        setNewTaskError(message);
        return;
      }
    }

    const targetColumnId = newTaskColumnId || effectiveColumns[0]?.id;
    if (!effectiveBoard || !targetColumnId) {
      setNewTaskError('Board ainda está carregando. Tente novamente em alguns segundos.');
      return;
    }
    
    let t: TFTask;
    try {
      t = await createTask(effectiveBoard.id, targetColumnId, title, newTaskDesc.trim(), profile.id, newTaskPriority);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao criar tarefa';
      console.error('Failed to create task:', e);
      setNewTaskError(message);
      return;
    }

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
      try {
        const finalIds = Array.from(new Set([profile.id, ...newTaskAssignments]));
        await assignUsers(t.id, finalIds, profile.nome);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha ao compartilhar tarefa';
        setNewTaskError(message);
      }
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
    setNewTaskPriority('medium');
    setNewTaskError(null);
    setNewTaskColumnId(columnId || columns[0]?.id || '');
    setIsNewTaskModalOpen(true);
  };

  const openShareModal = () => {
    setShareSearch('');
    setShareDraft(Array.from(new Set([profile.id, ...newTaskAssignments])));
    setIsShareModalOpen(true);
  };

  const [taskAttachments, setTaskAttachments] = useState<{ id: string; file_name: string; file_url: string; file_type: string; created_at: string }[]>([]);
  const [activityLog, setActivityLog] = useState<{ id: string; type: string; details: string; created_at: string; user_nome?: string; user_avatar?: string }[]>([]);
  
  const openTask = async (taskId: string) => {
    setActiveTaskId(taskId);
    
    // Set initial description for editing
    const t = tasks.find(t => t.id === taskId);
    if (t) setEditDescContent(t.description || '');

    // 1. Fetch Comments
    const cs = await fetchComments(taskId);
    setComments(prev => ({ ...prev, [taskId]: cs }));
    
    // 2. Fetch Assignees
    const assignees = await fetchTaskAssignees(taskId);
    const ownerId = tasks.find(t => t.id === taskId)?.created_by;
    const ids = assignees.map((a: any) => a.user_id);
    setAssignedUsers(Array.from(new Set([...(ownerId ? [ownerId] : []), ...ids])));

    // 3. Fetch Attachments
    const atts = await fetchTaskAttachments(taskId);
    setTaskAttachments(atts);

    // 4. Fetch Activity Log
    const logs = await fetchActivityLog(taskId);
    setActivityLog(logs);
  };

  const handleUpdateDescription = async () => {
    if (!activeTaskId) return;
    setIsUpdatingDesc(true);
    try {
      const updated = await updateTask(activeTaskId, { description: editDescContent });
      setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, description: updated.description } : t));
      setIsEditingDesc(false);
      await logActivity(activeTaskId, profile.id, 'description_updated');
    } catch (e) {
      console.error(e);
      // Optional: show error toast
    } finally {
      setIsUpdatingDesc(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTaskId || !e.target.files?.[0]) return;
    try {
      const file = e.target.files[0];
      const att = await uploadTaskAttachment(activeTaskId, file, profile.id);
      setTaskAttachments(prev => [att, ...prev]);
      await logActivity(activeTaskId, profile.id, 'attachment_added', `adicionou arquivo: ${file.name}`);
    } catch (err) {
      console.error(err);
      // Optional: show toast error
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileName: string) => {
    if (!activeTaskId) return;
    
    // Confirmação simples para evitar cliques acidentais
    if (!confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      await deleteTaskAttachment(attachmentId);
      
      // Atualiza o estado local removendo o anexo
      setTaskAttachments(prev => prev.filter(a => a.id !== attachmentId));
      
      // Registra a atividade conforme solicitado
      await logActivity(activeTaskId, profile.id, 'attachment_deleted', `removeu arquivo: ${fileName}`);
    } catch (error) {
      console.error('Failed to delete attachment', error);
      // Opcional: Adicionar notificação de erro aqui
      alert('Erro ao excluir anexo. Verifique se você tem permissão.');
    }
  };

  const handleAssign = async (userIds: string[]) => {
    if (!activeTaskId) return;
    setAssignError(null);
    try {
      const ownerId = tasks.find(t => t.id === activeTaskId)?.created_by;
      const finalIds = Array.from(new Set([...(ownerId ? [ownerId] : []), ...userIds]));
      await assignUsers(activeTaskId, finalIds, profile.nome);
      setAssignedUsers(finalIds);
      setIsAssignOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao atualizar compartilhamento';
      setAssignError(message);
    }
  };

  const handleDeleteTask = async () => {
    if (!activeTaskId) return;
    setDeleteError(null);
    try {
      await deleteTask(activeTaskId);
      setTasks(prev => prev.filter(t => t.id !== activeTaskId));
      setActiveTaskId(null);
      setIsDeleteConfirmOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao deletar tarefa';
      setDeleteError(message);
    }
  };

  const handleAddComment = async () => {
    if (!activeTaskId || !newComment.trim()) return;
    try {
      const c = await addComment(activeTaskId, profile.id, newComment.trim());
      const optimisticComment = {
        ...c,
        user_nome: profile.nome,
        user_avatar: profile.avatar_url
      };
      setComments(prev => ({ ...prev, [activeTaskId]: [...(prev[activeTaskId] || []), optimisticComment] }));
      setNewComment('');
      await logActivity(activeTaskId, profile.id, 'comment_added');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao adicionar comentário';
      console.error('Failed to add comment:', e);
      setNewTaskError(message);
    }
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
          {/* Removed Board Selector - Unified View Active */}
          <div className="relative hidden">
            <button
              type="button"
              onClick={() => setIsBoardMenuOpen(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text-main)] text-xs font-bold shadow-sm hover:border-cyan-500/30 hover:bg-[var(--bg-body)] transition-all"
              title="Selecionar board"
            >
              <span className="max-w-[200px] truncate">{board?.name || 'Board'}</span>
              <ChevronDown size={14} className={`transition-transform ${isBoardMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBoardMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[var(--bg-panel)] rounded-xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-body)]">
                  <h5 className="text-xs font-bold text-[var(--text-main)]">Boards</h5>
                </div>
                <div className="max-h-72 overflow-y-auto custom-scrollbar p-2 space-y-1">
                  {(boards.length ? boards : (board ? [board] : [])).map(b => {
                    const isSelected = b.id === board?.id;
                    const isShared = b.created_by !== profile.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => loadBoard(b)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/10 text-cyan-300 font-bold'
                            : 'text-[var(--text-main)] hover:bg-[var(--bg-body)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                           {isShared && <Users size={12} className="text-[var(--text-muted)] shrink-0" title="Compartilhado comigo" />}
                           <span className="truncate">{b.name}</span>
                        </div>
                        {isSelected && <CheckCircle2 size={14} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
                                    {priorities[task.priority as keyof typeof priorities] || task.priority}
                                  </span>
                                  
                                  {/* Owner Avatar if shared */}
                                  {(task as any).owner_avatar && (task as any).created_by !== profile.id && (
                                     <div className="flex items-center gap-1.5 bg-[var(--bg-body)] px-1.5 py-0.5 rounded-full border border-[var(--border)]" title={`Tarefa de ${(task as any).owner_name}`}>
                                       <img src={(task as any).owner_avatar} className="w-4 h-4 rounded-full" />
                                       <span className="text-[9px] font-bold max-w-[60px] truncate">{(task as any).owner_name?.split(' ')[0]}</span>
                                     </div>
                                  )}
                                  
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreVertical size={14} className="text-[var(--text-muted)] hover:text-[var(--text-main)]" />
                                  </div>
                                </div>
                                
                                <h4 className="text-sm font-semibold text-[var(--text-main)] mb-3 line-clamp-2 leading-relaxed group-hover:text-cyan-400 transition-colors">
                                  {task.title}
                                </h4>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                                  <div className="flex -space-x-2 overflow-hidden pl-1 py-1">
                                    {/* Owner Avatar (Always show if exists) */}
                                    {(task as any).owner_avatar && (
                                      <div className="w-6 h-6 rounded-full border-2 border-[var(--bg-panel)] shadow-sm z-30" title={`Criado por ${(task as any).owner_name}`}>
                                        <img src={(task as any).owner_avatar} className="w-full h-full object-cover rounded-full" />
                                      </div>
                                    )}
                                    
                                    {/* Assignees Avatars */}
                                    {((task as any).assignees_list || [])
                                      .filter((a: any) => a.id !== (task as any).created_by) // Avoid duplicate if owner is also assignee
                                      .map((a: any, i: number) => (
                                      <div key={a.id || i} className="w-6 h-6 rounded-full border-2 border-[var(--bg-panel)] bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold uppercase shadow-sm z-20" title={a.nome}>
                                        {a.avatar_url ? (
                                          <img src={a.avatar_url} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                          <span>{a.nome?.substring(0, 2)}</span>
                                        )}
                                      </div>
                                    ))}
                                    
                                    {/* Fallback if no one */}
                                    {!(task as any).owner_avatar && ((task as any).assignees_list || []).length === 0 && (
                                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-white font-bold border-2 border-[var(--bg-panel)]">
                                        ?
                                      </div>
                                    )}
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
                                      <span>{(task as any).comments_count || 0}</span>
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

                {newTaskError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                    {newTaskError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Detalhes</label>
                  <textarea 
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    className="w-full h-32 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-cyan-500/50 text-[var(--text-main)] transition-all resize-none outline-none placeholder:text-[var(--text-muted)]/50"
                    placeholder="Adicione contexto, requisitos ou checklist..."
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1">Urgência</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTaskPriority('low')}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        newTaskPriority === 'low'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-emerald-500/30'
                      }`}
                    >
                      Baixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTaskPriority('medium')}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        newTaskPriority === 'medium'
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-amber-500/30'
                      }`}
                    >
                      Média
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTaskPriority('high')}
                      className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        newTaskPriority === 'high'
                          ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-rose-500/30'
                      }`}
                    >
                      Alta
                    </button>
                  </div>
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
                      type="button"
                      onClick={openShareModal}
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
                  </div>
                </div>
              </div>
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
                disabled={!newTaskTitle.trim() || !board || columns.length === 0}
                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
              >
                <Plus size={16} />
                Criar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {isNewTaskModalOpen && isShareModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)} />
          <div className="relative w-full max-w-xl bg-[var(--bg-panel)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]">
              <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Users size={18} />
                </div>
                Compartilhar com usuários
              </h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-2 hover:bg-[var(--bg-panel)] rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={shareSearch}
                  onChange={e => setShareSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-[var(--text-main)] placeholder:text-[var(--text-muted)] shadow-sm"
                />
              </div>

              <div className="max-h-[360px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                {users
                  .filter(u => u.nome.toLowerCase().includes(shareSearch.trim().toLowerCase()) && u.id !== profile.id)
                  .map(u => {
                    const isSelected = shareDraft.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setShareDraft(prev => (isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]));
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-main)] hover:border-blue-500/20'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold uppercase ${
                          isSelected ? 'bg-blue-500 text-white' : 'bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border)]'
                        }`}>
                          {isSelected ? <CheckCircle2 size={14} /> : u.nome.substring(0, 2)}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-bold">{u.nome}</div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="p-5 border-t border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]/50">
              <div className="text-xs text-[var(--text-muted)] font-medium">
                Selecionados: <span className="text-[var(--text-main)] font-bold">{shareDraft.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-panel)] font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTaskAssignments(Array.from(new Set([profile.id, ...shareDraft])));
                    setIsShareModalOpen(false);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  Confirmar
                </button>
              </div>
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
                    <div className="flex items-center gap-2">
                      {tasks.find(t => t.id === activeTaskId)?.created_by === profile.id && (
                        <button
                          type="button"
                          onClick={() => { setDeleteError(null); setIsDeleteConfirmOpen(true); }}
                          className="p-2 rounded-xl hover:bg-rose-500/10 text-rose-400 transition-colors"
                          title="Deletar tarefa"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                      <button onClick={() => setActiveTaskId(null)} className="p-2 rounded-xl hover:bg-[var(--bg-body)] text-[var(--text-muted)] transition-colors hover:text-rose-400">
                        <X size={24} />
                      </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                   {/* Left Column: Description & Checklist */}
                   <div className="lg:col-span-2 space-y-8">
                      <div className="group">
                         <div className="flex items-center justify-between mb-4">
                           <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-soft)] group-hover:text-cyan-400 transition-colors">
                             <AlertTriangle size={14} /> Descrição
                           </h4>
                           {!isEditingDesc && (
                             <button 
                               onClick={() => setIsEditingDesc(true)} 
                               className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                               title="Editar descrição"
                             >
                               <Pencil size={14} />
                             </button>
                           )}
                         </div>
                         
                         {isEditingDesc ? (
                           <div className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-cyan-500/50 shadow-sm space-y-3">
                              <textarea
                                 value={editDescContent}
                                 onChange={e => setEditDescContent(e.target.value)}
                                 className="w-full min-h-[120px] bg-transparent border-none outline-none text-sm text-[var(--text-main)] resize-none placeholder:text-[var(--text-muted)] custom-scrollbar"
                                 placeholder="Adicione uma descrição detalhada..."
                                 autoFocus
                              />
                              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                                 <button 
                                   onClick={() => { 
                                     setIsEditingDesc(false); 
                                     setEditDescContent(tasks.find(t => t.id === activeTaskId)?.description || ''); 
                                   }} 
                                   className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-body)] transition-colors"
                                 >
                                   Cancelar
                                 </button>
                                 <button 
                                   onClick={handleUpdateDescription} 
                                   disabled={isUpdatingDesc}
                                   className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition-colors disabled:opacity-50"
                                 >
                                   {isUpdatingDesc ? 'Salvando...' : 'Salvar'}
                                 </button>
                              </div>
                           </div>
                         ) : (
                           <div 
                             className="bg-[var(--bg-panel)] p-6 rounded-2xl border border-[var(--border)] min-h-[120px] shadow-sm cursor-pointer hover:border-cyan-500/30 transition-colors"
                             onClick={() => setIsEditingDesc(true)}
                           >
                             <p className="text-sm text-[var(--text-main)] leading-relaxed whitespace-pre-wrap">
                               {tasks.find(t => t.id === activeTaskId)?.description || <span className="text-[var(--text-muted)] italic">Sem descrição fornecida.</span>}
                             </p>
                           </div>
                         )}
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
                            <button
                              type="button"
                              disabled={tasks.find(t => t.id === activeTaskId)?.created_by !== profile.id}
                              onClick={() => setIsAssignOpen(!isAssignOpen)}
                              className="text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-40 disabled:hover:text-cyan-400"
                              title={tasks.find(t => t.id === activeTaskId)?.created_by === profile.id ? 'Compartilhar/Remover' : 'Apenas o criador pode compartilhar'}
                            >
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
                                const ownerId = tasks.find(t => t.id === activeTaskId)?.created_by;
                                const canRemove = (ownerId ? uid !== ownerId : true) && (ownerId === profile.id || uid === profile.id);
                                return (
                                  <div key={uid} className="flex items-center gap-2 bg-[var(--bg-body)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white text-[8px] font-bold uppercase shadow-sm">
                                      {u.nome.substring(0, 2)}
                                    </div>
                                    <span className="text-xs font-bold text-[var(--text-main)]">{u.nome.split(' ')[0]}</span>
                                    {canRemove && (
                                      <button
                                        type="button"
                                        onClick={() => handleAssign(assignedUsers.filter(id => id !== uid))}
                                        className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="Remover"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {assignError && (
                            <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                              {assignError}
                            </div>
                          )}

                          {/* Assignment Dropdown */}
                          {isAssignOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--bg-panel)] rounded-xl shadow-2xl border border-[var(--border)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                              <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-body)]">
                                <h5 className="text-xs font-bold text-[var(--text-main)]">Atribuir a:</h5>
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                {users.filter(u => u.id !== profile.id).map(u => {
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
                           
                           {/* Attachments List */}
                           <div className="space-y-2 mb-3">
                              {taskAttachments.map(att => (
                                <div key={att.id} className="group flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border)] hover:border-cyan-500/30 transition-colors">
                                   <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 flex-1 min-w-0">
                                      <div className="p-1.5 rounded bg-[var(--bg-panel)] text-cyan-400">
                                        <Paperclip size={12} />
                                      </div>
                                      <span className="text-xs font-medium truncate">{att.file_name}</span>
                                   </a>
                                   
                                   <a href={att.file_url} download target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-cyan-400 p-1 transition-colors" title="Baixar">
                                      <Download size={12} />
                                   </a>

                                   {/* Botão de Excluir: Mostra apenas se for o criador do anexo ou dono da tarefa (respeitando a lógica visual do RLS) */}
                                   {(att.created_by === profile.id || tasks.find(t => t.id === activeTaskId)?.created_by === profile.id) && (
                                     <button
                                       onClick={() => handleDeleteAttachment(att.id, att.file_name)}
                                       className="text-[var(--text-muted)] hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                       title="Excluir anexo"
                                     >
                                       <Trash2 size={12} />
                                     </button>
                                   )}
                                </div>
                              ))}
                           </div>

                           <div className="relative">
                             <input
                               type="file"
                               id="task-detail-upload"
                               className="hidden"
                               onChange={handleUploadAttachment}
                             />
                             <label 
                               htmlFor="task-detail-upload"
                               className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                             >
                               <Paperclip size={14} />
                               Adicionar
                             </label>
                           </div>
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
                  {/* Activity Log (Mixed with comments) */}
                  {[
                    ...(comments[activeTaskId] || []).map(c => ({ ...c, type: 'comment' })),
                    ...(activityLog || []).map(l => ({ ...l, type: 'activity' }))
                  ]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .map((item: any) => {
                    if (item.type === 'activity') {
                      return (
                         <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                               <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"></div>
                            </div>
                            <div className="space-y-0.5 pt-1.5">
                               <div className="text-[11px] text-[var(--text-muted)]">
                                 <span className="font-bold text-[var(--text-soft)]">{item.user_nome}</span>
                                 {' '}
                                 {item.type === 'status_changed' && 'moveu para'}
                                 {item.type === 'task_created' && 'criou a tarefa'}
                                 {item.type === 'attachment_added' && ''}
                                 {item.type === 'attachment_deleted' && ''}
                                 {item.type === 'description_updated' && 'atualizou a descrição'}
                                 {' '}
                                 <span className="italic">{item.details}</span>
                               </div>
                               <div className="text-[9px] text-[var(--text-muted)] opacity-70">
                                 {isValid(new Date(item.created_at)) ? format(new Date(item.created_at), "d MMM, HH:mm", { locale: ptBR }) : ''}
                               </div>
                            </div>
                         </div>
                      );
                    }

                    return (
                    <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                      <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-cyan-500/20 mt-1">
                        {item.user_nome ? item.user_nome.substring(0, 2).toUpperCase() : 'U'}
                      </div>
                      <div className="space-y-1.5 max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-main)]">{item.user_nome}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {(() => {
                              const d = new Date(item.created_at);
                              return isValid(d) ? format(d, "d MMM, HH:mm", { locale: ptBR }) : '';
                            })()}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-main)] bg-[var(--bg-body)] border border-[var(--border)] p-3 rounded-2xl rounded-tl-none shadow-sm leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </div>
                      </div>
                    </div>
                  )})}
                  
                  {!(comments[activeTaskId]?.length) && !(activityLog?.length) && (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] opacity-50 gap-3">
                       <div className="w-16 h-16 rounded-full bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border)]">
                         <MessageCircle size={24} />
                       </div>
                       <p className="text-xs">Nenhum comentário ou atividade.</p>
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

      {activeTaskId && isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDeleteConfirmOpen(false)} />
          <div className="relative w-full max-w-md bg-[var(--bg-panel)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-body)]">
              <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                  <Trash2 size={18} />
                </div>
                Deletar tarefa
              </h3>
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-2 hover:bg-[var(--bg-panel)] rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-[var(--text-soft)]">
                Essa ação não pode ser desfeita. A tarefa e seus dados relacionados serão removidos.
              </p>
              {deleteError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-[var(--border)] flex items-center justify-end gap-3 bg-[var(--bg-body)]/50">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-5 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-panel)] font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-rose-500/20 transition-all active:scale-95"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskFlow;
