import { supabase } from '@/services/supabase'
import { Post, Recognition } from '@/types'

/* ======================================================
   FEED (OTIMIZADO – 1 QUERY + 1 BATCH DE LIKES)
====================================================== */
export async function fetchFeed(params?: {
  page?: number
  pageSize?: number
  search?: string
  userId?: string
}): Promise<{ items: Post[]; total: number }> {

  const page = Math.max(1, params?.page ?? 1)
  const size = Math.min(20, Math.max(1, params?.pageSize ?? 10))
  const from = (page - 1) * size
  const to = from + size - 1

  let query = supabase
    .from('instaflow_posts')
    .select(`
      id,
      content,
      media_url,
      created_at,
      likes_count,
      comments_count,
      created_by,
      profiles:created_by (
        nome
      )
    `, { count: 'estimated' }) // 🔥 muito mais rápido que exact
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params?.search?.trim()) {
    query = query.ilike('content', `%${params.search.trim()}%`)
  }

  const { data, count, error } = await query
  if (error || !data) {
    return { items: [], total: 0 }
  }

  /* ===== Batch de likes do usuário (elimina N+1) ===== */
  let likedMap: Record<string, boolean> = {}

  if (params?.userId && data.length > 0) {
    const postIds = data.map(p => p.id)

    const { data: likes } = await supabase
      .from('instaflow_likes')
      .select('post_id')
      .eq('created_by', params.userId)
      .in('post_id', postIds)

    likedMap = Object.fromEntries(
      (likes || []).map(l => [l.post_id, true])
    )
  }

  const items: Post[] = data.map(p => ({
    id: p.id,
    usuario_id: p.created_by,
    usuario_nome: p.profiles?.nome ?? 'Usuário',
    content: p.content,
    image_url: p.media_url ?? undefined,
    likes: p.likes_count ?? 0,
    comments_count: p.comments_count ?? 0,
    created_at: p.created_at,
    liked_by_me: !!likedMap[p.id]
  }))

  return {
    items,
    total: count ?? items.length
  }
}

/* ======================================================
   UPLOAD DE MÍDIA (SEGURANÇA + NOME LIMPO)
====================================================== */
const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/ogg'
]

const MAX_MB = 50

export async function uploadMedia(
  file: File,
  userId: string
): Promise<string | null> {

  if (!ALLOWED_MIME.includes(file.type)) return null
  if (file.size > MAX_MB * 1024 * 1024) return null

  const ext = file.name.split('.').pop()
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase
    .storage
    .from('instaflow')
    .upload(path, file, { upsert: false })

  if (error) return null

  return supabase
    .storage
    .from('instaflow')
    .getPublicUrl(path)
    .data
    .publicUrl
}

/* ======================================================
   POSTS
====================================================== */
export async function createPost(
  content: string,
  userId: string,
  mediaUrl?: string | null
): Promise<Post | null> {

  const { data, error } = await supabase
    .from('instaflow_posts')
    .insert({
      content,
      media_url: mediaUrl ?? null,
      created_by: userId
    })
    .select(`
      id,
      content,
      media_url,
      created_at,
      likes_count,
      comments_count,
      created_by
    `)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    usuario_id: data.created_by,
    usuario_nome: '',
    content: data.content,
    image_url: data.media_url ?? undefined,
    likes: data.likes_count ?? 0,
    comments_count: data.comments_count ?? 0,
    created_at: data.created_at,
    liked_by_me: false
  }
}

export async function editPost(
  postId: string,
  userId: string,
  payload: { content?: string; media_url?: string | null }
) {
  const { data, error } = await supabase
    .from('instaflow_posts')
    .update(payload)
    .eq('id', postId)
    .eq('created_by', userId)
    .select('*')
    .single()

  if (error) return null
  return data
}

export async function deletePost(postId: string, userId: string) {
  return !(await supabase
    .from('instaflow_posts')
    .delete()
    .eq('id', postId)
    .eq('created_by', userId)
  ).error
}

/* ======================================================
   LIKES
====================================================== */
export async function likePost(postId: string, userId: string) {
  return !(await supabase
    .from('instaflow_likes')
    .insert({ post_id: postId, created_by: userId })
  ).error
}

export async function unlikePost(postId: string, userId: string) {
  return !(await supabase
    .from('instaflow_likes')
    .delete()
    .eq('post_id', postId)
    .eq('created_by', userId)
  ).error
}

/* ======================================================
   COMENTÁRIOS (COM PAGINAÇÃO)
====================================================== */
export async function fetchComments(
  postId: string,
  page = 1,
  pageSize = 10
) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data } = await supabase
    .from('instaflow_comments')
    .select('id, content, created_at, created_by')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .range(from, to)

  return data || []
}

export async function addComment(
  postId: string,
  userId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('instaflow_comments')
    .insert({ post_id: postId, content, created_by: userId })
    .select('*')
    .single()

  if (error) return null
  return data
}

export async function editComment(
  commentId: string,
  userId: string,
  content: string
) {
  const { data, error } = await supabase
    .from('instaflow_comments')
    .update({ content })
    .eq('id', commentId)
    .eq('created_by', userId)
    .select('*')
    .single()

  if (error) return null
  return data
}

export async function deleteComment(commentId: string, userId: string) {
  return !(await supabase
    .from('instaflow_comments')
    .delete()
    .eq('id', commentId)
    .eq('created_by', userId)
  ).error
}

/* ======================================================
   RECOGNITIONS (ENXUTO)
====================================================== */
export async function fetchRecognitions(): Promise<Recognition[]> {
  const { data, error } = await supabase
    .from('instaflow_recognitions')
    .select(`
      id,
      title,
      description,
      user_id,
      created_by,
      created_at,
      profiles:user_id (
        nome
      )
    `)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map(r => ({
    id: r.id,
    title: r.title,
    description: r.description,
    user_id: r.user_id,
    user_nome: r.profiles?.nome ?? 'Desconhecido',
    created_by: r.created_by,
    created_at: r.created_at
  }))
}
