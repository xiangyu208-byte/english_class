import React, { useState, useEffect } from 'react';
import { Trash2, Gamepad2, Search, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { adminListGameRecords, adminDeleteGameRecord } from '../lib/api';
import type { GameRecordItem } from '../types';

export const AdminGameRecords: React.FC = () => {
  const [records, setRecords] = useState<GameRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await adminListGameRecords({ page, page_size: pageSize });
      setRecords(res.items);
      setTotal(res.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleDelete = async (username: string, gameTime: string) => {
    if (!confirm(`确定要删除该游戏记录吗？`)) return;
    try {
      await adminDeleteGameRecord(username, gameTime);
      loadData();
    } catch (e: any) { alert('删除失败: ' + (e.message || '')); }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(Number(ts) * 1000).toLocaleString();
    } catch { return ts; }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">游戏监管</h1>
        <p className="text-on-surface-variant font-medium opacity-70">查看单词接龙历史记录，管理不当内容</p>
      </header>

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">用户</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">游戏时间</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">得分</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">连击</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">用时(秒)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">使用单词</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr key={r.username + r.game_time + idx} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-on-surface">{r.username}</td>
                  <td className="px-6 py-4 text-sm text-outline">{formatTime(r.game_time)}</td>
                  <td className="px-6 py-4 font-bold text-secondary">{r.total_score}</td>
                  <td className="px-6 py-4">{r.chain_len}</td>
                  <td className="px-6 py-4">{r.duration.toFixed(1)}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {r.used_words.split(',').slice(0, 5).map((w, i) => (
                        <span key={i} className="px-2 py-0.5 bg-primary/5 text-primary rounded text-xs font-medium">{w}</span>
                      ))}
                      {r.used_words.split(',').length > 5 && <span className="text-xs text-outline">+{r.used_words.split(',').length - 5}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleDelete(r.username, r.game_time)} className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors" title="删除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-outline">
                  <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>{loading ? '加载中...' : '暂无游戏记录'}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-sm text-outline">共 {total} 条</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-bold text-on-surface px-3">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
