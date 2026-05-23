import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, Upload, Download, X, Save, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { listDictEntries, addDictEntry, updateDictEntry, deleteDictEntry } from '../lib/api';
import type { DictEntry } from '../types';
import * as XLSX from 'xlsx';

export const AdminDictionary: React.FC = () => {
  const [items, setItems] = useState<DictEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DictEntry | null>(null);
  const [form, setForm] = useState<DictEntry>({ word: '', meaning: '', source: 'cet4', example: '', frequency: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listDictEntries({ q: search, source: sourceFilter, page, page_size: pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [page, sourceFilter]);

  const handleSearch = () => { setPage(1); loadData(); };

  const totalPages = Math.ceil(total / pageSize);

  const handleAdd = async () => {
    if (!form.word.trim() || !form.meaning.trim()) return;
    try {
      await addDictEntry(form);
      setShowForm(false);
      setForm({ word: '', meaning: '', source: 'cet4', example: '', frequency: '' });
      loadData();
    } catch (e: any) { alert('添加失败: ' + (e.message || '')); }
  };

  const handleUpdate = async () => {
    if (!editing || !form.word.trim() || !form.meaning.trim()) return;
    try {
      await updateDictEntry(editing.word, editing.source, form);
      setEditing(null);
      setShowForm(false);
      loadData();
    } catch (e: any) { alert('更新失败: ' + (e.message || '')); }
  };

  const handleDelete = async (word: string, source: string) => {
    if (!confirm(`确定要删除 "${word}" 吗？`)) return;
    try {
      await deleteDictEntry(word, source);
      loadData();
    } catch (e: any) { alert('删除失败: ' + (e.message || '')); }
  };

  const openEdit = (item: DictEntry) => {
    setEditing(item);
    setForm({ ...item });
    setShowForm(true);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let added = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        try {
          await addDictEntry({ word: String(row[0] || ''), meaning: String(row[1] || ''), source: String(row[2] || sourceFilter || 'cet4'), example: String(row[3] || ''), frequency: String(row[4] || '') });
          added++;
        } catch (_) {}
      }
      alert(`导入完成！成功导入 ${added} 条，跳过 ${rows.length - 1 - added} 条重复。`);
      loadData();
    } catch (err) { alert('导入失败，请检查文件格式'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '词典');
    XLSX.writeFile(wb, `dictionary_export_${Date.now()}.xlsx`);
  };

  const sources = ['', 'cet4', 'cet6', '考研', '雅思', '托福', 'GRE'];

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">词典管理</h1>
          <p className="text-on-surface-variant font-medium opacity-70">管理内置词典，支持 Excel 批量导入/导出</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => { setEditing(null); setForm({ word: '', meaning: '', source: 'cet4', example: '', frequency: '' }); setShowForm(true); }} className="bg-primary text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all">
            <Plus className="w-4 h-4" /> 新增
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-secondary-container text-on-secondary-container px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all">
            <Upload className="w-4 h-4" /> 导入
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <button onClick={handleExport} className="bg-surface-container-highest text-on-surface px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all">
            <Download className="w-4 h-4" /> 导出
          </button>
        </div>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2 flex-1 max-w-md">
          <Search className="w-5 h-5 text-outline" />
          <input className="bg-transparent border-none focus:ring-0 text-sm flex-1" placeholder="搜索单词..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
        </div>
        <select value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }} className="bg-surface-container-low border-none rounded-full px-4 py-2 text-sm font-medium">
          {sources.map(s => <option key={s} value={s}>{s || '全部来源'}</option>)}
        </select>
        <button onClick={handleSearch} className="bg-primary text-white px-6 py-2 rounded-full font-bold text-sm">搜索</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl shadow-2xl p-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-primary">{editing ? '编辑词条' : '新增词条'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">英文单词</label>
                <input className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" value={form.word} onChange={e => setForm({...form, word: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">中文释义</label>
                <input className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" value={form.meaning} onChange={e => setForm({...form, meaning: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">来源</label>
                <select className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                  {sources.filter(s => s).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">例句</label>
                <textarea className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 resize-none" rows={3} value={form.example} onChange={e => setForm({...form, example: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">词频</label>
                <input className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" value={form.frequency} onChange={e => setForm({...form, frequency: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={editing ? handleUpdate : handleAdd} className="bg-primary text-white px-8 py-3 rounded-full font-bold text-sm flex-1 hover:shadow-lg transition-all">
                  {editing ? '保存修改' : '添加'}
                </button>
                <button onClick={() => setShowForm(false)} className="text-slate-500 px-6 py-3 rounded-full font-bold text-sm hover:bg-slate-100 transition-all">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-surface-container-low rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-outline-variant/20 text-left">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">单词</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">释义</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">来源</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">例句</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">词频</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-outline">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.word + item.source + idx} className="border-b border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-primary">{item.word}</td>
                  <td className="px-6 py-4 text-on-surface">{item.meaning}</td>
                  <td className="px-6 py-4"><span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">{item.source}</span></td>
                  <td className="px-6 py-4 text-sm text-outline max-w-xs truncate">{item.example}</td>
                  <td className="px-6 py-4 text-sm text-outline">{item.frequency}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(item)} className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.word, item.source)} className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-outline">{loading ? '加载中...' : <><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>词典为空，点击"新增"或"导入"添加词条</p></>}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 flex items-center justify-between border-t border-outline-variant/10">
          <span className="text-sm text-outline">共 {total} 条</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-30 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-bold text-on-surface px-3">{page} / {totalPages || 1}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 rounded-lg hover:bg-surface-container-highest disabled:opacity-30 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
