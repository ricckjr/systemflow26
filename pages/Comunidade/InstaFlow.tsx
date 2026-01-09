
import React, { useEffect, useRef, useState } from 'react';
import { Profile, Post } from '../../types';
import { useAuth } from '../../src/contexts/AuthContext';
import { Heart, MessageCircle, Share2, Image as ImageIcon, Send, MoreHorizontal, Trash2, Edit2, EyeOff, X, Check } from 'lucide-react';
import { fetchFeed, uploadMedia, createPost, likePost, unlikePost, hasUserLiked, fetchComments, addComment, deletePost, editPost } from '../../services/instaflow';

const InstaFlow: React.FC<{ profile?: Profile }> = ({ profile: propProfile }) => {
  const { profile: authProfile } = useAuth();
  const profile = propProfile || authProfile;

  if (!profile) return <div className="p-8 text-center text-white">Carregando perfil...</div>;

  const user = profile; // Alias for legacy code usage if needed

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

  // Close menu when clicking outside
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
    <div className="max-w-3xl mx-auto space-y-8 py-4 px-4 sm:px-0">
      <div className="bg-card rounded-[2rem] border border-line p-8 shadow-card relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-700"></div>
        <div className="flex gap-5">
          <div className="w-12 h-12 rounded-full bg-brand-400/20 p-[2px] shadow-sm shrink-0 border border-white/10">
            <div className="w-full h-full rounded-full bg-[#0f2538] flex items-center justify-center font-extrabold text-sm text-white">
              {profile.nome[0]}
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="relative">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder={`No que você está pensando, ${profile.nome.split(' ')[0]}?`}
                className="w-full bg-white/7 border border-white/10 rounded-2xl p-4 text-white focus:bg-white/10 transition-all resize-none min-h-[100px] placeholder:text-ink-800 text-sm font-bold focus:ring-2 focus:ring-brand-400/30 focus:border-brand-500"
              />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-ink-800 hover:text-white hover:bg-white/10 transition-all text-xs font-bold border border-white/10"
                >
                  <ImageIcon size={18} className="stroke-[2.5]" />
                  <span>Mídia</span>
                </button>
              </div>
              <button
                onClick={handlePost}
                disabled={publishing || (!newPost.trim() && !file)}
                className="bg-gradient-to-r from-brand-600 to-brand-700 text-white px-8 py-3 rounded-full font-extrabold hover:from-brand-500 hover:to-brand-600 transition-all flex items-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/30"
              >
                {publishing ? (
                  <span className="animate-pulse">Publicando...</span>
                ) : (
                  <>
                    <span>Publicar</span>
                    <Send size={14} className="stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
            {error && <div className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>{error}</div>}
          </div>
        </div>
        
        {previewUrl && (
          <div className="mt-6 rounded-2xl overflow-hidden relative group/preview border border-white/10 shadow-sm">
            {file?.type.startsWith('video') ? (
              <video src={previewUrl} controls className="w-full max-h-[400px] object-cover bg-black" />
            ) : (
              <img src={previewUrl} alt="" className="w-full max-h-[400px] object-cover" />
            )}
            <button 
              onClick={() => { setFile(null); setPreviewUrl(null); }} 
              className="absolute top-3 right-3 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover/preview:opacity-100 shadow-lg"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-card rounded-[2rem] border border-white/10 overflow-hidden shadow-card hover:shadow-soft transition-shadow duration-300">
            <div className="px-8 py-6 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-400/20 p-[2px] border border-white/10">
                  <div className="w-full h-full rounded-full bg-[#0f2538] flex items-center justify-center text-white font-extrabold text-sm">
                    {post.usuario_nome[0]}
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-sm">{post.usuario_nome}</h4>
                  <p className="text-[11px] text-ink-800 font-bold opacity-80">Acabou de postar</p>
                </div>
              </div>
              <div className="text-ink-800 relative z-20">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setMenuOpenId(menuOpenId === post.id ? null : post.id); 
                  }} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={20} />
                </button>
                {menuOpenId === post.id && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#0f2538]/95 rounded-2xl shadow-xl border border-white/10 overflow-hidden z-30 py-2 animate-in fade-in zoom-in-95 duration-200">
                    {(post.usuario_id === profile.id) && (
                      <button onClick={(e) => handleStartEdit(post, e)} className="w-full text-left px-5 py-3 text-xs hover:bg-white/10 flex items-center gap-3 text-white font-bold transition-colors">
                        <Edit2 size={14} /> Editar Publicação
                      </button>
                    )}
                    {(post.usuario_id === profile.id || profile.cargo === 'ADMIN') && (
                      <button onClick={(e) => handleDelete(post.id, e)} className="w-full text-left px-5 py-3 text-xs hover:bg-rose-500/10 flex items-center gap-3 text-rose-400 font-bold transition-colors">
                        <Trash2 size={14} /> Excluir Publicação
                      </button>
                    )}
                    <button onClick={(e) => handleHide(post.id, e)} className="w-full text-left px-5 py-3 text-xs hover:bg-white/10 flex items-center gap-3 text-ink-800 font-bold transition-colors">
                      <EyeOff size={14} /> Ocultar do Feed
                    </button>
                  </div>
                )}
              </div>
            </div>

            {post.image_url && (
              <div className="bg-white/5">
                {post.image_url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video src={post.image_url} controls className="w-full max-h-[600px] object-contain" />
                ) : (
                  <img src={post.image_url} alt="" className="w-full max-h-[600px] object-contain" />
                )}
              </div>
            )}

            <div className="px-8 py-6">
              {editingId === post.id ? (
                <div className="space-y-4 bg-white/7 p-6 rounded-2xl border border-white/10">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-white/7 border border-white/10 rounded-xl p-4 text-sm text-white font-bold focus:outline-none focus:ring-4 focus:ring-brand-400/30 focus:border-brand-500 transition-all"
                    rows={3}
                  />
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={handleCancelEdit} className="p-2 text-ink-800 hover:text-white hover:bg-white/10 rounded-full transition-all"><X size={18} /></button>
                    <button onClick={handleSaveEdit} className="p-2 text-white bg-brand-600 hover:bg-brand-700 rounded-full transition-all shadow-lg shadow-brand-600/30"><Check size={18} /></button>
                  </div>
                </div>
              ) : (
                <p className="text-white leading-relaxed text-[15px] font-medium whitespace-pre-wrap">{post.content}</p>
              )}
              
              <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-6">
                <LikeButton postId={post.id} userId={profile.id} initialCount={post.likes} />
                <button className="flex items-center gap-2 text-ink-800 hover:text-brand-600 transition-colors text-xs font-extrabold group">
                  <div className="p-2.5 rounded-full bg-white/7 group-hover:bg-white/10 transition-colors border border-white/10">
                    <MessageCircle size={20} className="stroke-[2.5]" />
                  </div>
                  <span>{post.comments_count}</span>
                </button>
                <button className="ml-auto text-ink-800 hover:text-white transition-colors p-2.5 hover:bg-white/10 rounded-full">
                  <Share2 size={20} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            <div className="bg-white/5 px-8 py-6 border-t border-white/10">
              <CommentSection postId={post.id} userId={user.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstaFlow;

const LikeButton: React.FC<{ postId: string; userId: string; initialCount: number }> = ({ postId, userId, initialCount }) => {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  useEffect(() => {
    (async () => {
      const has = await hasUserLiked(postId, userId);
      setLiked(has);
    })();
  }, [postId, userId]);
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
    <button onClick={toggleLike} className={`flex items-center gap-2 transition-all text-xs font-extrabold group ${liked ? 'text-rose-400' : 'text-ink-800 hover:text-rose-400'}`}>
      <div className={`p-2.5 rounded-full transition-colors border border-white/10 ${liked ? 'bg-rose-500/10' : 'bg-white/7 group-hover:bg-rose-500/10'}`}>
        <Heart size={20} className={liked ? "fill-current stroke-[2.5]" : "stroke-[2.5]"} />
      </div>
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
    <div className="space-y-6">
      {items.length > 0 && (
        <div className="space-y-4 pl-4 border-l-2 border-brand-400/30">
          {items.map(c => (
            <div key={c.id} className="group">
              <div className="flex items-baseline justify-between">
                <div className="text-[13px] text-white font-bold bg-white/7 px-3 py-2 rounded-lg shadow-sm border border-white/10 inline-block">{c.content}</div>
                <div className="text-[10px] text-ink-800 opacity-0 group-hover:opacity-100 transition-opacity ml-2 whitespace-nowrap font-bold">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 pt-2">
        <input 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Escreva um comentário..." 
          className="flex-1 rounded-xl bg-white/7 border border-white/10 px-5 py-3 text-xs text-white focus:ring-4 focus:ring-brand-400/30 focus:border-brand-500 transition-all placeholder:text-ink-800 font-bold shadow-sm" 
        />
        <button 
          onClick={submit} 
          disabled={!text.trim()}
          className="p-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 text-white hover:from-brand-500 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-600/20"
        >
          <Send size={16} className="stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
