import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Heart, Bookmark, Send, Trash2, UserPlus, Users, Clock, Check, X, Globe, BookOpen, Edit3, Image, Hash, TrendingUp, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import { User, CommunityPost, CommunityComment, FriendItem, FriendRequest } from '../types';
import {
  createPost, listCommunityPosts, deleteCommunityPost,
  createComment, listComments, deleteComment,
  toggleLike, toggleFavorite, listFavoritePosts,
  sendFriendRequest, acceptFriendRequest, removeFriend,
  listFriends, listFriendRequests,
} from '../lib/api';

interface Props {
  user: User;
}

function timeAgo(ts: string) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - parseInt(ts);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(parseInt(ts)).toLocaleDateString();
}

export const CommunityPage: React.FC<Props> = ({ user }) => {
  const [tab, setTab] = useState<'all' | 'friends' | 'favorites'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showPostModal, setShowPostModal] = useState(false);
  const [showWordModal, setShowWordModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [uploadWord, setUploadWord] = useState('');
  const [uploadMeaning, setUploadMeaning] = useState('');
  const [uploadExample, setUploadExample] = useState('');

  const [comments, setComments] = useState<Record<string, CommunityComment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendReqs, setFriendReqs] = useState<FriendRequest[]>([]);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [showFriendPanel, setShowFriendPanel] = useState(false);

  const username = user?.username || user?.id || '';

  const fetchPosts = useCallback(async () => {
    try {
      if (tab === 'favorites') {
        const data = await listFavoritePosts(username, 1);
        setPosts(data.items);
        return;
      }
      const data = await listCommunityPosts({ page: 1, page_size: 50, username });
      setPosts(data.items);
    } catch { /* ignore */ }
  }, [username, tab]);

  const fetchComments = useCallback(async (postId: string) => {
    try {
      const data = await listComments(postId);
      setComments(prev => ({ ...prev, [postId]: data }));
    } catch { /* ignore */ }
  }, []);

  const fetchFriendData = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([listFriends(username), listFriendRequests(username)]);
      setFriends(f);
      setFriendReqs(r);
    } catch { /* ignore */ }
  }, [username]);

  useEffect(() => {
    setPosts([]);
    fetchPosts();
  }, [tab, fetchPosts]);

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleCreatePost = async () => {
    if (!postContent.trim()) return;
    setLoading(true);
    try {
      await createPost({ username, content: postContent.trim(), type: 'post' });
      setPostContent('');
      setShowPostModal(false);
      showMsg('发布成功！');
      fetchPosts();
    } catch (err: any) { showMsg(err.message || '发布失败', true); }
    finally { setLoading(false); }
  };

  const handleWordUpload = async () => {
    if (!uploadWord.trim()) { showMsg('请输入单词', true); return; }
    setLoading(true);
    try {
      await createPost({
        username,
        content: `上传新单词：${uploadWord.trim()}${uploadMeaning.trim() ? ' — ' + uploadMeaning.trim() : ''}`,
        type: 'word_upload',
        word: uploadWord.trim(),
        meaning: uploadMeaning.trim(),
        example: uploadExample.trim(),
      });
      setUploadWord('');
      setUploadMeaning('');
      setUploadExample('');
      setShowWordModal(false);
      showMsg('单词已上传，等待审核！');
      fetchPosts();
    } catch (err: any) { showMsg(err.message || '上传失败', true); }
    finally { setLoading(false); }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteCommunityPost(postId, username);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showMsg('删除成功');
    } catch (err: any) { showMsg(err.message || '删除失败', true); }
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await toggleLike(postId, username);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_liked: result.liked, likes_count: result.likes_count } : p));
    } catch { /* ignore */ }
  };

  const handleFavorite = async (postId: string) => {
    try {
      await toggleFavorite(postId, username);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_fav: !p.is_fav } : p));
    } catch { /* ignore */ }
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    try {
      await createComment({ post_id: postId, username, content });
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      fetchComments(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    } catch (err: any) { showMsg(err.message || '评论失败', true); }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    try {
      await deleteComment(commentId, username);
      fetchComments(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
    } catch (err: any) { showMsg(err.message || '删除失败', true); }
  };

  const togglePostComments = (postId: string) => {
    setShowComments(prev => {
      const next = !prev[postId];
      if (next) fetchComments(postId);
      return { ...prev, [postId]: next };
    });
  };

  const handleAddFriend = async () => {
    if (!addFriendInput.trim()) return;
    try {
      await sendFriendRequest(username, addFriendInput.trim());
      showMsg('好友申请已发送');
      setAddFriendInput('');
    } catch (err: any) { showMsg(err.message || '发送失败', true); }
  };

  const handleAcceptFriend = async (from: string) => {
    try {
      await acceptFriendRequest(from, username);
      showMsg('已接受');
      fetchFriendData();
    } catch (err: any) { showMsg(err.message || '操作失败', true); }
  };

  const handleRemoveFriend = async (friendName: string) => {
    try {
      await removeFriend(username, friendName);
      setFriends(prev => prev.filter(f => f.username !== friendName));
      showMsg('已删除');
    } catch (err: any) { showMsg(err.message || '操作失败', true); }
  };

  const OpenPostModal = () => {
    setShowPostModal(true);
    setShowWordModal(false);
  };

  const openWordModal = () => {
    setShowWordModal(true);
    setShowPostModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-primary" />
          <h1 className="font-headline text-3xl font-black text-primary tracking-tighter">用户社区</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowFriendPanel(true); fetchFriendData(); }}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container-low text-sm font-bold text-outline hover:text-on-surface transition-colors"
          >
            <Users className="w-4 h-4" />
            好友
            {friendReqs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {friendReqs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-bold">{error}</div>}
      {success && <div className="mb-4 bg-green-50 text-green-600 px-4 py-3 rounded-xl text-sm font-bold">{success}</div>}

      <div className="grid grid-cols-12 gap-8">
        {/* Main Feed */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Tab bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-surface-container-lowest p-1 rounded-2xl">
              {[
                { key: 'all', label: '全部动态' },
                { key: 'friends', label: '好友圈' },
                { key: 'favorites', label: '我的收藏' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  className={cn(
                    'px-5 py-2 rounded-xl text-sm font-bold transition-all',
                    tab === t.key ? 'bg-primary text-white shadow-md' : 'text-outline hover:text-on-surface'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPostModal(!showPostModal); setShowWordModal(false); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  showPostModal ? 'bg-primary text-white' : 'bg-surface-container-low text-outline hover:text-on-surface'
                )}
              >
                <Edit3 className="w-4 h-4" />
                发帖
              </button>
              <button
                onClick={() => { setShowWordModal(!showWordModal); setShowPostModal(false); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  showWordModal ? 'bg-secondary text-white' : 'bg-surface-container-low text-outline hover:text-on-surface'
                )}
              >
                <BookOpen className="w-4 h-4" />
                上传单词
              </button>
            </div>
          </div>

          {/* Post Composer Modal */}
          <AnimatePresence>
            {showPostModal && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white p-5 rounded-2xl shadow-md border border-primary/10">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm shrink-0">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 space-y-3">
                    <textarea
                      className="w-full border-none rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40"
                      placeholder="分享你的想法..."
                      rows={3}
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2 text-outline/40">
                        <Image className="w-4 h-4" />
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowPostModal(false)} className="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface transition-colors">取消</button>
                        <button
                          onClick={handleCreatePost}
                          disabled={loading || !postContent.trim()}
                          className="bg-gradient-to-br from-primary to-primary-container text-white px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          发送
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Word Upload Modal */}
          <AnimatePresence>
            {showWordModal && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white p-5 rounded-2xl shadow-md border border-secondary/10">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-bold text-sky-900 mb-2">上传新单词到全局词典</p>
                      <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40" placeholder="英文单词 *" value={uploadWord} onChange={e => setUploadWord(e.target.value)} autoFocus />
                    </div>
                    <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40" placeholder="中文释义" value={uploadMeaning} onChange={e => setUploadMeaning(e.target.value)} />
                    <input className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40" placeholder="例句（可选）" value={uploadExample} onChange={e => setUploadExample(e.target.value)} />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowWordModal(false)} className="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface transition-colors">取消</button>
                      <button
                        onClick={handleWordUpload}
                        disabled={loading || !uploadWord.trim()}
                        className="bg-gradient-to-br from-secondary to-secondary/80 text-white px-5 py-2 rounded-full font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3 h-3" />
                        提交审核
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Posts Feed */}
          {tab === 'friends' ? (
            /* Friends tab */
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-headline font-bold text-lg text-primary mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> 添加好友
                </h3>
                <div className="flex gap-2">
                  <input className="flex-1 bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" placeholder="输入对方用户名" value={addFriendInput} onChange={e => setAddFriendInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddFriend(); }} />
                  <button onClick={handleAddFriend} className="bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform"><Send className="w-4 h-4" /></button>
                </div>
              </div>
              {friendReqs.length > 0 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-headline font-bold text-lg text-primary mb-4 flex items-center gap-2"><Clock className="w-5 h-5" /> 待处理申请</h3>
                  <div className="space-y-2">
                    {friendReqs.map(req => (
                      <div key={req.from} className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl">
                        <span className="font-bold text-sm text-sky-900">{req.from}</span>
                        <button onClick={() => handleAcceptFriend(req.from)} className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg hover:bg-green-100"><Check className="w-3 h-3" />接受</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-headline font-bold text-lg text-primary mb-4 flex items-center gap-2"><Users className="w-5 h-5" /> 好友列表 ({friends.length})</h3>
                {friends.length === 0 ? <p className="text-sm text-outline">暂无好友</p> : (
                  <div className="space-y-2">
                    {friends.map(f => (
                      <div key={f.username} className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl">
                        <span className="font-bold text-sm text-sky-900">{f.username}</span>
                        <button onClick={() => handleRemoveFriend(f.username)} className="text-xs text-outline hover:text-error font-bold">删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.length === 0 && (
                <div className="text-center py-20 text-outline">
                  <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="font-bold text-lg mb-1">{tab === 'favorites' ? '还没有收藏任何内容' : '还没有动态'}</p>
                  <p className="text-sm">来发布第一条内容吧！</p>
                </div>
              )}
              <AnimatePresence>
                {posts.map(post => (
                  <motion.article
                    key={post.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-5">
                      {/* Post Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary font-black text-sm shrink-0">
                          {post.author.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-sky-900">{post.author}</span>
                            {post.type === 'word_upload' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">
                                <BookOpen className="w-3 h-3" />
                                单词上传
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-outline/60">{timeAgo(post.created_at)}</span>
                        </div>
                        {post.author === username && (
                          <button onClick={() => handleDeletePost(post.id)} className="text-outline/20 hover:text-error transition-colors shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Word Upload Card */}
                      {post.type === 'word_upload' && post.word && (
                        <div className="mb-3 bg-gradient-to-br from-secondary/5 to-primary/5 p-4 rounded-xl border border-primary/10">
                          <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-5 h-5 text-primary" />
                            <span className="text-lg font-black font-headline text-primary">{post.word}</span>
                          </div>
                          {post.meaning && <p className="text-sm text-sky-900 font-bold mb-1">{post.meaning}</p>}
                          {post.example && <p className="text-xs text-outline italic">"{post.example}"</p>}
                        </div>
                      )}

                      {/* Post Content */}
                      <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{post.content}</p>

                      {/* Post Actions */}
                      <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-50">
                        <button
                          onClick={() => handleLike(post.id)}
                          className={cn('flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-110 active:scale-95', post.is_liked ? 'text-red-500' : 'text-outline/60 hover:text-red-400')}
                        >
                          <Heart className={cn('w-4 h-4', post.is_liked && 'fill-current')} />
                          <span>{post.likes_count || ''}</span>
                        </button>
                        <button
                          onClick={() => togglePostComments(post.id)}
                          className={cn('flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-110 active:scale-95', showComments[post.id] ? 'text-primary' : 'text-outline/60 hover:text-primary')}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments_count || ''}</span>
                        </button>
                        <button
                          onClick={() => handleFavorite(post.id)}
                          className={cn('flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-110 active:scale-95 ml-auto', post.is_fav ? 'text-amber-500' : 'text-outline/60 hover:text-amber-400')}
                        >
                          <Bookmark className={cn('w-4 h-4', post.is_fav && 'fill-current')} />
                          {post.is_fav ? '已收藏' : '收藏'}
                        </button>
                      </div>
                    </div>

                    {/* Comments */}
                    <AnimatePresence>
                      {showComments[post.id] && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-slate-100 bg-slate-50/50">
                          <div className="p-4 space-y-3">
                            {(comments[post.id] || []).length === 0 && (
                              <p className="text-xs text-outline/50 text-center py-2">暂无评论</p>
                            )}
                            {(comments[post.id] || []).map(c => (
                              <div key={c.id} className="flex gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black shrink-0">
                                  {c.author.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1">
                                  <div className="bg-white rounded-xl px-3 py-2">
                                    <span className="font-bold text-xs text-sky-900">{c.author}</span>
                                    <p className="text-sm text-on-surface mt-0.5">{c.content}</p>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] text-outline/50">{timeAgo(c.created_at)}</span>
                                    {(c.author === username || user?.role === 'admin') && (
                                      <button onClick={() => handleDeleteComment(c.id, post.id)} className="text-[10px] text-outline/30 hover:text-error font-bold">删除</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black shrink-0">
                                {username.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 flex gap-2">
                                <input
                                  className="flex-1 bg-white border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40"
                                  placeholder="写评论..."
                                  value={commentInputs[post.id] || ''}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                                />
                                <button onClick={() => handleAddComment(post.id)} className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-transform"><Send className="w-3 h-3" /></button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">
          {/* User Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-black text-lg">
                {username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-sky-900">{username}</p>
                <p className="text-xs text-outline">@{username}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface-container-lowest rounded-xl py-2">
                <p className="text-lg font-black text-primary">{posts.filter(p => p.author === username).length}</p>
                <p className="text-[10px] text-outline font-bold">帖子</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl py-2">
                <p className="text-lg font-black text-primary">{friends.length}</p>
                <p className="text-[10px] text-outline font-bold">好友</p>
              </div>
              <div className="bg-surface-container-lowest rounded-xl py-2">
                <p className="text-lg font-black text-primary">{posts.filter(p => p.is_fav).length}</p>
                <p className="text-[10px] text-outline font-bold">收藏</p>
              </div>
            </div>
          </div>

          {/* Trending / Quick Access */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-headline font-bold text-sm text-primary mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              热门话题
            </h3>
            <div className="space-y-2">
              {['#词汇学习', '#今日打卡', '#英语分享', '#学习方法', '#每日一词'].map(tag => (
                <button key={tag} className="block w-full text-left text-sm text-outline hover:text-primary hover:bg-primary/5 px-3 py-2 rounded-xl font-bold transition-colors">{tag}</button>
              ))}
            </div>
          </div>

          {/* Friend Requests */}
          {friendReqs.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-headline font-bold text-sm text-primary mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                新好友申请
                <span className="bg-error text-white text-[10px] px-1.5 py-0.5 rounded-full">{friendReqs.length}</span>
              </h3>
              <div className="space-y-2">
                {friendReqs.slice(0, 3).map(req => (
                  <div key={req.from} className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-xl">
                    <span className="font-bold text-xs text-sky-900">{req.from}</span>
                    <button onClick={() => handleAcceptFriend(req.from)} className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg hover:bg-primary hover:text-white transition-colors">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-headline font-bold text-sm text-primary mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              我的好友 ({friends.length})
            </h3>
            {friends.length === 0 ? (
              <p className="text-xs text-outline">快去添加好友吧</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {friends.slice(0, 10).map(f => (
                  <div key={f.username} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-lowest transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                      {f.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-sky-900 flex-1">{f.username}</span>
                    <button onClick={() => handleRemoveFriend(f.username)} className="text-[10px] text-outline/30 hover:text-error font-bold">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Friend Panel Modal */}
      <AnimatePresence>
        {showFriendPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center"
            onClick={() => setShowFriendPanel(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-bold text-lg text-primary">好友管理</h3>
                <button onClick={() => setShowFriendPanel(false)} className="text-outline hover:text-on-surface"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-2 mb-4">
                <input className="flex-1 bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20" placeholder="输入对方用户名" value={addFriendInput} onChange={e => setAddFriendInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddFriend(); }} />
                <button onClick={handleAddFriend} className="bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform"><UserPlus className="w-4 h-4" /></button>
              </div>
              {friendReqs.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-bold text-outline mb-2">待处理申请</p>
                  {friendReqs.map(req => (
                    <div key={req.from} className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-xl mb-1">
                      <span className="font-bold text-sm text-sky-900">{req.from}</span>
                      <button onClick={() => handleAcceptFriend(req.from)} className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100"><Check className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs font-bold text-outline mb-2">好友列表</p>
                {friends.map(f => (
                  <div key={f.username} className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-xl mb-1">
                    <span className="font-bold text-sm text-sky-900">{f.username}</span>
                    <button onClick={() => handleRemoveFriend(f.username)} className="text-xs text-outline hover:text-error font-bold">删除</button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
