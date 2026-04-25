import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Shield, Calendar, MoreVertical, Search, Filter } from 'lucide-react';
import { getUsers, type ApiUser } from '../lib/api';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * 从后端加载所有用户
   */
  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      // getUsers 返回的是 ApiUser[]
      setUsers(Array.isArray(data) ? data : (data.users || []));
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name || u.username || u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-black text-sky-900 tracking-tight">用户管理</h1>
          <p className="text-slate-500 mt-1">查看和管理所有注册用户的数据，包括词汇掌握情况。</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索用户..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            筛选
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">用户信息</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">角色</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">已掌握单词</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">加入时间</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400">加载中...</td>
                </tr>
              ) : filteredUsers.map((user, index) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {(user.name && user.name.length > 0 ? user.name[0] : (user.username && user.username.length > 0 ? user.username[0] : '?'))}
                      </div>
                      <div>
                        <p className="font-bold text-sky-900">{user.name || user.username}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Mail className="w-3 h-3" />
                          {user.email || user.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-100">
                          <Shield className="w-3 h-3" />
                          管理员
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 text-sky-600 text-xs font-bold border border-sky-100">
                          学习者
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-sky-900">{user.mastered ?? 0}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">个单词</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-4 h-4" />
                      {user.createdAt || '-'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-sky-900">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">显示 {filteredUsers.length} 条，共 {users.length} 条记录</p>
        </div>
      </div>
    </div>
  );
};
