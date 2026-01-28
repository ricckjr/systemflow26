
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Profile, Post, InstaFlowComment } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/services/supabase';
import { 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  Send, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  EyeOff, 
  Maximize2,
  X, 
  Check,
  Sparkles,
  Smile
} from 'lucide-react';
import { formatDateTimeBR } from '@/utils/datetime';
import { searchProfilesByName } from '@/services/profiles';
import { fetchFeed, fetchPostById, fetchReactionSummary, uploadMedia, createPostWithMedia, setReaction, fetchReactions, fetchComments, addComment, deletePost, editPost, setCommentReaction, type InstaFlowReaction } from '@/services/instaflow';
import { isInstaFlowSoundEnabled, playInstaFlowNewPostSound, setInstaFlowSoundEnabled } from '@/utils/instaflowSound';
import { NotificationPermissionBanner } from '@/components/notifications/NotificationPermissionBanner';
import { useNotificationPreferences } from '@/contexts/NotificationPreferencesContext';
import {
  dismissNotificationPromptForCooldown,
  requestBrowserNotificationPermission,
  shouldShowNotificationPermissionPrompt,
} from '@/utils/notificationPermission';

type MediaKind = 'image' | 'video';

const safeInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (a + b).toUpperCase();
};

const formatDateTime = (iso: string) => {
  return formatDateTimeBR(iso);
};

const isVideoUrl = (url: string) => /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);

const parseHashtags = (text: string) => {
  const tags = new Set<string>();
  const re = /(^|\s)#([\p{L}\d_]{2,32})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tags.add(`#${m[2]}`);
  }
  return Array.from(tags);
};

const renderRichText = (text: string, opts?: { onHashtagClick?: (tag: string) => void }) => {
  const parts: React.ReactNode[] = [];
  const re = /(^|\s)(#[\p{L}\d_]{2,32}|@[\p{L}\d_.-]{2,32})/gu;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const start = match.index;
    const full = match[0];
    const token = match[2];
    const prefix = full.slice(0, full.length - token.length);
    const tokenIndex = start + prefix.length;
    if (start > last) parts.push(text.slice(last, start));
    if (prefix) parts.push(prefix);
    if (token.startsWith('#')) {
      parts.push(
        <button
          key={`${tokenIndex}-${token}`}
          type="button"
          onClick={() => opts?.onHashtagClick?.(token)}
          className="text-cyan-500 hover:text-cyan-400 font-semibold"
        >
          {token}
        </button>
      );
    } else {
      parts.push(
        <span key={`${tokenIndex}-${token}`} className="text-amber-400 font-semibold">
          {token}
        </span>
      );
    }
    last = tokenIndex + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const Avatar: React.FC<{ name: string; src?: string | null; size?: number; className?: string }> = ({ name, src, size = 40, className }) => {
  const initials = useMemo(() => safeInitials(name), [name]);
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={className ?? ''}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-gradient-to-br from-gray-700 to-gray-900 p-[2px] ${className ?? ''}`}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      <div className="w-full h-full rounded-full bg-[var(--bg-panel)] flex items-center justify-center text-[var(--text-main)] font-bold text-xs uppercase">
        {initials}
      </div>
    </div>
  );
};

const EmojiPicker: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}> = ({ open, onClose, onSelect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const emojis = useMemo(
    () => [
      '😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','😅','😇','🙂','🙃','😉','😌',
      '🤝','👏','🙌','👍','👎','💪','🙏','🎉','✨','🔥','💡','✅','⚠️','📌','📣','🗓️',
      '🎯','🚀','🏆','📈','📢','🧠','💬','❤️','💙','💚','🧡','💜','⭐','🌟','👀'
    ],
    []
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-4 py-3 border-b border-[var(--border)] text-xs text-[var(--text-soft)]">
        Emojis
      </div>
      <div className="p-3 grid grid-cols-10 gap-1.5">
        {emojis.map(e => (
          <button
            key={e}
            type="button"
            className="h-7 w-7 rounded-lg hover:bg-[var(--bg-body)] transition-colors text-base leading-none flex items-center justify-center"
            onClick={() => onSelect(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
};

const MediaLightbox: React.FC<{
  open: boolean;
  src: string;
  kind: MediaKind;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}> = ({ open, src, kind, onClose, onPrev, onNext, canPrev, canNext }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-5xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/90 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10"
          aria-label="Fechar"
        >
          <X size={22} />
        </button>
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black">
          {kind === 'video' ? (
            <video src={src} controls className="w-full max-h-[90vh] object-contain" />
          ) : (
            <img src={src} alt="" className="w-full max-h-[90vh] object-contain" />
          )}
        </div>
        {(onPrev || onNext) && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              className="pointer-events-auto ml-2 p-2 rounded-xl bg-black/40 hover:bg-black/55 text-white disabled:opacity-30"
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="pointer-events-auto mr-2 p-2 rounded-xl bg-black/40 hover:bg-black/55 text-white disabled:opacity-30"
              aria-label="Próxima"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const InstaFlow: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;
  const { preferences, setChannelPreferences, setPermissionPromptDismissedUntil } = useNotificationPreferences();

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-[var(--text-soft)] animate-pulse">
      Carregando feed...
    </div>
  );

  const user = profile;
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const postTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [postEmojiOpen, setPostEmojiOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ srcs: string[]; index: number } | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(isInstaFlowSoundEnabled());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const cacheKey = useMemo(() => `systemflow:instaflow:feed:v1:${profile.id}`, [profile.id]);
  const [showNotificationPermissionPrompt, setShowNotificationPermissionPrompt] = useState(
    shouldShowNotificationPermissionPrompt
  );
  const [requestingNotificationPermission, setRequestingNotificationPermission] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') {
      setShowNotificationPermissionPrompt(false);
      return;
    }

    const dbUntilRaw = preferences.permissionPromptDismissedUntil;
    const dbUntil = dbUntilRaw ? Date.parse(dbUntilRaw) : NaN;
    const allowedByDb = !Number.isFinite(dbUntil) || Date.now() >= dbUntil;
    const allowedByLocal = shouldShowNotificationPermissionPrompt();
    setShowNotificationPermissionPrompt(allowedByDb && allowedByLocal);
  }, [preferences.permissionPromptDismissedUntil]);

  useEffect(() => {
    (async () => {
      const { items } = await fetchFeed({ page: 1, pageSize: 50, userId: profile.id });
      setPosts(items);
    })();
  }, [profile.id]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { posts?: Post[]; scrollY?: number; activeTag?: string | null };
      if (Array.isArray(parsed.posts) && parsed.posts.length > 0) {
        setPosts(parsed.posts);
      }
      if (parsed.activeTag) setActiveTag(parsed.activeTag);
      if (typeof parsed.scrollY === 'number') {
        requestAnimationFrame(() => window.scrollTo({ top: parsed.scrollY || 0 }));
      }
    } catch {}
  }, [cacheKey]);

  useEffect(() => {
    try {
      const scrollY = window.scrollY;
      sessionStorage.setItem(cacheKey, JSON.stringify({ posts, scrollY, activeTag }));
    } catch {}
  }, [cacheKey, posts, activeTag]);

  useEffect(() => {
    const onSound = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setSoundEnabled(Boolean(detail));
    };
    window.addEventListener('systemflow:instaflowSound', onSound as any);
    return () => window.removeEventListener('systemflow:instaflowSound', onSound as any);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`instaflow_feed_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'instaflow_posts' },
        async (payload) => {
          const row = payload.new as any;
          if (row?.created_by && row.created_by === profile.id) return;
          const fresh = await fetchPostById(row.id, profile.id);
          if (!fresh) return;
          setPosts(prev => [fresh, ...prev.filter(p => p.id !== fresh.id)]);
          void playInstaFlowNewPostSound();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'instaflow_posts' },
        async (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          setPosts(prev => prev.map(p => p.id === row.id ? { ...p, content: row.content ?? p.content, likes: row.likes_count ?? p.likes, comments_count: row.comments_count ?? p.comments_count } : p));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'instaflow_likes' },
        async (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row?.post_id) return;
          const summary = await fetchReactionSummary(row.post_id, profile.id);
          setPosts(prev => prev.map(p => p.id === row.post_id ? { ...p, reactions: summary.counts, my_reaction: summary.myReaction, liked_by_me: !!summary.myReaction } : p));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id]);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      for (const u of previewUrls) {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      }
    };
  }, [previewUrls]);

  const insertEmojiInPost = (emoji: string) => {
    const el = postTextareaRef.current;
    if (!el) return;
    const value = newPost;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    setNewPost(next);
    setPostEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handlePost = async () => {
    if (!newPost.trim() && files.length === 0) return;
    setPublishing(true);
    setError(null);
    const media: { url: string; type?: string | null }[] = [];
    for (const f of files) {
      const url = await uploadMedia(f, profile.id);
      if (!url) {
        setError('Formato ou tamanho de arquivo não permitido.');
        setPublishing(false);
        return;
      }
      media.push({ url, type: f.type.startsWith('video') ? 'video' : 'image' });
    }
    const created = await createPostWithMedia(newPost.trim(), profile.id, media);
    if (created) {
      setPosts(prev => [{
        ...created,
        usuario_nome: created.usuario_nome || profile.nome,
        usuario_avatar_url: created.usuario_avatar_url ?? profile.avatar_url ?? null
      }, ...prev]);
    }
    setNewPost('');
    setFiles([]);
    setPreviewUrls([]);
    setPublishing(false);
  };

  const handleStartEdit = (post: Post, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(post.id);
    setEditContent(post.content);
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    const updated = await editPost(editingId, user.id, { content: editContent.trim() });
    if (updated) {
      setPosts(posts.map(p => p.id === editingId ? { ...p, content: editContent.trim() } : p));
      setEditingId(null);
      setEditContent('');
      return;
    }
    setError('Não foi possível salvar a edição. Verifique sua permissão e tente novamente.');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    setDeleteConfirmPostId(postId);
  };

  const handleHide = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPosts(posts.filter(p => p.id !== postId));
    setMenuOpenId(null);
  };

  const visiblePosts = useMemo(() => {
    if (!activeTag) return posts;
    return posts.filter(p => parseHashtags(p.content).includes(activeTag));
  }, [posts, activeTag]);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-0 space-y-8 animate-in fade-in duration-700">
      {showNotificationPermissionPrompt && (
        <NotificationPermissionBanner
          isRequesting={requestingNotificationPermission}
          onEnable={async () => {
            setRequestingNotificationPermission(true);
            const result = await requestBrowserNotificationPermission();
            setRequestingNotificationPermission(false);
            if (result && result !== 'default') {
              setShowNotificationPermissionPrompt(false);
            }
            if (result === 'granted') {
              await Promise.all([
                setChannelPreferences('system', { nativeEnabled: true }),
                setChannelPreferences('chat', { nativeEnabled: true }),
                setPermissionPromptDismissedUntil(null),
              ]);
            }
          }}
          onLater={() => {
            const until = dismissNotificationPromptForCooldown();
            void setPermissionPromptDismissedUntil(new Date(until).toISOString());
            setShowNotificationPermissionPrompt(false);
          }}
        />
      )}
      
      {/* HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">InstaFlow</h1>
          <p className="text-xs text-[var(--text-soft)]">Compartilhe momentos com a equipe</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setInstaFlowSoundEnabled(next);
              setSoundEnabled(next);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${soundEnabled ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            title="Som sutil ao chegar novo post"
          >
            Som {soundEnabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* CREATE POST CARD */}
      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] p-6 shadow-xl shadow-black/5 relative group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600"></div>
        
        <div className="flex gap-4">
          <div className="shrink-0">
             {profile.avatar_url ? (
               <img 
                 src={profile.avatar_url} 
                 alt={profile.nome} 
                 className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500/30 p-[1px]"
               />
             ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 p-[2px] shadow-lg shadow-cyan-500/20">
                  <div className="w-full h-full rounded-full bg-[var(--bg-panel)] flex items-center justify-center font-bold text-sm text-[var(--text-main)] uppercase">
                    {profile.nome.substring(0, 2)}
                  </div>
                </div>
             )}
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="relative">
              <textarea
                ref={postTextareaRef}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder={`No que você está pensando, ${profile.nome.split(' ')[0]}?`}
                className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition-all resize-none min-h-[100px] placeholder:text-[var(--text-muted)]"
              />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const list = Array.from((e.target as HTMLInputElement).files || []);
                    setFiles(list);
                    setPreviewUrls(list.map(f => URL.createObjectURL(f)));
                  }}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
                  title="Adicionar Foto/Vídeo"
                >
                  <ImageIcon size={20} />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPostEmojiOpen(v => !v); }}
                    className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-amber-400 transition-colors"
                    title="Adicionar Emoji"
                    aria-expanded={postEmojiOpen}
                  >
                    <Smile size={20} />
                  </button>
                  <EmojiPicker
                    open={postEmojiOpen}
                    onClose={() => setPostEmojiOpen(false)}
                    onSelect={insertEmojiInPost}
                  />
                </div>
              </div>

              <button
                onClick={handlePost}
                disabled={publishing || (!newPost.trim() && files.length === 0)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
              >
                {publishing ? (
                  <span className="animate-pulse">Publicando...</span>
                ) : (
                  <>
                    <span>Publicar</span>
                    <Send size={14} />
                  </>
                )}
              </button>
            </div>
            
            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>
        
        {previewUrls.length > 0 && (
          <div className="mt-4 ml-14 rounded-xl border border-[var(--border)] bg-[var(--bg-body)]/30 p-3">
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((u, idx) => {
                const f = files[idx];
                const kind: MediaKind = f?.type?.startsWith('video') ? 'video' : 'image';
                return (
                  <div key={u} className="relative rounded-lg overflow-hidden border border-[var(--border)] group/preview">
                    {kind === 'video' ? (
                      <video src={u} controls className="w-full h-28 object-cover bg-black" />
                    ) : (
                      <button type="button" className="block w-full" onClick={() => setLightbox({ srcs: previewUrls, index: idx })}>
                        <img src={u} alt="" className="w-full h-28 object-cover" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const nextFiles = files.filter((_, i) => i !== idx);
                        const nextUrls = previewUrls.filter((_, i) => i !== idx);
                        setFiles(nextFiles);
                        setPreviewUrls(nextUrls);
                      }}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/preview:opacity-100 transition-all"
                      aria-label="Remover mídia"
                    >
                      <X size={14} />
                    </button>
                    {kind === 'video' && (
                      <button
                        type="button"
                        onClick={() => setLightbox({ srcs: previewUrls, index: idx })}
                        className="absolute bottom-1 left-1 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/preview:opacity-100 transition-all"
                        aria-label="Ampliar vídeo"
                      >
                        <Maximize2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[var(--text-muted)]">{previewUrls.length} mídia(s) selecionada(s)</span>
              <button
                type="button"
                onClick={() => { setFiles([]); setPreviewUrls([]); }}
                className="text-[11px] text-rose-400 hover:text-rose-300"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POSTS LIST */}
      <div className="space-y-6">
        {activeTag && (
          <div className="flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl px-4 py-3">
            <div className="text-sm text-[var(--text-main)]">
              Filtrando por <span className="text-cyan-500 font-semibold">{activeTag}</span>
            </div>
            <button type="button" onClick={() => setActiveTag(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">
              Limpar filtro
            </button>
          </div>
        )}

        {visiblePosts.map(post => (
          <div key={post.id} className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow duration-300">
            
            {/* Post Header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  name={post.usuario_nome}
                  src={post.usuario_avatar_url}
                  size={40}
                  className="shrink-0 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-semibold text-[var(--text-main)] text-sm">{post.usuario_nome}</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">{formatDateTime(post.created_at)}</p>
                </div>
              </div>
              
              <div className="relative">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === post.id ? null : post.id); 
                  }} 
                  className="p-2 hover:bg-[var(--bg-body)] rounded-full text-[var(--text-muted)] transition-colors"
                >
                  <MoreHorizontal size={20} />
                </button>
                
                {menuOpenId === post.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-panel)] rounded-xl shadow-xl border border-[var(--border)] overflow-hidden z-30 py-1 animate-in fade-in zoom-in-95 duration-100">
                    {(post.usuario_id === profile.id) && (
                      <button onClick={(e) => handleStartEdit(post, e)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-body)] flex items-center gap-2 text-[var(--text-main)] transition-colors">
                        <Edit2 size={14} /> Editar
                      </button>
                    )}
                    {(post.usuario_id === profile.id || profile.cargo === 'ADMIN') && (
                      <button onClick={(e) => handleDelete(post.id, e)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-rose-500/10 flex items-center gap-2 text-rose-400 transition-colors">
                        <Trash2 size={14} /> Excluir
                      </button>
                    )}
                    <button onClick={(e) => handleHide(post.id, e)} className="w-full text-left px-4 py-2.5 text-xs hover:bg-[var(--bg-body)] flex items-center gap-2 text-[var(--text-soft)] transition-colors">
                      <EyeOff size={14} /> Ocultar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Post Content */}
            <div className="px-6 pb-2">
               {editingId === post.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-[var(--bg-body)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/50 outline-none"
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={handleCancelEdit} className="p-1.5 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)]"><X size={16} /></button>
                    <button onClick={handleSaveEdit} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"><Check size={16} /></button>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--text-main)] leading-relaxed text-[15px] whitespace-pre-wrap">
                  {renderRichText(post.content, { onHashtagClick: setActiveTag })}
                </p>
              )}
            </div>

            {/* Media */}
            {(() => {
              const mediaUrls = (post.media && post.media.length > 0)
                ? post.media
                : (post.image_url ? [post.image_url] : []);
              if (mediaUrls.length === 0) return null;
              if (mediaUrls.length === 1) {
                const src = mediaUrls[0];
                return (
                  <div className="mt-3 bg-black/5 dark:bg-black/20">
                    {isVideoUrl(src) ? (
                      <div className="relative">
                        <video src={src} controls className="w-full max-h-[520px] object-contain bg-black" />
                        <button
                          type="button"
                          onClick={() => setLightbox({ srcs: mediaUrls, index: 0 })}
                          className="absolute bottom-3 left-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                          aria-label="Ampliar vídeo"
                        >
                          <Maximize2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="block w-full" onClick={() => setLightbox({ srcs: mediaUrls, index: 0 })}>
                        <img src={src} alt="" className="w-full max-h-[520px] object-cover cursor-zoom-in" />
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <div className="mt-3 px-6 pb-2">
                  <div className="grid grid-cols-2 gap-2">
                    {mediaUrls.slice(0, 4).map((src, idx) => {
                      const isLast = idx === 3 && mediaUrls.length > 4;
                      return (
                        <button
                          key={`${src}-${idx}`}
                          type="button"
                          onClick={() => setLightbox({ srcs: mediaUrls, index: idx })}
                          className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-black/5"
                        >
                          {isVideoUrl(src) ? (
                            <video src={src} className="w-full h-48 object-cover bg-black" />
                          ) : (
                            <img src={src} alt="" className="w-full h-48 object-cover" />
                          )}
                          {isLast && (
                            <div className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-lg font-bold">
                              +{mediaUrls.length - 4}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            
            {/* Actions Bar */}
            <div className="px-6 py-4 flex items-center gap-6 border-t border-[var(--border)] mt-2">
              <ReactionsBar
                post={post}
                userId={profile.id}
                onChange={(next) => setPosts(prev => prev.map(p => p.id === post.id ? next : p))}
              />
              
              <button className="flex items-center gap-2 text-[var(--text-soft)] hover:text-cyan-400 transition-colors text-sm group">
                <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
                <span>{commentCounts[post.id] ?? post.comments_count}</span>
              </button>
              
              <button className="ml-auto text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors">
                <Share2 size={20} />
              </button>
            </div>

            {/* Comments */}
            <div className="bg-[var(--bg-body)]/30 px-6 py-4 border-t border-[var(--border)]">
              <CommentSection
                postId={post.id}
                userId={user.id}
                onCountChange={(count) => {
                  setCommentCounts(prev => (prev[post.id] === count ? prev : { ...prev, [post.id]: count }));
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <MediaLightbox
        open={!!lightbox}
        src={(lightbox?.srcs?.[lightbox.index ?? 0]) ?? ''}
        kind={isVideoUrl((lightbox?.srcs?.[lightbox.index ?? 0]) ?? '') ? 'video' : 'image'}
        onClose={() => setLightbox(null)}
        onPrev={() => setLightbox(prev => prev ? { ...prev, index: Math.max(0, prev.index - 1) } : prev)}
        onNext={() => setLightbox(prev => prev ? { ...prev, index: Math.min(prev.srcs.length - 1, prev.index + 1) } : prev)}
        canPrev={!!lightbox && lightbox.index > 0}
        canNext={!!lightbox && lightbox.index < lightbox.srcs.length - 1}
      />
      <Modal
        isOpen={!!deleteConfirmPostId}
        onClose={() => { if (!deletingPost) setDeleteConfirmPostId(null); }}
        title="Excluir publicação"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-soft)]">
            Tem certeza que deseja excluir esta publicação? Esta ação não pode ser desfeita.
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={deletingPost}
              onClick={() => setDeleteConfirmPostId(null)}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!deleteConfirmPostId || deletingPost}
              onClick={async () => {
                if (!deleteConfirmPostId) return;
                setDeletingPost(true);
                setError(null);
                const success = await deletePost(deleteConfirmPostId, user.id);
                if (success) {
                  setPosts(prev => prev.filter(p => p.id !== deleteConfirmPostId));
                  setDeleteConfirmPostId(null);
                } else {
                  setError('Não foi possível excluir a publicação. Verifique sua permissão e tente novamente.');
                }
                setDeletingPost(false);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm transition-colors disabled:opacity-50"
            >
              {deletingPost ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const QUICK_REACTIONS: InstaFlowReaction[] = ['👍', '❤️', '👏', '🔥'];

const ReactionsBar: React.FC<{
  post: Post;
  userId: string;
  onChange: (next: Post) => void;
}> = ({ post, userId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<{ reaction: string; user_id: string; usuario_nome: string; usuario_avatar_url?: string | null }[]>([]);
  const [detailsFilter, setDetailsFilter] = useState<string>('all');

  const counts = post.reactions ?? {};
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0) || post.likes || 0;
  const my = post.my_reaction ?? null;
  const detailsStats = useMemo(() => {
    const byReaction: Record<string, number> = {};
    for (const d of details) {
      const key = d.reaction || '❤️';
      byReaction[key] = (byReaction[key] || 0) + 1;
    }
    const reactions = Object.entries(byReaction)
      .sort((a, b) => b[1] - a[1])
      .map(([reaction, count]) => ({ reaction, count }));
    return { total: details.length, reactions };
  }, [details]);
  const filteredDetails = useMemo(() => {
    if (detailsFilter === 'all') return details;
    return details.filter(d => (d.reaction || '❤️') === detailsFilter);
  }, [details, detailsFilter]);

  const applyOptimistic = (nextReaction: string | null) => {
    const prevReaction = my;
    const nextCounts = { ...counts };

    if (prevReaction) {
      nextCounts[prevReaction] = Math.max(0, (nextCounts[prevReaction] || 0) - 1);
      if (nextCounts[prevReaction] === 0) delete nextCounts[prevReaction];
    }
    if (nextReaction) {
      nextCounts[nextReaction] = (nextCounts[nextReaction] || 0) + 1;
    }

    const nextTotal = Math.max(0, total + (nextReaction ? 1 : 0) - (prevReaction ? 1 : 0));

    onChange({
      ...post,
      my_reaction: nextReaction,
      reactions: nextCounts,
      likes: nextTotal,
      liked_by_me: !!nextReaction
    });
  };

  const pick = async (reaction: InstaFlowReaction) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    setEmojiOpen(false);

    const next = my === reaction ? null : reaction;
    const snapshot = { ...post };
    applyOptimistic(next);

    const ok = await setReaction(post.id, userId, next);
    if (!ok) onChange(snapshot);
    setBusy(false);
  };

  const openDetails = async () => {
    setDetailsOpen(true);
    setDetailsFilter('all');
    const rows = await fetchReactions(post.id);
    setDetails(rows);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        disabled={busy}
        className={`flex items-center gap-2 transition-all text-sm ${my ? 'text-cyan-400' : 'text-[var(--text-soft)] hover:text-cyan-400'} disabled:opacity-50`}
        title="Reagir"
      >
        <span className="text-lg leading-none">{my ?? '❤️'}</span>
        <span>{total}</span>
      </button>

      {total > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void openDetails(); }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
          title="Ver quem reagiu"
        >
          Ver
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
          {QUICK_REACTIONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => void pick(r)}
              className={`h-9 w-9 rounded-xl hover:bg-[var(--bg-body)] flex items-center justify-center text-lg ${my === r ? 'bg-cyan-500/10' : ''}`}
              aria-label={`Reagir com ${r}`}
            >
              {r}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEmojiOpen(v => !v); }}
              className="h-9 w-9 rounded-xl hover:bg-[var(--bg-body)] flex items-center justify-center text-[var(--text-muted)] hover:text-amber-400"
              aria-label="Escolher outro emoji"
              title="Mais emojis"
            >
              <Smile size={18} />
            </button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSelect={(emoji) => void pick(emoji)}
            />
          </div>
        </div>
      )}

      <Modal
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Reações"
        size="md"
      >
        <div className="space-y-4">
          {total > 0 && details.length === 0 && (
            <div className="text-sm text-[var(--text-soft)] bg-[var(--bg-body)]/40 border border-[var(--border)] rounded-2xl p-3">
              Este post mostra <span className="font-semibold text-[var(--text-main)]">{total}</span> reação(ões), mas não há registros individuais para listar.
            </div>
          )}

          {details.length > 0 && details.length < total && (
            <div className="text-sm text-[var(--text-soft)] bg-[var(--bg-body)]/40 border border-[var(--border)] rounded-2xl p-3">
              Mostrando <span className="font-semibold text-[var(--text-main)]">{details.length}</span> de <span className="font-semibold text-[var(--text-main)]">{total}</span> reação(ões).
            </div>
          )}

          {details.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDetailsFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${detailsFilter === 'all' ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
              >
                Todos <span className="ml-1 text-[11px] text-[var(--text-muted)]">({detailsStats.total})</span>
              </button>
              {detailsStats.reactions.map(r => (
                <button
                  key={r.reaction}
                  type="button"
                  onClick={() => setDetailsFilter(r.reaction)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-colors ${detailsFilter === r.reaction ? 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                >
                  <span className="mr-1">{r.reaction}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">({r.count})</span>
                </button>
              ))}
            </div>
          )}

          {details.length > 0 && (
            <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
              {filteredDetails.map(u => (
                <div key={`${u.user_id}-${u.reaction}`} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={u.usuario_nome} src={u.usuario_avatar_url} size={32} className="shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--text-main)] truncate">{u.usuario_nome}</div>
                  </div>
                  <div className="text-lg leading-none">{u.reaction || '❤️'}</div>
                </div>
              ))}
            </div>
          )}

          {details.length === 0 && total === 0 && (
            <div className="text-sm text-[var(--text-soft)]">Nenhuma reação ainda.</div>
          )}
        </div>
      </Modal>
    </div>
  );
};

const CommentReactionsBar: React.FC<{
  postId: string;
  comment: InstaFlowComment;
  userId: string;
  onChange: (next: InstaFlowComment) => void;
}> = ({ postId, comment, userId, onChange }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const counts = comment.reactions ?? {};
  const total = comment.reactions_total ?? Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const my = comment.my_reaction ?? null;

  const applyOptimistic = (nextReaction: string | null) => {
    const prevReaction = my;
    const nextCounts = { ...counts };

    if (prevReaction) {
      nextCounts[prevReaction] = Math.max(0, (nextCounts[prevReaction] || 0) - 1);
      if (nextCounts[prevReaction] === 0) delete nextCounts[prevReaction];
    }
    if (nextReaction) {
      nextCounts[nextReaction] = (nextCounts[nextReaction] || 0) + 1;
    }

    const nextTotal = Math.max(0, total + (nextReaction ? 1 : 0) - (prevReaction ? 1 : 0));

    onChange({
      ...comment,
      my_reaction: nextReaction,
      reactions: nextCounts,
      reactions_total: nextTotal
    });
  };

  const pick = async (reaction: InstaFlowReaction) => {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    setEmojiOpen(false);

    const next = my === reaction ? null : reaction;
    const snapshot = { ...comment };
    applyOptimistic(next);

    const ok = await setCommentReaction(postId, comment.id, userId, next);
    if (!ok) onChange(snapshot);
    setBusy(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        disabled={busy}
        className={`flex items-center gap-1 transition-all text-[11px] ${my ? 'text-cyan-400' : 'text-[var(--text-muted)] hover:text-cyan-400'} disabled:opacity-50`}
        title="Reagir"
      >
        <span className="text-base leading-none">{my ?? '❤️'}</span>
        <span>{total}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-xl px-3 py-2 flex items-center gap-2">
          {QUICK_REACTIONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => void pick(r)}
              className={`h-9 w-9 rounded-xl hover:bg-[var(--bg-body)] flex items-center justify-center text-lg ${my === r ? 'bg-cyan-500/10' : ''}`}
              aria-label={`Reagir com ${r}`}
            >
              {r}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEmojiOpen(v => !v); }}
              className="h-9 w-9 rounded-xl hover:bg-[var(--bg-body)] flex items-center justify-center text-[var(--text-muted)] hover:text-amber-400"
              aria-label="Escolher outro emoji"
              title="Mais emojis"
            >
              <Smile size={18} />
            </button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSelect={(emoji) => void pick(emoji)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CommentSection: React.FC<{ postId: string; userId: string; onCountChange?: (count: number) => void }> = ({ postId, userId, onCountChange }) => {
  const [items, setItems] = useState<InstaFlowComment[]>([]);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<InstaFlowComment | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionResults, setMentionResults] = useState<Array<{ id: string; nome: string; avatar_url?: string | null }>>([]);
  const mentionRef = useRef<HTMLDivElement>(null);
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const debounceRef = useRef<number | null>(null);
  
  useEffect(() => {
    (async () => {
      const data = await fetchComments(postId, 1, 200, userId);
      setItems(data);
    })();
  }, [postId, userId]);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  useEffect(() => {
    if (!mentionOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = mentionRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMentionOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [mentionOpen]);

  const insertEmojiInComment = (emoji: string) => {
    const el = inputRef.current;
    if (!el) return;
    const value = text;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const updateMentionSuggestions = (value: string) => {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf('@');
    if (at < 0) {
      setMentionQuery(null);
      setMentionOpen(false);
      return;
    }
    const prevChar = at === 0 ? ' ' : before[at - 1];
    if (!/\s/.test(prevChar)) {
      setMentionQuery(null);
      setMentionOpen(false);
      return;
    }
    const query = before.slice(at + 1);
    if (!query || /\s/.test(query)) {
      setMentionQuery(null);
      setMentionOpen(false);
      return;
    }
    setMentionQuery(query);
    setMentionOpen(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const rows = await searchProfilesByName(query, 8);
      setMentionResults(rows.map(r => ({ id: r.id, nome: r.nome, avatar_url: r.avatar_url })));
    }, 120);
  };

  const insertMention = (id: string, nome: string) => {
    const el = inputRef.current;
    if (!el) return;
    const value = text;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const at = before.lastIndexOf('@');
    if (at < 0) return;
    const prefix = before.slice(0, at);
    const next = `${prefix}@${nome} ${after}`;
    setText(next);
    setMentionMap(prev => ({ ...prev, [id]: nome }));
    setMentionOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = (prefix.length + 1 + nome.length + 1);
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    if (!text.trim()) return;
    const mentionIds = Object.entries(mentionMap)
      .filter(([, nome]) => text.includes(`@${nome}`))
      .map(([id]) => id);

    const c = await addComment(postId, userId, text.trim(), {
      parent_id: replyTo?.id ?? null,
      mention_user_ids: mentionIds
    });
    if (c) {
      setItems(prev => [...prev, { ...c, reactions_total: 0, my_reaction: null, reactions: {} }]);
      setText('');
      setReplyTo(null);
      setMentionMap({});
    }
  };

  const topLevel = useMemo(() => items.filter(i => !i.parent_id), [items]);
  const repliesByParent = useMemo(() => {
    const m: Record<string, InstaFlowComment[]> = {};
    for (const c of items) {
      if (!c.parent_id) continue;
      if (!m[c.parent_id]) m[c.parent_id] = [];
      m[c.parent_id].push(c);
    }
    return m;
  }, [items]);

  const startReply = (c: InstaFlowComment) => {
    setReplyTo(c);
    const base = `@${c.usuario_nome.split(' ')[0]} `;
    setText(prev => prev.trim() ? prev : base);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="space-y-4">
          {topLevel.map(c => (
            <div key={c.id} className="space-y-2">
              <div className="flex gap-3 text-sm">
                <Avatar
                  name={c.usuario_nome}
                  src={c.usuario_avatar_url}
                  size={32}
                  className="shrink-0 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-[var(--text-main)] text-xs truncate">{c.usuario_nome}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="text-[var(--text-main)] bg-[var(--bg-panel)] border border-[var(--border)] px-3 py-2 rounded-xl mt-1 leading-relaxed break-words">
                    {renderRichText(c.content)}
                  </p>
                  <div className="mt-1">
                    <div className="flex items-center gap-3">
                      <CommentReactionsBar
                        postId={postId}
                        comment={c}
                        userId={userId}
                        onChange={(next) => setItems(prev => prev.map(i => i.id === c.id ? next : i))}
                      />
                      <button type="button" onClick={() => startReply(c)} className="text-[11px] text-[var(--text-muted)] hover:text-cyan-400">
                        Responder
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {(repliesByParent[c.id]?.length ?? 0) > 0 && (
                <div className="pl-11 space-y-3">
                  {repliesByParent[c.id].map(r => (
                    <div key={r.id} className="flex gap-3 text-sm">
                      <Avatar
                        name={r.usuario_nome}
                        src={r.usuario_avatar_url}
                        size={28}
                        className="shrink-0 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-[var(--text-main)] text-xs truncate">{r.usuario_nome}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{formatDateTime(r.created_at)}</span>
                        </div>
                        <p className="text-[var(--text-main)] bg-[var(--bg-panel)] border border-[var(--border)] px-3 py-2 rounded-xl mt-1 leading-relaxed break-words">
                          {renderRichText(r.content)}
                        </p>
                        <div className="mt-1">
                          <div className="flex items-center gap-3">
                            <CommentReactionsBar
                              postId={postId}
                              comment={r}
                              userId={userId}
                              onChange={(next) => setItems(prev => prev.map(i => i.id === r.id ? next : i))}
                            />
                            <button type="button" onClick={() => startReply(c)} className="text-[11px] text-[var(--text-muted)] hover:text-cyan-400">
                              Responder
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="relative">
        <input 
          ref={inputRef}
          value={text} 
          onChange={e => { setText(e.target.value); updateMentionSuggestions(e.target.value); }} 
          placeholder="Escreva um comentário..." 
          className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] pl-12 pr-12 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all placeholder:text-[var(--text-muted)]" 
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <div className="absolute left-2 top-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEmojiOpen(v => !v); }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-400 hover:bg-[var(--bg-body)] transition-colors"
              title="Adicionar Emoji"
              aria-expanded={emojiOpen}
            >
              <Smile size={16} />
            </button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSelect={insertEmojiInComment}
            />
          </div>
        </div>
        {replyTo && (
          <div className="absolute -top-7 left-0 right-0 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <div>Respondendo {replyTo.usuario_nome}</div>
            <button type="button" onClick={() => setReplyTo(null)} className="hover:text-[var(--text-main)]">Cancelar</button>
          </div>
        )}
        {mentionOpen && mentionQuery && (
          <div ref={mentionRef} className="absolute left-0 right-0 bottom-full mb-2 z-40 bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--border)] text-[11px] text-[var(--text-soft)]">
              Mencionar @{mentionQuery}
            </div>
            <div className="max-h-56 overflow-y-auto">
              {mentionResults.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u.id, u.nome)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-body)] text-left"
                >
                  <Avatar name={u.nome} src={u.avatar_url} size={28} className="shrink-0 rounded-full object-cover" />
                  <div className="text-sm text-[var(--text-main)]">{u.nome}</div>
                </button>
              ))}
              {mentionResults.length === 0 && (
                <div className="px-3 py-3 text-sm text-[var(--text-soft)]">Nenhum usuário encontrado.</div>
              )}
            </div>
          </div>
        )}
        <button 
          onClick={submit} 
          disabled={!text.trim()}
          className="absolute right-2 top-1.5 p-1.5 rounded-lg text-cyan-500 hover:bg-cyan-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default InstaFlow;
