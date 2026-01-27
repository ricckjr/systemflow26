import { supabase } from '@/services/supabase';
import { Profile, CalendarEvent, Notification } from '@/types';

export type TFBoard = { id: string; name: string; created_at: string; created_by: string; company_id?: string | null };
export type TFColumn = { id: string; board_id: string; name: string; order_index: number; created_at: string; created_by: string };
export type TFTask = {
  id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  // Added for compatibility with new features
  files?: { name: string; url: string; type: string }[];
  // Enriched fields from unified views/joins (UI-only)
  original_column_name?: string;
  owner_avatar?: string;
  owner_name?: string;
  comments_count?: number;
  assignees_list?: { id: string; nome: string; avatar_url?: string }[];
  last_activity_at?: string;
  last_seen_at?: string;
};

export type TFTaskSeen = { task_id: string; user_id: string; last_seen_at: string };
export type TFTaskUser = { id: string; task_id: string; user_id: string; role: 'assignee' | 'viewer'; created_at: string };
export type TFComment = { id: string; task_id: string; user_id: string; content: string; created_at: string };
export type TFActivity = { id: string; task_id: string; type: string; details?: string; user_id: string; created_at: string };

const REQUIRED_COLUMNS = [
  { name: 'ENTRADA', order_index: 0 },
  { name: 'EM ANÁLISE', order_index: 1 },
  { name: 'PENDENTE', order_index: 2 },
  { name: 'EM ANDAMENTO', order_index: 3 },
  { name: 'CONCLUÍDO', order_index: 4 },
];

import { api } from '@/services/api';

export async function ensureDefaultBoard(user: Profile): Promise<{ board: TFBoard; columns: TFColumn[] }> {
  // 1. Get or Create Board
  let { data: board } = await supabase
    .from('taskflow_boards')
    .select('*')
    .eq('created_by', user.id)
    .limit(1)
    .single();

  if (!board) {
    try {
        // 1. Insert without returning
        const { error: insertError } = await supabase
          .from('taskflow_boards')
          .insert([{ name: 'Meu Board', created_by: user.id }]);
        
        if (insertError) throw insertError;

        // 2. Fetch separately (sometimes RLS allows insert but requires separate select call context)
        const { data: created } = await supabase
          .from('taskflow_boards')
          .select('*')
          .eq('created_by', user.id)
          .limit(1)
          .single();
          
        board = created;
    } catch (e) {
        // Fallback: Tenta criar via backend se falhar por RLS
        try {
            console.warn('Falha ao criar board localmente, tentando via backend...', e);
            const res = await api.taskflow.fixBoard();
            board = res.board;
        } catch (backendErr) {
            console.error('Falha crítica ao criar board via backend:', backendErr);
        }
    }
  }

  if (!board) {
     // Última tentativa: Busca novamente caso o backend tenha criado mas não retornado corretamente (race condition)
     const { data: retry } = await supabase
        .from('taskflow_boards')
        .select('*')
        .eq('created_by', user.id)
        .limit(1)
        .single();
     board = retry;
  }

  if (!board) {
    throw new Error('Falha ao obter ou criar o board padrão.');
  }

  // 2. Get existing columns
  const { data: existingColumns } = await supabase
    .from('taskflow_columns')
    .select('*')
    .eq('board_id', board.id)
    .order('order_index', { ascending: true });

  // 3. Check if we need to migrate/create columns to match the new 6-column structure
  const currentCols = existingColumns || [];
  
  if (currentCols.length === 0) {
    // Create all
    const newCols = REQUIRED_COLUMNS.map(c => ({ ...c, board_id: board.id, created_by: user.id }));
    const { data: cols } = await supabase
      .from('taskflow_columns')
      .upsert(newCols, { onConflict: 'board_id, name', ignoreDuplicates: true })
      .select('*');
    return { board, columns: cols || [] };
  } 
  
  // If we have columns but maybe old names, we just return what we have to avoid destroying data.
  const hasOldDefault = currentCols.some(c => c.name === 'Backlog');
  if (hasOldDefault) {
     // Rename logic could go here, but for now let's just delete and recreate to enforce the requested structure (DANGEROUS in prod, okay for prototype)
  }

  return { board, columns: currentCols };
}

export async function fetchBoards(): Promise<TFBoard[]> {
  const { data, error } = await supabase
    .from('taskflow_boards')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    const details = error.details ? ` | ${error.details}` : '';
    const hint = error.hint ? ` | ${error.hint}` : '';
    throw new Error(`${error.message}${details}${hint}`);
  }
  return data || [];
}

export async function fetchBoardData(boardId: string) {
  const { data: columns } = await supabase
    .from('taskflow_columns')
    .select('*')
    .eq('board_id', boardId)
    .order('order_index', { ascending: true });
  return { columns: columns || [], tasks: [] };
}

export async function createTask(boardId: string, columnId: string, title: string, description: string, userId: string, priority: string = 'medium', dueDate: string | null = null) {
  const { data, error } = await supabase
    .from('taskflow_tasks')
    .insert([{ 
      board_id: boardId, 
      column_id: columnId, 
      title, 
      description,
      priority, 
      due_date: dueDate,
      created_by: userId 
    }])
    .select('*')
    .single();
  if (error || !data) {
    const details = error?.details ? ` | ${error.details}` : '';
    const hint = error?.hint ? ` | ${error.hint}` : '';
    throw new Error(`${error?.message || 'Falha ao criar tarefa'}${details}${hint}`);
  }
  return data as TFTask;
}

export async function moveTask(taskId: string, toColumnId: string) {
  const { data } = await supabase
    .from('taskflow_tasks')
    .update({ column_id: toColumnId, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('*')
    .single();
  return data;
}

export async function moveTaskToColumnName(taskId: string, toColumnName: string) {
  try {
    const { data, error } = await (supabase as any).rpc('tf_move_task_to_column_name', {
      p_task_id: taskId,
      p_to_column_name: toColumnName
    });
    if (error) throw error;
    return data as TFTask;
  } catch (rpcErr: any) {
    const rpcCode = rpcErr?.code;
    const rpcMessage = String(rpcErr?.message || '');
    const isMissingRpc =
      rpcCode === 'PGRST202' ||
      rpcMessage.toLowerCase().includes('tf_move_task_to_column_name') ||
      rpcMessage.toLowerCase().includes('could not find the function');

    if (!isMissingRpc) {
      const details = rpcErr?.details ? ` | ${rpcErr.details}` : '';
      const hint = rpcErr?.hint ? ` | ${rpcErr.hint}` : '';
      throw new Error(`${rpcErr?.message || 'Falha ao mover tarefa'}${details}${hint}`);
    }

    const { data: taskRow, error: taskErr } = await supabase
      .from('taskflow_tasks')
      .select('board_id')
      .eq('id', taskId)
      .single();
    if (taskErr || !taskRow?.board_id) {
      const details = taskErr?.details ? ` | ${taskErr.details}` : '';
      const hint = taskErr?.hint ? ` | ${taskErr.hint}` : '';
      throw new Error(`${taskErr?.message || 'Falha ao carregar board da tarefa'}${details}${hint}`);
    }

    const { data: colRow, error: colErr } = await supabase
      .from('taskflow_columns')
      .select('id')
      .eq('board_id', taskRow.board_id)
      .ilike('name', toColumnName)
      .order('order_index', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (colErr) {
      const details = colErr?.details ? ` | ${colErr.details}` : '';
      const hint = colErr?.hint ? ` | ${colErr.hint}` : '';
      throw new Error(`${colErr?.message || 'Falha ao localizar coluna no board da tarefa'}${details}${hint}`);
    }
    if (!colRow?.id) throw new Error('Coluna de destino não existe no board da tarefa');

    const { data, error: updErr } = await supabase
      .from('taskflow_tasks')
      .update({ column_id: colRow.id, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();
    if (updErr) {
      const details = updErr?.details ? ` | ${updErr.details}` : '';
      const hint = updErr?.hint ? ` | ${updErr.hint}` : '';
      throw new Error(`${updErr?.message || 'Falha ao mover tarefa'}${details}${hint}`);
    }
    return data as TFTask;
  }
}

export async function assignUsers(taskId: string, userIds: string[]) {
  // Delete all (simple sync)
  const { error: deleteError } = await supabase.from('taskflow_task_users').delete().eq('task_id', taskId);
  if (deleteError) {
    const details = deleteError.details ? ` | ${deleteError.details}` : '';
    const hint = deleteError.hint ? ` | ${deleteError.hint}` : '';
    throw new Error(`${deleteError.message}${details}${hint}`);
  }
  
  if (userIds.length === 0) return [];

  const rows = userIds.map(uid => ({ task_id: taskId, user_id: uid, role: 'assignee' }));
  const { data, error: insertError } = await supabase.from('taskflow_task_users').insert(rows).select('*');
  if (insertError) {
    const details = insertError.details ? ` | ${insertError.details}` : '';
    const hint = insertError.hint ? ` | ${insertError.hint}` : '';
    throw new Error(`${insertError.message}${details}${hint}`);
  }

  return data || [];
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('taskflow_tasks').delete().eq('id', taskId);
  if (error) {
    const details = error.details ? ` | ${error.details}` : '';
    const hint = error.hint ? ` | ${error.hint}` : '';
    throw new Error(`${error.message}${details}${hint}`);
  }
  return true;
}

export async function addComment(taskId: string, userId: string, content: string): Promise<TFComment> {
  const { data, error } = await supabase
    .from('taskflow_comments')
    .insert([{ task_id: taskId, user_id: userId, content }])
    .select('*')
    .single();
  if (error || !data) {
    const details = error?.details ? ` | ${error.details}` : '';
    const hint = error?.hint ? ` | ${error.hint}` : '';
    throw new Error(`${error?.message || 'Falha ao adicionar comentário'}${details}${hint}`);
  }
  return data;
}

export async function fetchUnifiedTasks(search?: string) {
  // 1. Busca todas as tarefas que o usuário tem acesso (RLS já filtra)
  // Join com taskflow_columns para saber o nome da coluna original (status)
  // Join com profiles para saber quem criou (dono)
  let q = supabase
    .from('taskflow_tasks')
    .select(`
      *,
      column:taskflow_columns(name),
      owner:profiles!created_by(id, nome, avatar_url),
      assignees:taskflow_task_users(
        user_id,
        profiles:user_id(id, nome, avatar_url)
      ),
      comments:taskflow_comments(count)
    `)
    .order('created_at', { ascending: true });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`title.ilike.${term},description.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) {
    console.error('Error fetching unified tasks:', error);
    return [];
  }

  return (data || []).map((t: any) => {
    const owner = Array.isArray(t.owner) ? t.owner[0] : t.owner;
    const column = Array.isArray(t.column) ? t.column[0] : t.column;
    return {
      ...t,
      original_column_name: column?.name,
      owner_avatar: owner?.avatar_url,
      owner_name: owner?.nome,
      comments_count: t.comments?.[0]?.count || 0,
      assignees_list:
        t.assignees?.map((a: any) => ({
          id: a.profiles?.id,
          nome: a.profiles?.nome,
          avatar_url: a.profiles?.avatar_url
        })) || [],
      last_activity_at: t.last_activity_at || t.updated_at || t.created_at
    };
  });
}

export async function fetchTaskSeen(userId: string, taskIds: string[]) {
  if (!userId) return new Map<string, string>();
  try {
    let query = (supabase as any)
      .from('taskflow_task_seen')
      .select('task_id,last_seen_at')
      .eq('user_id', userId);

    // Optimization: If taskIds is small, filter. If large, fetch all for user (usually faster than sending huge query string)
    if (taskIds.length > 0 && taskIds.length < 200) {
      query = query.in('task_id', taskIds);
    }

    const { data, error } = await query;
    if (error) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const row of data || []) map.set((row as any).task_id, (row as any).last_seen_at);
    return map;
  } catch {
    return new Map<string, string>();
  }
}

export async function markTaskSeen(taskId: string) {
  if (!taskId) return;
  try {
    const { error } = await (supabase as any).rpc('tf_mark_task_seen', { p_task_id: taskId });
    if (error) throw error;
  } catch {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const userId = user?.id;
      if (!userId) return;
      await (supabase as any)
        .from('taskflow_task_seen')
        .upsert([{ task_id: taskId, user_id: userId, last_seen_at: new Date().toISOString() }], { onConflict: 'task_id,user_id' });
    } catch {
      return;
    }
  }
}

export async function fetchComments(taskId: string) {
  const { data, error } = await supabase
    .from('taskflow_comments')
    .select(`
      *,
      profiles:user_id (
        nome,
        avatar_url
      )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
    
  // Map to include user info
  return (data || []).map((c: any) => ({
    ...c,
    user_nome: c.profiles?.nome || 'Usuário',
    user_avatar: c.profiles?.avatar_url
  }));
}

export async function logActivity(taskId: string, userId: string, type: string, details?: string) {
  const { error } = await supabase.from('taskflow_activity_log').insert([{ task_id: taskId, user_id: userId, type, details }]);
  if (error) console.error('Error logging activity:', error);
}

export async function fetchActivityLog(taskId: string) {
  const { data, error } = await supabase
    .from('taskflow_activity_log')
    .select(`
      *,
      profiles:user_id (
        nome,
        avatar_url
      )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }

  return (data || []).map((log: any) => ({
    ...log,
    user_nome: log.profiles?.nome,
    user_avatar: log.profiles?.avatar_url
  }));
}

export async function fetchUsers() {
  const { data } = await supabase.from('profiles').select('id, nome, avatar_url').eq('ativo', true);
  return data || [];
}

// --- Notifications & Calendar Services ---

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data || []).map((n: any) => ({
    ...n,
    type: n.type as Notification['type']
  }));
}

export async function markNotificationAsRead(notificationId: string) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsAsRead(userId: string) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function fetchCalendarEvents(userId: string, start: string, end: string): Promise<CalendarEvent[]> {
  const { data } = await supabase
    .from('taskflow_calendar')
    .select('*')
    .eq('user_id', userId)
    .gte('start_at', start)
    .lte('end_at', end);
  return data || [];
}

export async function createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at'>) {
  const { data } = await supabase
    .from('taskflow_calendar')
    .insert([event])
    .select('*')
    .single();
  return data;
}

export async function uploadTaskAttachment(taskId: string, file: File, userId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${taskId}/${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  // 1. Upload to Supabase Storage
  // Assuming 'task-attachments' bucket exists. If not, this might fail unless we create it or use a different strategy.
  // For this environment, we'll try to upload to a standard bucket.
  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Upload error:', uploadError);
    // If bucket doesn't exist, we might need to handle it or instruct user.
    // For now, rethrow or return null
    throw uploadError;
  }

  // 2. Get Public URL
  const { data: { publicUrl } } = supabase.storage
    .from('task-attachments')
    .getPublicUrl(filePath);

  // 3. Create DB Record
  const { data } = await supabase
    .from('taskflow_attachments')
    .insert([{
      task_id: taskId,
      file_name: file.name,
      file_url: publicUrl,
      file_type: file.type,
      created_by: userId
    }])
    .select('*')
    .single();

  return data;
}

export async function fetchTaskAttachments(taskId: string) {
  const { data } = await supabase
    .from('taskflow_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function deleteTaskAttachment(attachmentId: string) {
  const { error } = await supabase
    .from('taskflow_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) {
    const details = error.details ? ` | ${error.details}` : '';
    const hint = error.hint ? ` | ${error.hint}` : '';
    throw new Error(`${error.message}${details}${hint}`);
  }
  return true;
}

export async function updateTask(taskId: string, updates: Partial<TFTask>) {
  const { data, error } = await supabase
    .from('taskflow_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) {
     const details = error.details ? ` | ${error.details}` : '';
     const hint = error.hint ? ` | ${error.hint}` : '';
     throw new Error(`${error.message}${details}${hint}`);
  }
  return data;
}

export async function fetchTaskAssignees(taskId: string) {
  const { data } = await supabase
    .from('taskflow_task_users')
    .select(`
      user_id,
      role,
      profiles:user_id (
        id,
        nome,
        avatar_url
      )
    `)
    .eq('task_id', taskId);
    
  return (data || []).map((d: any) => ({
    user_id: d.user_id,
    role: d.role,
    ...d.profiles
  }));
}

export async function fetchTaskDetailsRPC(taskId: string) {
  const { data, error } = await supabase.rpc('tf_get_task_details' as any, { p_task_id: taskId } as any);
  if (error) {
    console.error('Error fetching task details via RPC:', error);
    return null;
  }

  if (!data) return null;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? (parsed as any) : null;
    } catch {
      return null;
    }
  }

  return typeof data === 'object' ? (data as any) : null;
}
