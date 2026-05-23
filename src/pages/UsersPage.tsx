import React, { useState, useEffect } from 'react';
import { Search, Shield, User, Ban, CheckCircle, Key, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { adminListUsers, adminDisableUser, adminEnableUser, adminResetPassword, adminGetUserProfile, type ApiUser } from '../lib/api';
import type { UserProfile } from '../types';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await adminListUsers().catch(() => []);
      setUsers(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (u.username || '').toLowerCase().includes(q);
  });

  const handleToggle = async (username: string, currentDisabled: boolean) => {
    try {
      if (currentDisabled) {
        await adminEnableUser(username);
      } else {
        await adminDisableUser(username);
      }
      loadUsers();
    } catch (e: any) {
      alert('操作失败: ' + (e.message || ''));
    }
  };

  const handleResetPwd = async (username: string) => {
    if (!confirm(`确定要重置用户 "${username}" 的密码为 123456 吗？`)) return;
    try {
      await adminResetPassword(username);
      alert('密码已重置为 123456');
    } catch (e: any) {
      alert('重置失败: ' + (e.message || ''));
    }
  };

  const handleViewProfile = async (username: string) => {
    try {
      const profile = await adminGetUserProfile(username);
      setSelectedProfile(profile);
    } catch (e: any) {
      alert('获取失败: ' + (e.message || ''));
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">用户管理</h1>
          <p className="text-on-surface-variant font-medium opacity-70">管理所有注册用户，查看学习档案</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-low rounded-full px-4 py-2">
          <Search className="w-5 h-5 text-outline" />
          <input className="bg-transparent border-none focus:ring-0 text-sm w-48" placeholder="搜索用户..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </header>

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">用户</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">角色</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">测试数</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">正确率</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">连续打卡</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">状态</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr key={u.username || idx} className={cn("border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors", u.disabled && "opacity-50")}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {(u.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface">{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold", u.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800')}>
                      {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {u.role === 'admin' ? '管理员' : '学习者'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-on-surface">{u.total_tests ?? 0}</td>
                  <td className="px-6 py-4">{((u.accuracy ?? 0) * 100).toFixed(1)}%</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 font-bold text-secondary">{u.streak ?? 0} 天</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold", u.disabled ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container')}>
                      {u.disabled ? '已禁用' : '正常'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleToggle(u.username, u.disabled)} className={cn("p-2 rounded-lg transition-colors", u.disabled ? "text-secondary hover:bg-secondary/10" : "text-error hover:bg-error/10")} title={u.disabled ? '启用' : '禁用'}>
                        {u.disabled ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleResetPwd(u.username)} className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="重置密码">
                        <Key className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleViewProfile(u.username)} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors" title="学习档案">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-outline">{loading ? '加载中...' : '暂无用户'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 text-sm text-outline border-t border-outline-variant/10">
          共 {filtered.length} 条记录
        </div>
      </div>

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedProfile(null)}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl shadow-2xl p-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-primary">学习档案</h3>
              <button onClick={() => setSelectedProfile(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                  {(selectedProfile.username || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-bold text-on-surface">{selectedProfile.username}</p>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mt-1", selectedProfile.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800')}>
                    {selectedProfile.role === 'admin' ? '管理员' : '学习者'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-container-low rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-primary">{selectedProfile.total_tests}</p>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mt-1">总测试</p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-secondary">{selectedProfile.mastered_count}</p>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mt-1">已掌握</p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-tertiary">{(selectedProfile.accuracy * 100).toFixed(1)}%</p>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mt-1">正确率</p>
                </div>
                <div className="bg-surface-container-low rounded-xl p-4 text-center">
                  <p className="text-2xl font-black text-on-surface">{selectedProfile.streak}</p>
                  <p className="text-xs text-outline font-bold uppercase tracking-wider mt-1">连续打卡</p>
                </div>
              </div>
              {selectedProfile.errors && selectedProfile.errors.length > 0 && (
                <div>
                  <h4 className="font-bold text-error mb-2">错题记录 ({selectedProfile.errors.length})</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedProfile.errors.map((e, i) => (
                      <div key={i} className="flex justify-between items-center bg-error-container/20 rounded-lg px-4 py-2 text-sm">
                        <span className="font-bold text-on-surface">{e.word}</span>
                        <span className="text-outline">{new Date(Number(e.ts) * 1000).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!selectedProfile.errors || selectedProfile.errors.length === 0) && (
                <div className="text-center py-6 text-outline">暂无错题记录</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
