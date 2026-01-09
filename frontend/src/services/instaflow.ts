import { supabase } from '@/services/supabase';
import { Post, Recognition } from '@/types';

export async function fetchFeed(params?: { page?: number; pageSize?: number; search?: string }): Promise<{ items: Post[]; total: number }> {
  const page = Math.max(1, params?.page || 1)
  const size = Math.max(1, Math.min(100, params?.pageSize || 10))
  const from = (page - 1) * size
  const to = from + size - 1
  let q = supabase
    .from('instaflow_posts')
    .select(`
      *,
      profiles:created_by (
        nome
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (params?.search && params.search.trim()) {
    const term = `%${params.search.trim()}%`
    q = q.or(`content.ilike.${term}`)
  }
  const { data, error, count } = await q
  if (error) return { items: [], total: 0 }
  const items = (data || []).map(p => ({
    id: p.id,
    usuario_id: p.created_by,
    usuario_nome: p.profiles?.nome || 'Usuário',
    content: p.content,
    image_url: p.media_url || undefined,
    likes: p.likes_count || 0,
    comments_count: p.comments_count || 0,
    created_at: p.created_at,
  }))
  return { items, total: count || items.length }
}

const allowedMime = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/ogg'
];
const maxSizeMB = 50;

export async function uploadMedia(file: File, userId: string): Promise<string | null> {
  if (!allowedMime.includes(file.type)) return null;
  if (file.size > maxSizeMB * 1024 * 1024) return null;
  const path = `${userId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('instaflow').upload(path, file, { upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from('instaflow').getPublicUrl(path);
  return data.publicUrl || null;
}

export async function createPost(content: string, userId: string, mediaUrl?: string | null): Promise<Post | null> {
  const { data, error } = await supabase
    .from('instaflow_posts')
    .insert([{ content, media_url: mediaUrl || null, created_by: userId }])
    .select('*')
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    usuario_id: data.created_by,
    usuario_nome: '',
    content: data.content,
    image_url: data.media_url || undefined,
    likes: data.likes_count || 0,
    comments_count: data.comments_count || 0,
    created_at: data.created_at,
  };
}

export async function likePost(postId: string, userId: string) {
  const { error } = await supabase.from('instaflow_likes').insert([{ post_id: postId, created_by: userId }]);
  return !error;
}

export async function unlikePost(postId: string, userId: string) {
  const { error } = await supabase.from('instaflow_likes').delete().eq('post_id', postId).eq('created_by', userId);
  return !error;
}

export async function hasUserLiked(postId: string, userId: string) {
  const { data } = await supabase.from('instaflow_likes').select('id').eq('post_id', postId).eq('created_by', userId).limit(1);
  return (data || []).length > 0;
}

export async function fetchComments(postId: string) {
  const { data } = await supabase.from('instaflow_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  return data || [];
}

export async function addComment(postId: string, userId: string, content: string) {
  const { data, error } = await supabase.from('instaflow_comments').insert([{ post_id: postId, content, created_by: userId }]).select('*').single();
  if (error) return null;
  return data;
}

export async function editComment(commentId: string, userId: string, content: string) {
  const { data, error } = await supabase.from('instaflow_comments').update({ content }).eq('id', commentId).eq('created_by', userId).select('*').single();
  if (error) return null;
  return data;
}

export async function deleteComment(commentId: string, userId: string) {
  const { error } = await supabase.from('instaflow_comments').delete().eq('id', commentId).eq('created_by', userId);
  return !error;
}

export async function editPost(postId: string, userId: string, payload: { content?: string; media_url?: string | null }) {
  const { data, error } = await supabase.from('instaflow_posts').update(payload).eq('id', postId).eq('created_by', userId).select('*').single();
  if (error) return null;
  return data;
}

export async function deletePost(postId: string, userId: string) {
  const { error } = await supabase.from('instaflow_posts').delete().eq('id', postId).eq('created_by', userId);
  return !error;
}

export async function fetchRecognitions(): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('instaflow_recognitions')
    .select(`
      *,
      profiles:user_id (
        nome
      )
    `)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    user_id: r.user_id,
    user_nome: r.profiles?.nome || 'Desconhecido',
    created_by: r.created_by,
    created_at: r.created_at,
  }));
}
