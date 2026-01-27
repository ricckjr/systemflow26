import { supabase } from '@/services/supabase'
import { Post, Recognition } from '@/types'

const sb = supabase as any

export type InstaFlowReaction = string

export interface InstaFlowReactionSummary {
  counts: Record<string, number>
  myReaction: string | null
  total: number
}

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

  let query = sb
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
        nome,
        avatar_url
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

  const postIds = data.map(p => p.id)

  const mediaMap: Record<string, { url: string; type?: string | null }[]> = {}
  if (postIds.length > 0) {
    const { data: media } = await sb
      .from('instaflow_media')
      .select('post_id, url, type, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })

    for (const m of media || []) {
      if (!mediaMap[m.post_id]) mediaMap[m.post_id] = []
      mediaMap[m.post_id].push({ url: m.url, type: m.type })
    }
  }

  const reactionMap: Record<string, InstaFlowReactionSummary> = {}
  if (postIds.length > 0) {
    const res = await sb
      .from('instaflow_likes')
      .select('post_id, created_by, reaction')
      .in('post_id', postIds)

    if (!res.error && res.data) {
      for (const r of res.data) {
        const postId = r.post_id as string
        if (!reactionMap[postId]) reactionMap[postId] = { counts: {}, myReaction: null, total: 0 }
        const reaction = (r.reaction || '❤️') as string
        reactionMap[postId].counts[reaction] = (reactionMap[postId].counts[reaction] || 0) + 1
        reactionMap[postId].total += 1
        if (params?.userId && r.created_by === params.userId) reactionMap[postId].myReaction = reaction
      }
    } else if (params?.userId) {
      const { data: likes } = await sb
        .from('instaflow_likes')
        .select('post_id')
        .eq('created_by', params.userId)
        .in('post_id', postIds)

      for (const pId of postIds) {
        reactionMap[pId] = { counts: {}, myReaction: null, total: 0 }
      }

      for (const l of likes || []) {
        const postId = l.post_id as string
        reactionMap[postId].myReaction = '❤️'
      }
    }
  }

  const items: Post[] = data.map(p => ({
    id: p.id,
    usuario_id: p.created_by,
    usuario_nome: p.profiles?.nome ?? 'Usuário',
    usuario_avatar_url: p.profiles?.avatar_url ?? null,
    content: p.content,
    image_url: p.media_url ?? undefined,
    media: (mediaMap[p.id] && mediaMap[p.id].length > 0)
      ? mediaMap[p.id].map(m => m.url)
      : (p.media_url ? [p.media_url] : []),
    reactions: reactionMap[p.id]?.counts,
    my_reaction: reactionMap[p.id]?.myReaction ?? null,
    likes: p.likes_count ?? 0,
    comments_count: p.comments_count ?? 0,
    created_at: p.created_at,
    liked_by_me: !!reactionMap[p.id]?.myReaction
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

  const { data, error } = await sb
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
      created_by,
      profiles:created_by (
        nome,
        avatar_url
      )
    `)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    usuario_id: data.created_by,
    usuario_nome: data.profiles?.nome ?? '',
    usuario_avatar_url: data.profiles?.avatar_url ?? null,
    content: data.content,
    image_url: data.media_url ?? undefined,
    media: data.media_url ? [data.media_url] : [],
    likes: data.likes_count ?? 0,
    comments_count: data.comments_count ?? 0,
    created_at: data.created_at,
    liked_by_me: false
  }
}

export async function createPostWithMedia(
  content: string,
  userId: string,
  media: { url: string; type?: string | null }[]
): Promise<Post | null> {
  const primary = media[0]?.url ?? null
  const created = await createPost(content, userId, primary)
  if (!created) return null

  if (media.length > 0) {
    await sb
      .from('instaflow_media')
      .insert(media.map(m => ({
        post_id: created.id,
        url: m.url,
        type: m.type ?? null,
        created_by: userId
      })))
  }

  return {
    ...created,
    media: media.map(m => m.url)
  }
}

export async function editPost(
  postId: string,
  userId: string,
  payload: { content?: string; media_url?: string | null }
) {
  const { data, error } = await sb
    .from('instaflow_posts')
    .update(payload)
    .eq('id', postId)
    .select('*')
    .single()

  if (error) return null
  return data
}

export async function deletePost(postId: string, userId: string) {
  return !(await sb
    .from('instaflow_posts')
    .delete()
    .eq('id', postId)
  ).error
}

/* ======================================================
   LIKES
====================================================== */
export async function likePost(postId: string, userId: string) {
  return !(await sb
    .from('instaflow_likes')
    .upsert({ post_id: postId, created_by: userId, reaction: '❤️' }, { onConflict: 'post_id,created_by', ignoreDuplicates: true })
  ).error
}

export async function unlikePost(postId: string, userId: string) {
  return !(await sb
    .from('instaflow_likes')
    .delete()
    .eq('post_id', postId)
    .eq('created_by', userId)
  ).error
}

export async function setReaction(postId: string, userId: string, reaction: InstaFlowReaction | null) {
  if (!reaction) return unlikePost(postId, userId)
  const res = await sb
    .from('instaflow_likes')
    .upsert({ post_id: postId, created_by: userId, reaction }, { onConflict: 'post_id,created_by' })
  if (!res.error) return true

  const del = await sb
    .from('instaflow_likes')
    .delete()
    .eq('post_id', postId)
    .eq('created_by', userId)
  if (del.error) return reaction === '❤️' ? likePost(postId, userId) : false

  const ins = await sb
    .from('instaflow_likes')
    .insert({ post_id: postId, created_by: userId, reaction })
  if (ins.error) return reaction === '❤️' ? likePost(postId, userId) : false

  return true
}

export async function fetchReactions(postId: string) {
  const base = await sb
    .from('instaflow_likes')
    .select('reaction, created_by, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200)

  const fallback = (!base.error && base.data)
    ? base
    : await sb
      .from('instaflow_likes')
      .select('created_by, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(200)

  if (fallback.error || !fallback.data || fallback.data.length === 0) return []

  const userIds = Array.from(new Set((fallback.data || []).map((r: any) => r.created_by).filter(Boolean)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, nome, avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries(
    (profiles || []).map((p: any) => [p.id, p])
  ) as Record<string, { nome?: string | null; avatar_url?: string | null }>

  return (fallback.data || []).map((r: any) => ({
    reaction: ((r.reaction as string) || '❤️') as string,
    user_id: r.created_by as string,
    usuario_nome: profileMap[r.created_by]?.nome ?? 'Usuário',
    usuario_avatar_url: profileMap[r.created_by]?.avatar_url ?? null
  }))
}

export async function fetchReactionSummary(postId: string, userId?: string | null): Promise<InstaFlowReactionSummary> {
  const res = await sb
    .from('instaflow_likes')
    .select('created_by, reaction')
    .eq('post_id', postId)

  const summary: InstaFlowReactionSummary = { counts: {}, myReaction: null, total: 0 }
  if (res.error || !res.data) {
    const fallback = await sb
      .from('instaflow_likes')
      .select('created_by')
      .eq('post_id', postId)
    if (fallback.error || !fallback.data) return summary
    for (const r of fallback.data) {
      const reaction = '❤️'
      summary.counts[reaction] = (summary.counts[reaction] || 0) + 1
      summary.total += 1
      if (userId && r.created_by === userId) summary.myReaction = reaction
    }
    return summary
  }

  for (const r of res.data) {
    const reaction = (r.reaction || '❤️') as string
    summary.counts[reaction] = (summary.counts[reaction] || 0) + 1
    summary.total += 1
    if (userId && r.created_by === userId) summary.myReaction = reaction
  }
  return summary
}

export async function fetchPostById(postId: string, userId?: string | null): Promise<Post | null> {
  const { data, error } = await sb
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
        nome,
        avatar_url
      )
    `)
    .eq('id', postId)
    .maybeSingle()

  if (error || !data) return null

  const { data: mediaRows } = await sb
    .from('instaflow_media')
    .select('url, type, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  const media = (mediaRows || []).map(m => m.url as string)
  const reactions = await fetchReactionSummary(postId, userId ?? null)

  return {
    id: data.id,
    usuario_id: data.created_by,
    usuario_nome: data.profiles?.nome ?? 'Usuário',
    usuario_avatar_url: data.profiles?.avatar_url ?? null,
    content: data.content,
    image_url: data.media_url ?? undefined,
    media: media.length > 0 ? media : (data.media_url ? [data.media_url] : []),
    reactions: reactions.counts,
    my_reaction: reactions.myReaction,
    likes: data.likes_count ?? reactions.total ?? 0,
    comments_count: data.comments_count ?? 0,
    created_at: data.created_at,
    liked_by_me: !!reactions.myReaction
  }
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

  const base = await sb
    .from('instaflow_comments')
    .select('id, content, created_at, created_by, parent_id, mention_user_ids')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .range(from, to)

  const fallback = (!base.error && base.data)
    ? base
    : await sb
      .from('instaflow_comments')
      .select('id, content, created_at, created_by')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(from, to)

  if (fallback.error || !fallback.data || fallback.data.length === 0) return []

  const userIds = Array.from(new Set(fallback.data.map(c => c.created_by).filter(Boolean)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, nome, avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries(
    (profiles || []).map(p => [p.id, p])
  ) as Record<string, { nome?: string | null; avatar_url?: string | null }>

  return fallback.data.map(c => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    created_by: c.created_by,
    parent_id: c.parent_id ?? null,
    mention_user_ids: c.mention_user_ids ?? [],
    usuario_nome: profileMap[c.created_by]?.nome ?? 'Usuário',
    usuario_avatar_url: profileMap[c.created_by]?.avatar_url ?? null
  }))
}

export async function addComment(
  postId: string,
  userId: string,
  content: string,
  opts?: { parent_id?: string | null; mention_user_ids?: string[] }
) {
  const attempt = await sb
    .from('instaflow_comments')
    .insert({
      post_id: postId,
      content,
      created_by: userId,
      parent_id: opts?.parent_id ?? null,
      mention_user_ids: opts?.mention_user_ids ?? []
    })
    .select('id, content, created_at, created_by, parent_id, mention_user_ids')
    .single()

  const fallback = (!attempt.error && attempt.data)
    ? attempt
    : await sb
      .from('instaflow_comments')
      .insert({ post_id: postId, content, created_by: userId })
      .select('id, content, created_at, created_by')
      .single()

  if (fallback.error || !fallback.data) return null

  const { data: p } = await sb
    .from('profiles')
    .select('nome, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  return {
    id: fallback.data.id,
    content: fallback.data.content,
    created_at: fallback.data.created_at,
    created_by: fallback.data.created_by,
    parent_id: fallback.data.parent_id ?? null,
    mention_user_ids: fallback.data.mention_user_ids ?? [],
    usuario_nome: p?.nome ?? 'Usuário',
    usuario_avatar_url: p?.avatar_url ?? null
  }
}

export async function editComment(
  commentId: string,
  userId: string,
  content: string
) {
  const attempt = await sb
    .from('instaflow_comments')
    .update({ content })
    .eq('id', commentId)
    .eq('created_by', userId)
    .select('id, content, created_at, created_by, parent_id, mention_user_ids')
    .single()

  const fallback = (!attempt.error && attempt.data)
    ? attempt
    : await sb
      .from('instaflow_comments')
      .update({ content })
      .eq('id', commentId)
      .eq('created_by', userId)
      .select('id, content, created_at, created_by')
      .single()

  if (fallback.error || !fallback.data) return null

  const { data: p } = await sb
    .from('profiles')
    .select('nome, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  return {
    id: fallback.data.id,
    content: fallback.data.content,
    created_at: fallback.data.created_at,
    created_by: fallback.data.created_by,
    parent_id: fallback.data.parent_id ?? null,
    mention_user_ids: fallback.data.mention_user_ids ?? [],
    usuario_nome: p?.nome ?? 'Usuário',
    usuario_avatar_url: p?.avatar_url ?? null
  }
}

export async function deleteComment(commentId: string, userId: string) {
  return !(await sb
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
  const { data, error } = await sb
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
