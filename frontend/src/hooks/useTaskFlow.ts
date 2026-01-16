import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { 
  fetchUnifiedTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  moveTask, 
  TFTask 
} from '../services/taskflow';

export const TASKFLOW_KEYS = {
  all: ['taskflow'] as const,
  tasks: (boardId: string) => [...TASKFLOW_KEYS.all, 'tasks', boardId] as const,
  board: (boardId: string) => [...TASKFLOW_KEYS.all, 'board', boardId] as const,
};

export function useUnifiedTasks(boardId: string | undefined) {
  const { systemReady } = useAuth();
  return useQuery({
    queryKey: TASKFLOW_KEYS.tasks(boardId || 'default'),
    queryFn: () => boardId ? fetchUnifiedTasks(boardId) : Promise.resolve([]),
    enabled: systemReady && !!boardId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}

export function useTaskMutations(boardId: string) {
  const queryClient = useQueryClient();

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: TASKFLOW_KEYS.tasks(boardId) });
  };

  const createMutation = useMutation({
    mutationFn: (data: { boardId: string, columnId: string, title: string, description: string, userId: string, priority: string, dueDate: string | null }) => 
      createTask(data.boardId, data.columnId, data.title, data.description, data.userId, data.priority, data.dueDate),
    onSuccess: invalidateTasks,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { taskId: string, updates: Partial<TFTask> }) => 
      updateTask(data.taskId, data.updates),
    onSuccess: invalidateTasks,
  });

  const moveMutation = useMutation({
    mutationFn: (data: { taskId: string, toColumnId: string }) => 
      moveTask(data.taskId, data.toColumnId),
    onSuccess: invalidateTasks, // Note: Optimistic update is usually better for DnD, but this ensures consistency
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: invalidateTasks,
  });

  return {
    createTask: createMutation,
    updateTask: updateMutation,
    moveTask: moveMutation,
    deleteTask: deleteMutation,
  };
}
