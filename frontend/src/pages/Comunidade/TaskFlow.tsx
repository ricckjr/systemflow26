import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useLocation } from 'react-router-dom';
import { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStatusPicker } from '@/components/taskflow/TaskStatusPicker';
import { supabase } from '@/services/supabase';
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
  fetchTaskSeen,
  markTaskSeen,
  uploadTaskAttachment,
  fetchTaskAttachments,
  deleteTaskAttachment,
  fetchActivityLog,
  TFBoard,
  TFColumn,
  TFTask
} from '@/services/taskflow';
import { getDeadlineStatus, isUnseenActivity, parseLocalDateToEndOfDayISO } from '@/utils/taskflow';
import { 
  Plus, 
  Calendar, 
  AlertTriangle, 
  UserPlus, 
  Search, 
  Download, 
  Paperclip,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  Send,
  Kanban,
  Zap,
  ChevronDown,
  Users,
  MessageCircle,
  Pencil // <--- Added
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '@/components/ui';

const priorities = { low: 'Baixa', medium: 'Média', high: 'Alta' } as const;

const normalizeColumnName = (value: string) => {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
};

const isHiddenColumnName = (name: string) => normalizeColumnName(name) === 'EM REVISAO';

const filterVisibleColumns = (cols: TFColumn[]) => cols.filter(c => !isHiddenColumnName(c.name));

type TFCommentVM = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_nome?: string;
  user_avatar?: string;
};

type TFActivityVM = {
  id: string;
  task_id: string;
  type: string;
  details?: string | null;
  user_id: string;
  created_at: string;
  user_nome?: string;
  user_avatar?: string;
};

const getDeadlineBorderClass = (status: ReturnType<typeof getDeadlineStatus>) => {
  if (status === 'overdue') return 'border-l-4 border-l-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_0_24px_rgba(244,63,94,0.12)]';
  if (status === 'soon') return 'border-l-4 border-l-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_24px_rgba(251,191,36,0.10)]';
  if (status === 'ok') return 'border-l-4 border-l-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.22),0_0_24px_rgba(52,211,153,0.08)]';
  return '';
};

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
  const { profile: authProfile, session, authReady, profileReady } = useAuth();
  const location = useLocation();
  const profile = propProfile || authProfile;
  const profileId = profile?.id || '';
  const profileName = profile?.nome || '';
  const profileAvatarUrl = profile?.avatar_url;
  const [board, setBoard] = useState<TFBoard | null>(null);
  const [boards, setBoards] = useState<TFBoard[]>([]);
  const [columns, setColumns] = useState<TFColumn[]>([]);
  const [tasks, setTasks] = useState<TFTask[]>([]);
  
  // Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  
  // New Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskColumnId, setNewTaskColumnId] = useState<string>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskMedia, setNewTaskMedia] = useState<File | null>(null);
  const [newTaskAssignments, setNewTaskAssignments] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareDraft, setShareDraft] = useState<string[]>([]);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [fadingUnseenByTaskId, setFadingUnseenByTaskId] = useState<Record<string, true>>({});
  const fadeTimersRef = useRef<Record<string, number>>({});
  
  // Detail View State
  const [comments, setComments] = useState<Record<string, TFCommentVM[]>>({});
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [taskAttachments, setTaskAttachments] = useState<{ id: string; file_name: string; file_url: string; file_type: string; created_at: string; created_by?: string }[]>([]);
  const [activityLog, setActivityLog] = useState<TFActivityVM[]>([]);
  const [users, setUsers] = useState<{ id: string; nome: string; avatar_url?: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isMovingStatus, setIsMovingStatus] = useState(false);
  const [moveStatusError, setMoveStatusError] = useState<string | null>(null);
  const [isTaskShareModalOpen, setIsTaskShareModalOpen] = useState(false);
  const [taskShareSearch, setTaskShareSearch] = useState('');
  const [taskShareDraft, setTaskShareDraft] = useState<string[]>([]);

  // Description Edit State
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescContent, setEditDescContent] = useState('');
  const [isUpdatingDesc, setIsUpdatingDesc] = useState(false);

  // Due Date Edit State
  const [taskDueDateDraft, setTaskDueDateDraft] = useState('');
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);
  const [dueDateError, setDueDateError] = useState<string | null>(null);

  // Computed
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.toLowerCase()), 250)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      for (const id of Object.values(fadeTimersRef.current)) window.clearTimeout(id);
      fadeTimersRef.current = {};
    };
  }, []);

  const firstColumnId = columns[0]?.id || '';
  const columnsById = useMemo(() => new Map(columns.map(c => [c.id, c])), [columns]);
  const columnIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of columns) map.set(c.name, c.id);
    return map;
  }, [columns]);

  const filteredTasks = useMemo(() => {
    let next = tasks
    if (priorityFilter !== 'all') next = next.filter(t => t.priority === priorityFilter)
    if (!debouncedSearch) return next
    return next.filter(t => (t.title || '').toLowerCase().includes(debouncedSearch) || (t.description || '').toLowerCase().includes(debouncedSearch))
  }, [tasks, debouncedSearch, priorityFilter])

  const byColumn = useMemo(() => {
    const map: Record<string, TFTask[]> = {};
    columns.forEach(c => (map[c.id] = []));

    if (!firstColumnId) return map;

    for (const t of filteredTasks) {
      const originalColumnName = t.original_column_name;
      const mappedByName = originalColumnName && !isHiddenColumnName(originalColumnName) ? columnIdByName.get(originalColumnName) : undefined;
      const mappedById = t.column_id && columnsById.has(t.column_id) ? t.column_id : undefined;
      const columnId = mappedByName || mappedById || firstColumnId;

      if (!map[columnId]) map[columnId] = [];
      map[columnId].push(t);
    }
    return map;
  }, [columns, filteredTasks, firstColumnId, columnIdByName, columnsById]);

  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    return tasks.find(t => t.id === activeTaskId) || null;
  }, [tasks, activeTaskId]);

  const activeTaskVisualStatus = useMemo(() => {
    if (!activeTask) return '';
    const originalColumnName = activeTask.original_column_name;
    if (originalColumnName && !isHiddenColumnName(originalColumnName) && columnIdByName.has(originalColumnName)) return originalColumnName;
    const col = activeTask.column_id ? columnsById.get(activeTask.column_id) : undefined;
    const fallback = columnsById.get(firstColumnId)?.name || '';
    return col?.name || (originalColumnName && !isHiddenColumnName(originalColumnName) ? originalColumnName : '') || fallback;
  }, [activeTask, columnIdByName, columnsById, firstColumnId]);

  const activeTaskPriorityLabel = useMemo(() => {
    if (!activeTask) return '';
    const key = activeTask.priority as keyof typeof priorities;
    return priorities[key] || String(activeTask.priority || '');
  }, [activeTask]);

  const activeTaskShortId = useMemo(() => {
    if (!activeTask?.id) return '';
    return activeTask.id.split('-')[0];
  }, [activeTask?.id]);

  const activeTaskVisualColumnId = useMemo(() => {
    if (!activeTask) return '';
    const originalColumnName = activeTask.original_column_name;
    const mappedByName = originalColumnName && !isHiddenColumnName(originalColumnName) ? columnIdByName.get(originalColumnName) : undefined;
    const mappedById = activeTask.column_id && columnsById.has(activeTask.column_id) ? activeTask.column_id : undefined;
    return mappedByName || mappedById || firstColumnId;
  }, [activeTask, columnIdByName, columnsById, firstColumnId]);

  const activeTaskOwnerId = useMemo(() => {
    return activeTask?.created_by || '';
  }, [activeTask?.created_by]);

  const canShareActiveTask = useMemo(() => {
    return !!activeTaskOwnerId && activeTaskOwnerId === profileId;
  }, [activeTaskOwnerId, profileId]);

  // Regra explícita: a data de entrega só pode ser alterada pelo criador (created_by === user.id).
  const canEditActiveTaskDueDate = useMemo(() => {
    return !!activeTaskOwnerId && activeTaskOwnerId === profileId;
  }, [activeTaskOwnerId, profileId]);

  const activeTaskDueDateInputValue = useMemo(() => {
    if (!activeTask?.due_date) return '';
    const d = new Date(activeTask.due_date);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, 'yyyy-MM-dd');
  }, [activeTask?.due_date]);

  const timelineItems = useMemo(() => {
    if (!activeTaskId) return [];
    const taskComments = comments[activeTaskId] || [];
    const items = [
      ...taskComments.map(c => ({ kind: 'comment' as const, ...c })),
      ...activityLog.map(l => ({ kind: 'activity' as const, ...l }))
    ];
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [activeTaskId, comments, activityLog]);

  useEffect(() => {
    if (!authReady || !profileReady || !session || !profileId || !profile) return;
    let cancelled = false;

    (async () => {
      const allBoards = await fetchBoards().catch(() => []);
      if (cancelled) return;
      setBoards(allBoards);

      try {
        const { board: defaultBoard, columns: defaultCols } = await ensureDefaultBoard(profile);
        if (cancelled) return;
        if (defaultBoard) {
          setBoard(defaultBoard);
          setColumns(filterVisibleColumns(defaultCols));

          const rawTasks = await fetchUnifiedTasks();
          if (cancelled) return;
          const seenMap = await fetchTaskSeen(profileId, rawTasks.map(t => t.id));
          if (cancelled) return;
          setTasks(rawTasks.map(t => ({ ...t, last_seen_at: seenMap.get(t.id) })));
        }
      } catch (err) {
        console.error('TaskFlow Critical Error: Failed to load/create board', err);
      }

      const allUsers = await fetchUsers().catch(() => []);
      if (cancelled) return;
      setUsers(allUsers);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, profileReady, session, profileId, profile]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlTaskId = params.get('taskId');
    if (urlTaskId) setActiveTaskId(prev => (prev === urlTaskId ? prev : urlTaskId));
  }, [location.search]);

  // --- REALTIME SUBSCRIPTIONS ---

  // 1. Board Level Subscription (Tasks)
  useEffect(() => {
    if (!session) return;
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
            const owner = Array.isArray((data as any).owner) ? (data as any).owner[0] : (data as any).owner;
            const column = Array.isArray((data as any).column) ? (data as any).column[0] : (data as any).column;
            const enrichedTask: TFTask = {
              ...data,
              priority: ((data as any).priority || 'medium') as TFTask['priority'],
              original_column_name: column?.name,
              owner_avatar: owner?.avatar_url,
              owner_name: owner?.nome,
              assignees_list:
                (data as any).assignees?.map((a: any) => ({
                  id: a.profiles?.id,
                  nome: a.profiles?.nome,
                  avatar_url: a.profiles?.avatar_url
                })) || [],
              last_activity_at: (data as any).last_activity_at || (data as any).updated_at || (data as any).created_at
            };

            setTasks(prev => {
              const existing = prev.find(t => t.id === enrichedTask.id);
              const merged = existing?.last_seen_at ? { ...enrichedTask, last_seen_at: existing.last_seen_at } : enrichedTask;
              return existing ? prev.map(t => (t.id === merged.id ? merged : t)) : [...prev, merged];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // 2. Task Detail Subscription (Comments, Activity, Attachments)
  useEffect(() => {
    if (!session || !activeTaskId) return;

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

          const row = payload.new as any;
          const newComment: TFCommentVM = {
            id: row.id,
            task_id: row.task_id,
            user_id: row.user_id,
            content: row.content,
            created_at: row.created_at,
            user_nome: userData?.nome || 'Usuário',
            user_avatar: userData?.avatar_url
          };

          setComments(prev => ({
            ...prev,
            [activeTaskId]: (() => {
              const list = prev[activeTaskId] || []
              const idx = list.findIndex(c => c.id === newComment.id)
              if (idx >= 0) {
                const copy = list.slice()
                copy[idx] = { ...copy[idx], ...newComment }
                return copy
              }
              return [...list, newComment]
            })()
          }));

          markTaskSeen(activeTaskId).catch(() => null);
          setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
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

          const row = payload.new as any;
          const newLog: TFActivityVM = {
            id: row.id,
            task_id: row.task_id,
            type: row.type,
            details: row.details,
            user_id: row.user_id,
            created_at: row.created_at,
            user_nome: userData?.nome,
            user_avatar: userData?.avatar_url
          };

          setActivityLog(prev => {
            const idx = prev.findIndex(l => l.id === newLog.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], ...newLog };
              return copy;
            }
            return [newLog, ...prev];
          });

          markTaskSeen(activeTaskId).catch(() => null);
          setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
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
             const next = payload.new as any;
             setTaskAttachments(prev => {
               const idx = prev.findIndex(a => a.id === next.id);
               if (idx >= 0) {
                 const copy = prev.slice();
                 copy[idx] = { ...copy[idx], ...next };
                 return copy;
               }
               return [next, ...prev];
             });
           }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTaskId, session]);

  const loadBoard = async (b: TFBoard) => {
    // Legacy support: We now use unified view, but keep this if needed for admin purposes
    setBoard(b);
    // ...
  };

  const openNewTaskModal = useCallback((columnId?: string) => {
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    setNewTaskMedia(null);
    setNewTaskAssignments([]);
    setNewTaskPriority('medium');
    setNewTaskError(null);
    setNewTaskColumnId(columnId || firstColumnId || '');
    setIsNewTaskModalOpen(true);
  }, [firstColumnId]);

  const openShareModal = useCallback(() => {
    setShareSearch('');
    setShareDraft(Array.from(new Set([profileId, ...newTaskAssignments])));
    setIsShareModalOpen(true);
  }, [profileId, newTaskAssignments]);

  // useScrollLock removido em favor do componente Modal
  // useScrollLock(isNewTaskModalOpen || !!activeTaskId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingContext = tagName === 'input' || tagName === 'textarea' || (target as any)?.isContentEditable;
      if (isTypingContext) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === 'Escape') {
        if (isNewTaskModalOpen) setIsNewTaskModalOpen(false);
        if (activeTaskId) setActiveTaskId(null);
      }
      if (e.key.toLowerCase() === 'n' && !isNewTaskModalOpen && !activeTaskId) {
        e.preventDefault();
        openNewTaskModal();
      }
      if (e.key.toLowerCase() === 'f' && !isNewTaskModalOpen && !activeTaskId) {
        e.preventDefault();
        const el = document.getElementById('taskflow-search') as HTMLInputElement | null
        el?.focus()
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNewTaskModalOpen, activeTaskId, openNewTaskModal]);

  const moveTaskToColumn = useCallback(async (taskId: string, destinationColumnId: string) => {
    if (!taskId || !destinationColumnId) return;

    const targetColumnName = columnsById.get(destinationColumnId)?.name || 'outra coluna';
    let fromColumnName = '';
    let rollbackTask: TFTask | null = null;
    let rollbackIndex = -1;
    let shouldAffectModal = false;

    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === taskId);
      if (idx < 0) return prev;

      const task = prev[idx];
      const originalColumnName = task.original_column_name;
      if (task.column_id === destinationColumnId) return prev;

      const safeOriginalColumnName =
        originalColumnName && !isHiddenColumnName(originalColumnName) ? originalColumnName : undefined;
      const currentByName = safeOriginalColumnName ? columnIdByName.get(safeOriginalColumnName) : undefined;
      const currentById = task.column_id && columnsById.has(task.column_id) ? task.column_id : undefined;
      const currentColumnId = currentByName || currentById || task.column_id || firstColumnId;
      if (!currentColumnId || currentColumnId === destinationColumnId) return prev;

      fromColumnName =
        (currentByName ? safeOriginalColumnName : undefined) ||
        (currentById ? columnsById.get(currentById)?.name : undefined) ||
        safeOriginalColumnName ||
        '';

      rollbackTask = task;
      rollbackIndex = idx;
      shouldAffectModal = taskId === activeTaskId;

      const updatedTask: TFTask = {
        ...task,
        column_id: destinationColumnId,
        updated_at: new Date().toISOString(),
        original_column_name: targetColumnName
      };

      const next = prev.slice();
      next.splice(idx, 1);
      next.unshift(updatedTask);
      return next;
    });

    if (!rollbackTask) return;

    if (shouldAffectModal) {
      setIsMovingStatus(true);
      setMoveStatusError(null);
    }

    try {
      await moveTask(taskId, destinationColumnId);
      const details = fromColumnName ? `de ${fromColumnName} para ${targetColumnName}` : targetColumnName;
      await logActivity(taskId, profileId, 'status_changed', details);
      await markTaskSeen(taskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao mover tarefa';
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === taskId);
        if (idx < 0) return prev;
        const current = prev[idx];
        const next = prev.slice();
        next.splice(idx, 1);
        const restored = { ...current, ...rollbackTask } as TFTask;
        const insertAt = rollbackIndex >= 0 ? Math.min(rollbackIndex, next.length) : 0;
        next.splice(insertAt, 0, restored);
        return next;
      });
      if (shouldAffectModal) setMoveStatusError(message);
    } finally {
      if (shouldAffectModal) setIsMovingStatus(false);
    }
  }, [activeTaskId, columnIdByName, columnsById, firstColumnId, profileId]);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    await moveTaskToColumn(draggableId, destination.droppableId);
  }, [moveTaskToColumn]);

  const handleCreateTask = async () => {
    setNewTaskError(null);
    if (!profileId || !profile) {
      setNewTaskError('Perfil ainda está carregando. Tente novamente em alguns segundos.');
      return;
    }
    const title = newTaskTitle.trim();
    if (!title) return;

    const dueDateISO = parseLocalDateToEndOfDayISO(newTaskDueDate);
    if (!dueDateISO) {
      setNewTaskError('Data limite é obrigatória e deve ser válida.');
      return;
    }

    let effectiveBoard = board;
    let effectiveColumns = columns;

    if (!effectiveBoard || effectiveColumns.length === 0) {
      try {
        const ensured = await ensureDefaultBoard(profile);
        effectiveBoard = ensured.board;
        effectiveColumns = filterVisibleColumns(ensured.columns);

        setBoard(ensured.board);
        if (ensured.columns.length > 0) setColumns(filterVisibleColumns(ensured.columns));

        if (ensured.board?.id) {
          const data = await fetchBoardData(ensured.board.id);
          if (data.columns.length > 0) {
            effectiveColumns = filterVisibleColumns(data.columns);
            setColumns(filterVisibleColumns(data.columns));
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
      t = await createTask(effectiveBoard.id, targetColumnId, title, newTaskDesc.trim(), profileId, newTaskPriority, dueDateISO);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao criar tarefa';
      console.error('Failed to create task:', e);
      setNewTaskError(message);
      return;
    }

    // 2. Upload Media if present
    if (newTaskMedia) {
      try {
        await uploadTaskAttachment(t.id, newTaskMedia, profileId);
      } catch (e) {
        console.error("Failed to upload media on create", e);
      }
    }

    // 3. Assign Users if selected
    if (newTaskAssignments.length > 0) {
      try {
        const finalIds = Array.from(new Set([profileId, ...newTaskAssignments]));
        await assignUsers(t.id, finalIds);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Falha ao compartilhar tarefa';
        setNewTaskError(message);
      }
    }

    setTasks(prev => {
      const idx = prev.findIndex(x => x.id === t.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = { ...copy[idx], ...t };
        return copy;
      }
      return [...prev, t];
    });
    
    // Reset and Close
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    setNewTaskMedia(null);
    setNewTaskAssignments([]);
    setIsNewTaskModalOpen(false);
    
    await logActivity(t.id, profileId, 'task_created', newTaskTitle.trim());
    markTaskSeen(t.id).catch(() => null);
    setTasks(prev => prev.map(x => (x.id === t.id ? { ...x, last_seen_at: new Date().toISOString() } : x)));
  };
  
  const openTask = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
    setFadingUnseenByTaskId(prev => (prev[taskId] ? prev : { ...prev, [taskId]: true }));

    const existingTimer = fadeTimersRef.current[taskId];
    if (existingTimer) window.clearTimeout(existingTimer);

    fadeTimersRef.current[taskId] = window.setTimeout(() => {
      markTaskSeen(taskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
      setFadingUnseenByTaskId(prev => {
        if (!prev[taskId]) return prev;
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
      delete fadeTimersRef.current[taskId];
    }, 300);
  }, []);

  const openTaskShareModal = useCallback(() => {
    if (!activeTaskId) return;
    setTaskShareSearch('');
    const initial = assignedUsers.filter(id => id && id !== activeTaskOwnerId);
    setTaskShareDraft(Array.from(new Set(initial)));
    setIsTaskShareModalOpen(true);
  }, [activeTaskId, assignedUsers, activeTaskOwnerId]);

  useEffect(() => {
    if (!activeTaskId) return;
    setEditDescContent(activeTask?.description || '');
  }, [activeTaskId, activeTask?.description]);

  useEffect(() => {
    if (!activeTaskId) return;
    setTaskDueDateDraft(activeTaskDueDateInputValue);
    setDueDateError(null);
    setIsUpdatingDueDate(false);
  }, [activeTaskId, activeTaskDueDateInputValue]);

  useEffect(() => {
    if (!activeTaskId) return;

    let cancelled = false;
    const taskId = activeTaskId;

    setNewComment('');
    setCommentError(null);
    setAssignError(null);
    setIsDeleteConfirmOpen(false);
    setDeleteError(null);
    setIsMovingStatus(false);
    setMoveStatusError(null);
    setIsTaskShareModalOpen(false);
    setTaskShareSearch('');
    setTaskShareDraft([]);
    setIsEditingDesc(false);
    setIsUpdatingDesc(false);
    setTaskAttachments([]);
    setActivityLog([]);
    setAssignedUsers([]);

    (async () => {
      const [cs, assignees, atts, logs] = await Promise.all([
        fetchComments(taskId).catch(() => []),
        fetchTaskAssignees(taskId).catch(() => []),
        fetchTaskAttachments(taskId).catch(() => []),
        fetchActivityLog(taskId).catch(() => [])
      ]);

      if (cancelled) return;

      setComments(prev => ({ ...prev, [taskId]: cs }));
      setTaskAttachments(atts as any);
      setActivityLog(logs as any);

      const ownerId = activeTask?.created_by;
      const ids = (assignees as any[]).map(a => a.user_id).filter(Boolean);
      const finalIds = Array.from(new Set([...(ownerId ? [ownerId] : []), ...ids]));
      setAssignedUsers(finalIds);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTaskId]);

  useEffect(() => {
    if (!activeTaskId) return;
    const ownerId = activeTask?.created_by;
    if (!ownerId) return;
    setAssignedUsers(prev => (prev.includes(ownerId) ? prev : Array.from(new Set([ownerId, ...prev]))));
  }, [activeTaskId, activeTask?.created_by]);

  const handleUpdateDescription = async () => {
    if (!activeTaskId) return;
    setIsUpdatingDesc(true);
    try {
      const updated = await updateTask(activeTaskId, { description: editDescContent });
      setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, description: updated.description } : t));
      setIsEditingDesc(false);
      await logActivity(activeTaskId, profileId, 'description_updated');
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
    } catch (e) {
      console.error(e);
      // Optional: show error toast
    } finally {
      setIsUpdatingDesc(false);
    }
  };

  const handleUpdateDueDate = async () => {
    if (!activeTaskId) return;
    if (!canEditActiveTaskDueDate) return;

    setDueDateError(null);

    const trimmed = taskDueDateDraft.trim();
    const dueDateISO = trimmed ? parseLocalDateToEndOfDayISO(trimmed) : null;
    if (trimmed && !dueDateISO) {
      setDueDateError('Data inválida.');
      return;
    }

    setIsUpdatingDueDate(true);
    try {
      const updated = await updateTask(activeTaskId, { due_date: dueDateISO });
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, due_date: updated.due_date } : t)));
      const details = trimmed ? `para ${trimmed}` : 'removida';
      await logActivity(activeTaskId, profileId, 'due_date_updated', details);
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
    } catch (e) {
      console.error(e);
      setDueDateError('Não foi possível atualizar a data de entrega.');
    } finally {
      setIsUpdatingDueDate(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeTaskId || !e.target.files?.[0]) return;
    try {
      const file = e.target.files[0];
      const att = await uploadTaskAttachment(activeTaskId, file, profileId);
      setTaskAttachments(prev => [att, ...prev]);
      await logActivity(activeTaskId, profileId, 'attachment_added', `adicionou arquivo: ${file.name}`);
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
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
      await logActivity(activeTaskId, profileId, 'attachment_deleted', `removeu arquivo: ${fileName}`);
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
    } catch (error) {
      console.error('Failed to delete attachment', error);
      // Opcional: Adicionar notificação de erro aqui
      alert('Erro ao excluir anexo. Verifique se você tem permissão.');
    }
  };

  const handleAssign = async (userIds: string[]) => {
    if (!activeTaskId) return false;
    setAssignError(null);
    try {
      const ownerId = activeTask?.created_by;
      const finalIds = Array.from(new Set([...(ownerId ? [ownerId] : []), ...userIds]));
      await assignUsers(activeTaskId, finalIds);
      setAssignedUsers(finalIds);
      await logActivity(activeTaskId, profileId, 'assignees_updated', 'responsáveis atualizados');
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao atualizar compartilhamento';
      setAssignError(message);
      return false;
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
    setCommentError(null);
    try {
      const c = await addComment(activeTaskId, profileId, newComment.trim());
      const optimisticComment = {
        ...c,
        user_nome: profileName,
        user_avatar: profileAvatarUrl
      };
      setComments(prev => ({
        ...prev,
        [activeTaskId]: (() => {
          const list = prev[activeTaskId] || []
          const idx = list.findIndex(comment => comment.id === optimisticComment.id)
          if (idx >= 0) {
            const copy = list.slice()
            copy[idx] = { ...copy[idx], ...optimisticComment }
            return copy
          }
          return [...list, optimisticComment]
        })()
      }));
      setNewComment('');
      await logActivity(activeTaskId, profileId, 'comment_added');
      await markTaskSeen(activeTaskId).catch(() => null);
      setTasks(prev => prev.map(t => (t.id === activeTaskId ? { ...t, last_seen_at: new Date().toISOString() } : t)));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao adicionar comentário';
      console.error('Failed to add comment:', e);
      setCommentError(message);
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-[var(--text-soft)] gap-4">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        <p className="text-xs text-rose-400">Carregando perfil... Se demorar muito, recarregue a página.</p>
      </div>
    );
  }

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
                    const isShared = b.created_by !== profileId;
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
                           {isShared && (
                             <span title="Compartilhado comigo" className="shrink-0">
                               <Users size={12} className="text-[var(--text-muted)]" />
                             </span>
                           )}
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
        <div className="min-w-[190px]">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] text-sm text-[var(--text-main)] shadow-sm focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 outline-none"
          >
            <option value="all">Todas urgências</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
      </div>

      {columns.length === 0 ? (
        <div className="flex-1 px-4 md:px-0">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 text-sm text-[var(--text-muted)]">
            Carregando colunas do TaskFlow...
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-scroll overflow-y-hidden pb-4 px-4 md:px-0 taskflow-kanban-scroll">
            <div className="flex h-full gap-5 min-w-[1200px]">
              {columns.map(col => {
                const theme = getColumnTheme(col.name);
                return (
                  <div key={col.id} className="flex flex-col w-80 shrink-0">
                    <div className={`flex items-center justify-between mb-4 pb-2 border-t-4 ${theme.border} bg-[var(--bg-panel)] px-4 py-3 rounded-xl shadow-sm border-x border-b border-[var(--border)] group hover:shadow-md transition-shadow`}>
                       <div className="flex items-center gap-2">
                         <h3 className={`text-xs font-black uppercase tracking-widest ${theme.text}`}>{col.name}</h3>
                       </div>
                       <span className="text-[10px] font-bold bg-[var(--bg-body)] text-[var(--text-soft)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                         {byColumn[col.id]?.length || 0}
                       </span>
                    </div>

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
                                    group relative mb-3 p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] 
                                    shadow-sm hover:shadow-lg hover:border-cyan-500/30 cursor-grab active:cursor-grabbing transition-all
                                    ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-cyan-500 z-50 bg-slate-800' : ''}
                                    ${getDeadlineBorderClass(getDeadlineStatus(task.due_date, nowMs))}
                                  `}
                                >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                      task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 
                                      task.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                      {priorities[task.priority as keyof typeof priorities] || task.priority}
                                    </span>

                                    {(() => {
                                      const isUnseen = isUnseenActivity(
                                        task.last_activity_at || task.updated_at || task.created_at,
                                        task.last_seen_at
                                      );
                                      const isSharedTask =
                                        task.created_by !== profileId ||
                                        (task.assignees_list || []).some(a => a?.id && a.id !== task.created_by);

                                      if (!isUnseen || !isSharedTask) return null;

                                      return (
                                        <span
                                          title="Nova atividade disponível"
                                          className={`w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-panel)] bg-emerald-400 taskflow-unseen-marker ${
                                            fadingUnseenByTaskId[task.id] ? 'taskflow-unseen-marker--fading' : ''
                                          }`}
                                        />
                                      );
                                    })()}
                                  </div>
                                  
                                  {/* Owner Avatar if shared */}
                                  {task.owner_avatar && task.created_by !== profileId && (
                                     <div className="flex items-center gap-1.5 bg-[var(--bg-body)] px-1.5 py-0.5 rounded-full border border-[var(--border)]" title={`Tarefa de ${task.owner_name || ''}`}>
                                       <img src={task.owner_avatar} className="w-4 h-4 rounded-full" />
                                       <span className="text-[9px] font-bold max-w-[60px] truncate">{task.owner_name?.split(' ')[0]}</span>
                                     </div>
                                  )}
                                </div>
                                
                                <h4 className="text-sm font-semibold text-[var(--text-main)] mb-3 line-clamp-2 leading-relaxed group-hover:text-cyan-400 transition-colors">
                                  {task.title}
                                </h4>
                                
                                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                                  <div className="flex -space-x-2 overflow-hidden pl-1 py-1">
                                    {/* Owner Avatar (Always show if exists) */}
                                    {task.owner_avatar && (
                                      <div className="w-6 h-6 rounded-full border-2 border-[var(--bg-panel)] shadow-sm z-30" title={`Criado por ${task.owner_name || ''}`}>
                                        <img src={task.owner_avatar} className="w-full h-full object-cover rounded-full" />
                                      </div>
                                    )}
                                    
                                    {/* Assignees Avatars */}
                                    {(task.assignees_list || [])
                                      .filter(a => a.id !== task.created_by)
                                      .map((a, i) => (
                                      <div key={a.id || i} className="w-6 h-6 rounded-full border-2 border-[var(--bg-panel)] bg-slate-700 flex items-center justify-center text-[8px] text-white font-bold uppercase shadow-sm z-20" title={a.nome}>
                                        {a.avatar_url ? (
                                          <img src={a.avatar_url} className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                          <span>{a.nome?.substring(0, 2)}</span>
                                        )}
                                      </div>
                                    ))}
                                    
                                    {/* Fallback if no one */}
                                    {!task.owner_avatar && (task.assignees_list || []).length === 0 && (
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
                                      <span>{task.comments_count || 0}</span>
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
      )}

      {/* New Task Modal */}
      <Modal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Zap size={18} />
            </div>
            Nova Tarefa
          </div>
        }
        size="2xl"
        footer={
          <>
            <button 
              onClick={() => setIsNewTaskModalOpen(false)}
              className="px-6 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-panel)] font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || !newTaskDueDate.trim() || !board || columns.length === 0}
              className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
            >
              <Plus size={16} />
              Criar Tarefa
            </button>
          </>
        }
      >
        <div className="space-y-6">
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

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-wide ml-1 flex items-center justify-between">
                    Data Limite <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm font-medium focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-[var(--text-main)] transition-all outline-none"
                      required
                    />
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
      </Modal>

      {/* Modal: Compartilhar Nova Tarefa */}
      <Modal
        isOpen={isNewTaskModalOpen && isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        zIndex={120}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={18} />
            </div>
            Compartilhar com usuários
          </div>
        }
        size="md"
        footer={
          <>
            <div className="flex-1 text-left text-xs text-[var(--text-muted)] font-medium self-center">
              Selecionados: <span className="text-[var(--text-main)] font-bold">{shareDraft.length}</span>
            </div>
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
                setNewTaskAssignments(Array.from(new Set([profileId, ...shareDraft])));
                setIsShareModalOpen(false);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              Confirmar
            </button>
          </>
        }
      >
        <div className="space-y-4">
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
                  .filter(u => u.nome.toLowerCase().includes(shareSearch.trim().toLowerCase()) && u.id !== profileId)
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
      </Modal>

      {/* Modal: Compartilhar Tarefa Existente */}
      <Modal
        isOpen={!!activeTaskId && isTaskShareModalOpen}
        onClose={() => setIsTaskShareModalOpen(false)}
        zIndex={120}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <UserPlus size={18} />
            </div>
            Compartilhar tarefa
          </div>
        }
        size="md"
        footer={
          <>
            <div className="flex-1 text-left text-xs text-[var(--text-muted)] font-medium self-center">
              Selecionados: <span className="text-[var(--text-main)] font-bold">{taskShareDraft.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsTaskShareModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-[var(--text-main)] hover:bg-[var(--bg-panel)] font-medium text-sm transition-colors border border-transparent hover:border-[var(--border)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!canShareActiveTask) return;
                const ok = await handleAssign(taskShareDraft);
                if (ok) setIsTaskShareModalOpen(false);
              }}
              disabled={!canShareActiveTask}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              Confirmar
            </button>
          </>
        }
      >
        <div className="space-y-4">
              {!canShareActiveTask && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  Apenas o criador da tarefa pode compartilhar/remover responsáveis.
                </div>
              )}
              {assignError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {assignError}
                </div>
              )}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  value={taskShareSearch}
                  onChange={e => setTaskShareSearch(e.target.value)}
                  placeholder="Buscar usuário..."
                  disabled={!canShareActiveTask}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all text-[var(--text-main)] placeholder:text-[var(--text-muted)] shadow-sm"
                />
              </div>

              <div className="max-h-[360px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                {users
                  .filter(u => u.id !== activeTaskOwnerId)
                  .filter(u => u.nome.toLowerCase().includes(taskShareSearch.trim().toLowerCase()))
                  .map(u => {
                    const isSelected = taskShareDraft.includes(u.id);
                    const locked = !canShareActiveTask;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          if (locked) return;
                          setTaskShareDraft(prev => (isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]));
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                            : 'bg-[var(--bg-body)] border-[var(--border)] text-[var(--text-main)] hover:border-blue-500/20'
                        } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
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
      </Modal>

      {/* Task Details Modal */}
      <Modal
        isOpen={!!activeTaskId}
        onClose={() => setActiveTaskId(null)}
        size="4xl"
        noPadding
        scrollableContent
        className="h-[100vh] max-h-[100vh] rounded-none md:h-auto md:max-h-[90vh] md:rounded-2xl md:max-w-[90vw] lg:max-w-6xl xl:max-w-7xl"
        title={
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/20 whitespace-nowrap">
                {activeTaskShortId}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                  activeTaskPriorityLabel === 'Alta'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}
              >
                {activeTaskPriorityLabel}
              </span>
            </div>
            <div className="mt-2 text-base md:text-lg font-black text-[var(--text-main)] truncate">
              {activeTask?.title}
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] min-h-full">
          <div className="bg-[var(--bg-body)]/30 border-b lg:border-b-0 lg:border-r border-[var(--border)]">
            <div className="px-5 py-6 md:px-8 md:py-8">
              <div className="flex items-center justify-end gap-2 mb-6">
                <button
                  type="button"
                  onClick={openTaskShareModal}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-blue-500/10 text-blue-400 transition-colors"
                  title={canShareActiveTask ? 'Compartilhar tarefa' : 'Apenas o criador pode compartilhar'}
                >
                  <UserPlus size={18} />
                  <span className="hidden sm:inline text-xs font-bold">Compartilhar</span>
                </button>
                {activeTask?.created_by === profileId && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-2 rounded-xl hover:bg-rose-500/10 text-rose-400 transition-colors"
                    title="Deletar tarefa"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
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
                              setEditDescContent(activeTask?.description || '');
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
                          {activeTask?.description || <span className="text-[var(--text-muted)] italic">Sem descrição fornecida.</span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] space-y-5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">Status</label>
                      <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm font-semibold text-[var(--text-main)]">
                        {activeTaskVisualStatus}
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                      </div>
                      <div className="mt-2">
                        <TaskStatusPicker
                          columns={columns}
                          currentColumnId={activeTaskVisualColumnId}
                          onSelect={columnId => {
                            if (!activeTaskId) return;
                            moveTaskToColumn(activeTaskId, columnId);
                          }}
                          disabled={!activeTaskId || !activeTaskVisualColumnId || columns.length === 0}
                          isLoading={isMovingStatus}
                          label="Mover para"
                        />
                        {moveStatusError && (
                          <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                            {moveStatusError}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">
                        Data de entrega
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={taskDueDateDraft}
                          onChange={e => {
                            setTaskDueDateDraft(e.target.value);
                            if (dueDateError) setDueDateError(null);
                          }}
                          disabled={!canEditActiveTaskDueDate || isUpdatingDueDate}
                          className="flex-1 px-3 py-2 rounded-xl bg-[var(--bg-body)] border border-[var(--border)] text-sm font-semibold text-[var(--text-main)] outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateDueDate}
                          disabled={
                            !canEditActiveTaskDueDate ||
                            isUpdatingDueDate ||
                            taskDueDateDraft === activeTaskDueDateInputValue
                          }
                          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={canEditActiveTaskDueDate ? 'Salvar data' : 'Apenas o criador pode alterar'}
                        >
                          {isUpdatingDueDate ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                      {!canEditActiveTaskDueDate && (
                        <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                          Apenas o criador da tarefa pode alterar.
                        </div>
                      )}
                      {dueDateError && (
                        <div className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
                          {dueDateError}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2 flex items-center justify-between">
                        Responsáveis
                        <button
                          type="button"
                          onClick={openTaskShareModal}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                          title={canShareActiveTask ? 'Compartilhar/Remover' : 'Apenas o criador pode compartilhar'}
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
                            const ownerId = activeTask?.created_by;
                            const canRemove =
                              (ownerId ? uid !== ownerId : true) && (ownerId === profileId || uid === profileId);
                            return (
                              <div
                                key={uid}
                                className="flex items-center gap-2 bg-[var(--bg-body)] px-3 py-1.5 rounded-xl border border-[var(--border)]"
                              >
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
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] block mb-2">Anexos</label>

                      <div className="space-y-2 mb-3">
                        {taskAttachments.map(att => (
                          <div
                            key={att.id}
                            className="group flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-body)] border border-[var(--border)] hover:border-cyan-500/30 transition-colors"
                          >
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <div className="p-1.5 rounded bg-[var(--bg-panel)] text-cyan-400">
                                <Paperclip size={12} />
                              </div>
                              <span className="text-xs font-medium truncate">{att.file_name}</span>
                            </a>

                            <a
                              href={att.file_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--text-muted)] hover:text-cyan-400 p-1 transition-colors"
                              title="Baixar"
                            >
                              <Download size={12} />
                            </a>

                            {(att.created_by === profileId || activeTask?.created_by === profileId) && (
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

          <div className="bg-[var(--bg-panel)] lg:border-l border-[var(--border)]">
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-[var(--border)] bg-[var(--bg-body)]/50">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--text-soft)]">
                <MessageCircle size={14} /> Comentários
              </h4>
            </div>

            <div className="px-5 py-5 md:px-6 md:py-6 space-y-6 pb-28">
              {timelineItems.map((item: any) => {
                if (item.kind === 'activity') {
                  return (
                    <div
                      key={`${item.kind}:${item.id}`}
                      className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"></div>
                      </div>
                      <div className="space-y-0.5 pt-1.5">
                        <div className="text-[11px] text-[var(--text-muted)]">
                          <span className="font-bold text-[var(--text-soft)]">{item.user_nome}</span>{' '}
                          {item.type === 'status_changed' &&
                            (String(item.details || '')
                              .trim()
                              .toLowerCase()
                              .startsWith('de ')
                              ? 'moveu'
                              : 'moveu para')}
                          {item.type === 'task_created' && 'criou a tarefa'}
                          {item.type === 'attachment_added' && ''}
                          {item.type === 'attachment_deleted' && ''}
                          {item.type === 'description_updated' && 'atualizou a descrição'}{' '}
                          {item.type === 'assignees_updated' && 'atualizou responsáveis'}{' '}
                          {item.type === 'due_date_updated' && 'atualizou a data de entrega'}{' '}
                          <span className="italic">{item.details}</span>
                        </div>
                        <div className="text-[9px] text-[var(--text-muted)] opacity-70">
                          {isValid(new Date(item.created_at))
                            ? format(new Date(item.created_at), 'd MMM, HH:mm', { locale: ptBR })
                            : ''}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={`${item.kind}:${item.id}`} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-[10px] font-black shrink-0 border border-cyan-500/20 mt-1">
                      {item.user_nome ? item.user_nome.substring(0, 2).toUpperCase() : 'U'}
                    </div>
                    <div className="space-y-1.5 max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-main)]">{item.user_nome}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {(() => {
                            const d = new Date(item.created_at);
                            return isValid(d) ? format(d, 'd MMM, HH:mm', { locale: ptBR }) : '';
                          })()}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-main)] bg-[var(--bg-body)] border border-[var(--border)] p-3 rounded-2xl rounded-tl-none shadow-sm leading-relaxed whitespace-pre-wrap">
                        {item.content}
                      </div>
                    </div>
                  </div>
                );
              })}

              {timelineItems.length === 0 && (
                <div className="flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50 gap-3 py-10">
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-body)] flex items-center justify-center border border-[var(--border)]">
                    <MessageCircle size={24} />
                  </div>
                  <p className="text-xs">Nenhum comentário ou atividade.</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 px-5 py-4 md:px-6 bg-[var(--bg-body)]/95 backdrop-blur border-t border-[var(--border)]">
              <div className="space-y-2">
                {commentError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-200">
                    {commentError}
                  </div>
                )}
                <div className="relative">
                  <input
                    value={newComment}
                    onChange={e => {
                      setNewComment(e.target.value);
                      if (commentError) setCommentError(null);
                    }}
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
      </Modal>

      {/* Modal: Confirmar Deleção */}
      <Modal
        isOpen={!!activeTaskId && isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Trash2 size={18} />
            </div>
            Deletar tarefa
          </div>
        }
        size="sm"
        footer={
          <>
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
          </>
        }
      >
        <div className="space-y-4">
              <p className="text-sm text-[var(--text-soft)]">
                Essa ação não pode ser desfeita. A tarefa e seus dados relacionados serão removidos.
              </p>
              {deleteError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                  {deleteError}
                </div>
              )}
        </div>
      </Modal>
    </div>
  );
};

export default TaskFlow;
