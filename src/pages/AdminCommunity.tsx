import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Trash2, MessageCircle, UserX, UserCheck, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { CommunityPost, CommunityComment } from '../types';
import {
  adminListCommunityPosts, adminDeleteCommunityPost, adminDeleteComment,
  listComments, adminDisableUser, adminEnableUser, adminListUsers,
} from '../lib/api';

export const AdminCommunity: React.FC = () => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await adminListCommunityPosts({ page: 1, page_size: 50 });
      setPosts(data.items);
    } catch {
      // ignore
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await adminListUsers();
      setUsers(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    fetchUsers();
  }, [fetchPosts, fetchUsers]);

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await adminDeleteCommunityPost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      showMsg('帖子已删除');
    } catch (err: any) {
      showMsg(err.message || '删除失败', true);
    }
  };

  const handleViewComments = async (postId: string) => {
    if (selectedPost === postId) {
      setSelectedPost(null);
      setComments([]);
      return;
    }
    setSelectedPost(postId);
    try {
      const data = await listComments(postId);
      setComments(data);
    } catch {
      setComments([]);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await adminDeleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      showMsg('评论已删除');
    } catch (err: any) {
      showMsg(err.message || '删除失败', true);
    }
  };

  const handleToggleUser = async (username: string, disabled: boolean) => {
    try {
      if (disabled) {
        await adminEnableUser(username);
        showMsg(`用户 ${username} 已解禁`);
      } else {
        await adminDisableUser(username);
        showMsg(`用户 ${username} 已被禁言`);
      }
      fetchUsers();
    } catch (err: any) {
      showMsg(err.message || '操作失败', true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="font-headline text-3xl font-black text-primary tracking-tighter">社区管理</h1>
      </div>

      {error && (
        <div className="mb-4 bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-bold">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 text-green-600 px-4 py-3 rounded-xl text-sm font-bold">{success}</div>
      )}

      <div className="grid grid-cols-12 gap-8">
        {/* Posts */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-bold text-lg text-primary">社区帖子</h2>
            <button onClick={fetchPosts} className="text-outline hover:text-primary transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {posts.length === 0 && (
            <div className="text-center py-16 text-outline">
              <p className="font-bold">暂无社区帖子</p>
            </div>
          )}

          <AnimatePresence>
            {posts.map(post => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="font-bold text-sky-900">{post.author}</span>
                    <span className="text-xs text-outline ml-3">
                      {post.created_at ? new Date(parseInt(post.created_at)).toLocaleString() : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-outline/40 hover:text-error transition-colors flex items-center gap-1 text-xs font-bold"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除帖子
                  </button>
                </div>

                <p className="text-sm text-on-surface leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>

                <div className="flex items-center gap-4 pt-3 border-t border-slate-50 text-xs text-outline">
                  <span>赞 {post.likes_count}</span>
                  <button
                    onClick={() => handleViewComments(post.id)}
                    className={cn('flex items-center gap-1 font-bold transition-colors', selectedPost === post.id ? 'text-primary' : 'hover:text-primary')}
                  >
                    <MessageCircle className="w-3 h-3" />
                    评论 {post.comments_count}
                  </button>
                </div>

                <AnimatePresence>
                  {selectedPost === post.id && comments.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 pt-3 border-t border-slate-50 space-y-2">
                        {comments.map(c => (
                          <div key={c.id} className="bg-surface-container-lowest rounded-xl p-3 text-sm flex items-start justify-between">
                            <div>
                              <span className="font-bold text-sky-900 text-xs">{c.author}</span>
                              <p className="text-on-surface mt-0.5">{c.content}</p>
                            </div>
                            <button onClick={() => handleDeleteComment(c.id)} className="text-outline/30 hover:text-error transition-colors ml-3 shrink-0">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* User Management */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-4">
            <h2 className="font-headline font-bold text-lg text-primary mb-4">用户管理</h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {users.filter((u: any) => u.role !== 'admin').map((u: any) => {
                const username = u.username || u.id || '';
                const disabled = u.disabled === 1 || u.disabled === true;
                return (
                  <div key={username} className="flex items-center justify-between bg-surface-container-lowest p-3 rounded-xl">
                    <div>
                      <span className="font-bold text-sm text-sky-900">{username}</span>
                      {disabled && <span className="ml-2 text-[10px] text-error font-bold bg-error/10 px-1.5 py-0.5 rounded">已禁言</span>}
                    </div>
                    <button
                      onClick={() => handleToggleUser(username, disabled)}
                      className={cn(
                        'flex items-center gap-1 text-xs font-bold px-2 py-1.5 rounded-lg transition-colors',
                        disabled
                          ? 'text-green-600 bg-green-50 hover:bg-green-100'
                          : 'text-error bg-error/10 hover:bg-error/20'
                      )}
                    >
                      {disabled ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {disabled ? '解禁' : '禁言'}
                    </button>
                  </div>
                );
              })}
              {users.filter((u: any) => u.role !== 'admin').length === 0 && (
                <p className="text-sm text-outline">暂无用户</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
