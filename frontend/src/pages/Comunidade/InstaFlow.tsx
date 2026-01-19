
import React, { useEffect, useRef, useState } from 'react';
import { Profile, Post } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Image as ImageIcon, 
  Send, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  EyeOff, 
  X, 
  Check,
  Sparkles,
  Smile
} from 'lucide-react';
import { fetchFeed, uploadMedia, createPost, likePost, unlikePost, hasUserLiked, fetchComments, addComment, deletePost, editPost } from '@/services/instaflow';

const InstaFlow: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return (
    <div className="flex items-center justify-center h-[50vh] text-[var(--text-soft)] animate-pulse">
      Carregando feed...
    </div>
  );

  const user = profile;
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { items } = await fetchFeed({ page: 1, pageSize: 50 });
      setPosts(items);
    })();
  }, [profile.id]);

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handlePost = async () => {
    if (!newPost.trim() && !file) return;
    setPublishing(true);
    setError(null);
    let mediaUrl: string | null = null;
    if (file) {
      mediaUrl = await uploadMedia(file, profile.id);
      if (!mediaUrl) {
        setError('Formato ou tamanho de arquivo não permitido.');
        setPublishing(false);
        return;
      }
    }
    const created = await createPost(newPost.trim(), profile.id, mediaUrl);
    if (created) {
      setPosts(prev => [{ ...created, usuario_nome: profile.nome }, ...prev]);
    }
    setNewPost('');
    setFile(null);
    setPreviewUrl(null);
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
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir esta publicação?')) {
      const success = await deletePost(postId, user.id);
      if (success) {
        setPosts(posts.filter(p => p.id !== postId));
      }
    }
    setMenuOpenId(null);
  };

  const handleHide = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPosts(posts.filter(p => p.id !== postId));
    setMenuOpenId(null);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-0 space-y-8 animate-in fade-in duration-700">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">InstaFlow</h1>
          <p className="text-xs text-[var(--text-soft)]">Compartilhe momentos com a equipe</p>
        </div>
      </div>

      {/* CREATE POST CARD */}
      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] p-6 shadow-xl shadow-black/5 relative overflow-hidden group">
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
                  className="hidden"
                  onChange={(e) => {
                    const f = (e.target as HTMLInputElement).files?.[0] || null;
                    setFile(f);
                    setPreviewUrl(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <button
                  onClick={() => inputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-cyan-400 transition-colors"
                  title="Adicionar Foto/Vídeo"
                >
                  <ImageIcon size={20} />
                </button>
                <button
                  className="p-2 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-muted)] hover:text-amber-400 transition-colors"
                  title="Adicionar Emoji"
                >
                  <Smile size={20} />
                </button>
              </div>

              <button
                onClick={handlePost}
                disabled={publishing || (!newPost.trim() && !file)}
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
        
        {previewUrl && (
          <div className="mt-4 ml-14 rounded-xl overflow-hidden relative group/preview border border-[var(--border)]">
            {file?.type.startsWith('video') ? (
              <video src={previewUrl} controls className="w-full max-h-[300px] object-cover bg-black" />
            ) : (
              <img src={previewUrl} alt="" className="w-full max-h-[300px] object-cover" />
            )}
            <button 
              onClick={() => { setFile(null); setPreviewUrl(null); }} 
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/preview:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* POSTS LIST */}
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
            
            {/* Post Header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 p-[2px]">
                  <div className="w-full h-full rounded-full bg-[var(--bg-panel)] flex items-center justify-center text-[var(--text-main)] font-bold text-xs uppercase">
                    {post.usuario_nome[0]}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-[var(--text-main)] text-sm">{post.usuario_nome}</h4>
                  <p className="text-[11px] text-[var(--text-muted)]">Postado recentemente</p>
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
                <p className="text-[var(--text-main)] leading-relaxed text-[15px] whitespace-pre-wrap">{post.content}</p>
              )}
            </div>

            {/* Media */}
            {post.image_url && (
              <div className="mt-3 bg-black/5 dark:bg-black/20">
                {post.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video src={post.image_url} controls className="w-full max-h-[500px] object-contain" />
                ) : (
                  <img src={post.image_url} alt="" className="w-full max-h-[500px] object-cover" />
                )}
              </div>
            )}
            
            {/* Actions Bar */}
            <div className="px-6 py-4 flex items-center gap-6 border-t border-[var(--border)] mt-2">
              <LikeButton postId={post.id} userId={profile.id} initialCount={post.likes} />
              
              <button className="flex items-center gap-2 text-[var(--text-soft)] hover:text-cyan-400 transition-colors text-sm group">
                <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
                <span>{post.comments_count}</span>
              </button>
              
              <button className="ml-auto text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors">
                <Share2 size={20} />
              </button>
            </div>

            {/* Comments */}
            <div className="bg-[var(--bg-body)]/30 px-6 py-4 border-t border-[var(--border)]">
              <CommentSection postId={post.id} userId={user.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LikeButton: React.FC<{ postId: string; userId: string; initialCount: number; initialLiked: boolean }> = ({ postId, userId, initialCount, initialLiked }) => {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  
  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const toggleLike = async () => {
    if (liked) {
      const ok = await unlikePost(postId, userId);
      if (ok) {
        setLiked(false);
        setCount(c => Math.max(0, c - 1));
      }
    } else {
      const ok = await likePost(postId, userId);
      if (ok) {
        setLiked(true);
        setCount(c => c + 1);
      }
    }
  };

  return (
    <button 
      onClick={toggleLike} 
      className={`flex items-center gap-2 transition-all text-sm group ${liked ? 'text-cyan-500' : 'text-[var(--text-soft)] hover:text-cyan-400'}`}
    >
      <Heart size={20} className={`${liked ? "fill-current scale-110" : "group-hover:scale-110"} transition-transform`} />
      <span>{count}</span>
    </button>
  );
};

const CommentSection: React.FC<{ postId: string; userId: string }> = ({ postId, userId }) => {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  
  useEffect(() => {
    (async () => {
      const data = await fetchComments(postId);
      setItems(data);
    })();
  }, [postId]);

  const submit = async () => {
    if (!text.trim()) return;
    const c = await addComment(postId, userId, text.trim());
    if (c) {
      setItems(prev => [...prev, c]);
      setText('');
    }
  };

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map(c => (
            <div key={c.id} className="flex gap-2 text-sm group">
              <span className="font-semibold text-[var(--text-main)] text-xs opacity-70">Usuário:</span>
              <div className="flex-1">
                 <p className="text-[var(--text-main)] bg-[var(--bg-panel)] border border-[var(--border)] px-3 py-1.5 rounded-lg inline-block rounded-tl-none">
                   {c.content}
                 </p>
                 <span className="text-[10px] text-[var(--text-muted)] ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative">
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Escreva um comentário..." 
          className="w-full rounded-xl bg-[var(--bg-panel)] border border-[var(--border)] pl-4 pr-12 py-2.5 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all placeholder:text-[var(--text-muted)]" 
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
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
