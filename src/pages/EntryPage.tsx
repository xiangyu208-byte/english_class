import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Upload, Edit2, Trash2, BarChart3, CloudUpload, BookOpen, Search, X, Save, FileText, Download, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ShieldX, Layers } from 'lucide-react';
import { cn } from '../lib/utils';
import { addWord, deleteWord, listWords, updateWord, importWords, type ApiWord, listCustomBanks, addWordToCustomBank } from '../lib/api';
import { User } from '../types';
import * as XLSX from 'xlsx';

interface EntryPageProps {
  user: User;
}

export const EntryPage: React.FC<EntryPageProps> = ({ user }) => {
  const isStudent = user?.role !== 'admin';
  const [english, setEnglish] = useState('');
  const [chinese, setChinese] = useState('');
  const [example, setExample] = useState('');
  const [recentWords, setRecentWords] = useState<ApiWord[]>([]);
  const [allWords, setAllWords] = useState<ApiWord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [wordValid, setWordValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(false);
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customBanks, setCustomBanks] = useState<{ name: string; creator: string }[]>([]);
  const [selectedBank, setSelectedBank] = useState('personal');

  // 词库弹窗状态
  const [showLibrary, setShowLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<ApiWord | null>(null);
  const [editingWord, setEditingWord] = useState<ApiWord | null>(null);

  // 批量导入状态
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchCsvText, setBatchCsvText] = useState('');
  const [importMode, setImportMode] = useState<'paste' | 'upload'>('paste');
  const [batchPreview, setBatchPreview] = useState<{ english: string; chinese: string; example: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ attempted: number; added: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWords();
    (async () => { try { setCustomBanks(await listCustomBanks()); } catch {} })();
  }, []);

  const validateWord = (word: string) => {
    if (validateTimer.current) clearTimeout(validateTimer.current);
    if (!word.trim() || word.trim().length < 2) {
      setWordValid(null);
      setValidating(false);
      return;
    }
    setValidating(true);
    setWordValid(null);
    validateTimer.current = setTimeout(async () => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`, { signal: ctrl.signal });
        clearTimeout(timeout);
        setWordValid(resp.ok);
      } catch {
        setWordValid(null);
      } finally {
        setValidating(false);
      }
    }, 600);
  };

  const loadWords = async () => {
    try {
      const username = user?.username || user?.id || '';
      const arr = await listWords(username, false).catch(() => [] as any[]);
      const mapped: ApiWord[] = (arr || []).map((w: any) => ({ id: w.word, english: w.word, chinese: w.meaning, example: w.example, status: w.status, letter: w.word ? w.word.charAt(0).toUpperCase() : undefined, createdBy: w.creator }));
      setAllWords(mapped);
      setRecentWords(mapped.slice(0, 4));
      setTotalCount(mapped.length);
    } catch (err) {
      console.error('Failed to load words:', err);
    }
  };

  const handleSubmit = async (e?: React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    if (!english.trim() || !chinese.trim()) return;

    setSaving(true);
    try {
      if (selectedBank === 'personal') {
        const payload = {
          word: english.trim(),
          meaning: chinese.trim(),
          example: example.trim(),
          pos: '',
          origin: '',
          creator: user?.username || user?.id || '',
          status: '进行中'
        };
        await addWord(payload as any);
        setMessage(isStudent ? '单词已提交，等待管理员审核...' : '单词已成功保存到圣殿！');
      } else {
        await addWordToCustomBank(selectedBank, english.trim(), chinese.trim(), example.trim());
        setMessage('单词已添加到自定义词库');
      }
      const newWord: ApiWord = { id: english.trim(), english: english.trim(), chinese: chinese.trim(), example: example.trim(), status: isStudent ? '待审核' : '进行中', letter: english.trim().charAt(0).toUpperCase(), createdBy: user?.username || user?.id || '' };
      setRecentWords(prev => [newWord, ...prev].slice(0, 4));
      setTotalCount(prev => prev + 1);
      setAllWords(prev => [newWord, ...prev]);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个单词吗？')) return;
    try {
      await deleteWord(id);
      loadWords();
      if (selectedWord?.id === id) setSelectedWord(null);
    } catch (err) {
      console.error('Failed to delete word:', err);
    }
  };

  const handleUpdateWord = async () => {
    if (!editingWord || !editingWord.english.trim() || !editingWord.chinese.trim()) return;
    try {
      await updateWord(selectedWord!.english, {
        word: editingWord.english,
        meaning: editingWord.chinese,
        example: editingWord.example || '',
      });
      setSelectedWord(editingWord);
      setEditingWord(null);
      loadWords();
    } catch (err: any) {
      alert('更新失败: ' + (err.message || '未知错误'));
    }
  };

  // ============ 批量导入 ============
  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    const rows: { english: string; chinese: string; example: string }[] = [];
    for (const line of lines) {
      if (line.startsWith('英文单词') || line.startsWith('word')) continue;
      const parts = parseCSVLine(line);
      if (parts.length >= 2 && parts[0].trim()) {
        rows.push({ english: parts[0].trim(), chinese: (parts[1] || '').trim(), example: (parts[2] || '').trim() });
      }
    }
    return rows;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const handleBatchTextChange = (text: string) => {
    setBatchCsvText(text);
    setImportResult(null);
    try {
      const parsed = parseCSV(text);
      setBatchPreview(parsed);
    } catch {
      setBatchPreview([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (file.name.endsWith('.csv')) {
        handleBatchTextChange(content);
      } else {
        try {
          const data = new Uint8Array(content.split('').map(c => c.charCodeAt(0)));
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const lines: string[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            const fields = [
              String(row[0] || ''),
              String(row[1] || ''),
              String(row[2] || ''),
              String(row[3] || ''),
              String(row[4] || ''),
              user?.username || user?.id || '',
              '进行中',
            ];
            lines.push(fields.map(f => f.includes(',') || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f).join(','));
          }
          setBatchCsvText(lines.join('\n'));
          setBatchPreview(parseCSV(lines.join('\n')));
        } catch {
          setBatchPreview([]);
        }
      }
    };
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const header = '英文单词,中文释义,例句,词性,语源,创建者用户名,掌握状态(已掌握/进行中)';
    const sample = `apple,苹果,"An apple a day keeps the doctor away.",noun,Old English,${user?.username || user?.id || ''},进行中`;
    const blob = new Blob([`${header}\n${sample}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '批量导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBatchImport = async () => {
    if (!batchPreview.length) return;
    setImporting(true);
    setImportResult(null);
    try {
      // 为每行补充 creator 和 status 字段
      const lines = batchCsvText.split('\n').filter(l => l.trim());
      const username = user?.username || user?.id || '';
      const enriched = lines.map(line => {
        if (line.startsWith('英文单词') || line.startsWith('word')) return '';
        const parts = parseCSVLine(line);
        while (parts.length < 7) parts.push('');
        parts[5] = parts[5] || username;
        parts[6] = parts[6] || '进行中';
        return parts.map(f => f.includes(',') || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f).join(',');
      }).filter(l => l);
      const result = await importWords(enriched.join('\n'));
      setImportResult(result);
      loadWords();
    } catch (err: any) {
      setImportResult({ attempted: batchPreview.length, added: 0 });
    } finally {
      setImporting(false);
    }
  };

  // 搜索过滤后的单词列表
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return allWords;
    const q = searchQuery.trim().toLowerCase();
    return allWords.filter(w =>
      w.english.toLowerCase().includes(q) ||
      (w.chinese || '').toLowerCase().includes(q)
    );
  }, [allWords, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-12 flex justify-between items-end">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">词汇录入</h1>
          <p className="text-on-surface-variant font-medium opacity-70">将新知识编目入圣殿。请确保所录词条的准确性。</p>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Entry Form */}
        <section className="col-span-12 lg:col-span-5 bg-surface-container-low rounded-[2rem] p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-primary rounded-full"></div>
            <h2 className="text-xl font-bold text-primary">单条添加</h2>
          </div>

          {message && (
            <div className={cn(
              "mb-6 px-4 py-3 rounded-xl text-sm font-medium",
              message.includes('失败') ? "bg-error-container/40 text-on-error-container" : "bg-secondary-container/40 text-on-secondary-container"
            )}>
              {message}
            </div>
          )}

          <div className="space-y-6">
            {customBanks.length > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">目标词库</label>
                <div className="flex gap-2 flex-wrap">
                  {[{ value: 'personal', label: '个人词库' }, ...customBanks.map(b => ({ value: b.name, label: b.name }))].map(b => (
                    <button
                      key={b.value}
                      onClick={() => setSelectedBank(b.value)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedBank === b.value
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-surface-container-highest text-outline hover:bg-surface-container-high'
                      }`}
                    >
                      <Layers className="w-3 h-3 inline mr-1" />
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">英文单词</label>
              <div className="relative">
                <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-primary/20 transition-all" placeholder="例如：Ephemeral" type="text" value={english} onChange={(e) => { setEnglish(e.target.value); validateWord(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} required />
                {validating && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 text-outline animate-spin" />
                  </div>
                )}
                {!validating && wordValid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                )}
                {!validating && wordValid === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-error">
                    <ShieldX className="w-5 h-5" />
                  </div>
                )}
              </div>
              {wordValid === false && (
                <p className="text-xs text-error font-bold mt-1 ml-1">该单词不存在于词典中，请检查拼写</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">中文释义</label>
              <input className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" placeholder="例如：朝生暮死" type="text" value={chinese} onChange={(e) => setChinese(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} required />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">例句</label>
              <textarea className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all resize-none" placeholder="此单词在高端社论语境下如何使用？" rows={4} value={example} onChange={(e) => setExample(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}></textarea>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={handleSubmit} className="bg-primary text-white px-10 py-3 rounded-full font-bold hover:shadow-xl transition-all shadow-md disabled:opacity-50" disabled={saving || wordValid === false || !english.trim()}>
                {saving ? '保存中...' : '保存到圣殿'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <button onClick={() => setShowLibrary(true)} className="w-full bg-secondary-container text-on-secondary-container font-bold py-3.5 px-6 rounded-2xl hover:shadow-lg transition-all flex items-center justify-center gap-3 group">
                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>词库查询</span>
                <span className="text-xs opacity-60 ml-auto">共 {totalCount} 个单词</span>
              </button>
            </div>
          </div>
        </section>

        {/* Recent Entries */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-primary">最近录入</h2>
            <span className="text-sm font-medium text-slate-400">共 {totalCount} 项</span>
          </div>

          {recentWords.map((word, idx) => (
            <div key={word.id} className={cn("rounded-2xl p-6 flex items-start gap-6 transition-all hover:translate-x-2 group shadow-sm", idx % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low")}>
              <div className={cn("flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold", word.status === 'mastered' ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed text-primary")}>
                {word.letter}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-2xl font-bold text-primary tracking-tight">{word.english}</h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 className="w-5 h-5" /></button>
                    <button className="p-2 text-slate-400 hover:text-error transition-colors" onClick={() => handleDelete(word.id)}><Trash2 className="w-5 h-5" /></button>
                  </div>
                </div>
                <p className="text-secondary font-bold mb-3">{word.chinese}</p>
                <p className="text-sm text-on-surface-variant italic leading-relaxed">{word.example}</p>
              </div>
            </div>
          ))}

          {recentWords.length === 0 && (
            <div className="text-center py-12 text-outline">暂无词条，请使用左侧表单添加第一个单词。</div>
          )}
        </section>
      </div>

      {/* Stats */}
      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-primary p-8 rounded-[2rem] text-white relative overflow-hidden group shadow-lg">
          <div className="relative z-10">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">词库总量</h4>
            <p className="text-4xl font-black mb-4">{totalCount} <span className="text-lg font-normal opacity-80">个单词</span></p>
            <div className="h-1 bg-white/20 rounded-full w-full overflow-hidden"><div className="h-full bg-white w-2/3"></div></div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10 scale-150 group-hover:rotate-12 transition-transform duration-500"><BarChart3 className="w-32 h-32 fill-current" /></div>
        </div>

        <div className="bg-secondary-container p-8 rounded-[2rem] text-on-secondary-container flex flex-col justify-between shadow-lg">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">数据存储</h4>
            <p className="text-2xl font-bold">CSV 文件存储</p>
          </div>
          <p className="text-sm opacity-70 mt-4">数据通过 C++ 文件流读写</p>
        </div>

        <div onClick={() => { setShowBatchImport(true); setImportResult(null); setBatchCsvText(''); setBatchPreview([]); }} className="bg-surface-container-high p-8 rounded-[2rem] border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-highest hover:border-primary/30 transition-all">
          <CloudUpload className="w-10 h-10 text-primary mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-primary">批量导入</p>
          <p className="text-xs text-on-surface-variant mt-1">CSV 格式批量上传词条</p>
        </div>
      </section>

      {/* ============ 批量导入弹窗 ============ */}
      {showBatchImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm" onClick={() => setShowBatchImport(false)}>
          <div className="bg-white w-full max-w-3xl mx-4 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-primary tracking-tight flex items-center gap-2">
                <Upload className="w-5 h-5" />
                批量导入词条
              </h3>
              <button onClick={() => setShowBatchImport(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* 导入方式切换 */}
              <div className="flex gap-2 mb-6">
                <button onClick={() => setImportMode('paste')} className={cn("px-5 py-2.5 rounded-full font-bold text-sm transition-all", importMode === 'paste' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  <FileText className="w-4 h-4 inline mr-1.5" />
                  粘贴内容
                </button>
                <button onClick={() => setImportMode('upload')} className={cn("px-5 py-2.5 rounded-full font-bold text-sm transition-all", importMode === 'upload' ? "bg-primary text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  <Upload className="w-4 h-4 inline mr-1.5" />
                  上传文件
                </button>
                <button onClick={downloadTemplate} className="ml-auto px-5 py-2.5 rounded-full font-bold text-sm bg-secondary-container text-on-secondary-container hover:shadow-md transition-all">
                  <Download className="w-4 h-4 inline mr-1.5" />
                  下载模板
                </button>
              </div>

              {importMode === 'paste' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">
                    CSV 内容（每行7个字段：英文,中文,例句,词性,语源,创建者,状态）
                  </label>
                  <textarea
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all resize-none font-mono text-sm"
                    placeholder={`apple,苹果,"An apple a day...",noun,Old English,${user?.username || user?.id || ''},进行中`}
                    rows={10}
                    value={batchCsvText}
                    onChange={e => handleBatchTextChange(e.target.value)}
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-primary/30 transition-colors">
                  <Upload className="w-12 h-12 text-primary mx-auto mb-4 opacity-50" />
                  <p className="font-bold text-primary mb-1">点击上传 CSV 或 Excel 文件</p>
                  <p className="text-xs text-outline mb-4">支持 .csv / .xlsx / .xls 格式</p>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm hover:shadow-lg transition-all">
                    选择文件
                  </button>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                </div>
              )}

              {/* 预览 */}
              {batchPreview.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      预览（共 {batchPreview.length} 条）
                    </h4>
                    {batchPreview.length > 500 && (
                      <span className="text-xs text-error font-bold">超过500条限制，仅前500条会被导入</span>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline">#</th>
                          <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline">英文</th>
                          <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline">中文释义</th>
                          <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-outline">例句</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchPreview.slice(0, 500).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-white/50 transition-colors">
                            <td className="px-4 py-2 text-outline text-xs">{idx + 1}</td>
                            <td className="px-4 py-2 font-semibold text-primary">{row.english}</td>
                            <td className="px-4 py-2 text-on-surface">{row.chinese}</td>
                            <td className="px-4 py-2 text-outline text-xs max-w-xs truncate">{row.example}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 导入结果 */}
              {importResult && (
                <div className={cn("mt-6 px-5 py-4 rounded-xl flex items-start gap-3", importResult.added > 0 ? "bg-secondary-container/40" : "bg-error-container/40")}>
                  {importResult.added > 0 ? <CheckCircle2 className="w-5 h-5 text-secondary mt-0.5" /> : <AlertCircle className="w-5 h-5 text-error mt-0.5" />}
                  <div>
                    <p className={cn("font-bold", importResult.added > 0 ? "text-on-secondary-container" : "text-on-error-container")}>
                      {importResult.added > 0 ? '导入成功！' : '导入失败'}
                    </p>
                    <p className="text-sm opacity-80">
                      共尝试 {importResult.attempted} 条，成功导入 {importResult.added} 条，跳过 {importResult.attempted - importResult.added} 条（重复或无效）。
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 底部操作栏 */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button onClick={() => { setShowBatchImport(false); setBatchCsvText(''); setBatchPreview([]); setImportResult(null); }} className="text-slate-500 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-slate-100 transition-all">
                取消
              </button>
              <button
                onClick={handleBatchImport}
                disabled={importing || batchPreview.length === 0}
                className="bg-primary text-white px-8 py-2.5 rounded-full font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? (
                  <>导入中 ({batchPreview.length} 条)...</>
                ) : (
                  <><Upload className="w-4 h-4" />开始导入</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ 词库弹窗 ============ */}
      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm" onClick={() => { setShowLibrary(false); setSelectedWord(null); setEditingWord(null); }}>
          <div className="bg-white w-full max-w-4xl mx-4 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* 顶部：标题 + 搜索 + 关闭 */}
            <div className="flex items-center gap-4 p-6 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-primary tracking-tight whitespace-nowrap mr-2">词库查询</h3>
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-lg focus:ring-2 focus:ring-primary/20 transition-all" placeholder="搜索单词（英文/中文）..." type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
              </div>
              <button onClick={() => { setShowLibrary(false); setSelectedWord(null); setEditingWord(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* 左侧：单词列表 */}
              <div className="w-1/2 border-r border-slate-100 overflow-y-auto">
                {filteredWords.length === 0 ? (
                  <div className="text-center py-16 text-outline">
                    {searchQuery ? '未找到匹配的单词' : '词库为空'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {filteredWords.map(w => (
                      <button key={w.id} onClick={() => { setSelectedWord(w); setEditingWord(null); }} className={cn("w-full text-left p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors", selectedWord?.id === w.id && 'bg-primary/5')}>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm", w.status === 'mastered' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary')}>
                          {w.letter}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-primary truncate">{w.english}</p>
                          <p className="text-sm text-slate-500 truncate">{w.chinese}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 右侧：详情/编辑 */}
              <div className="w-1/2 overflow-y-auto p-6">
                {!selectedWord ? (
                  <div className="text-center py-16 text-outline">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>点击左侧单词查看详情</p>
                  </div>
                ) : editingWord ? (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg text-primary">编辑单词</h3>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">英文</label>
                      <input className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" type="text" value={editingWord.english} onChange={e => setEditingWord({ ...editingWord, english: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">中文释义</label>
                      <input className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20" type="text" value={editingWord.chinese} onChange={e => setEditingWord({ ...editingWord, chinese: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">例句</label>
                      <textarea className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 resize-none" rows={4} value={editingWord.example || ''} onChange={e => setEditingWord({ ...editingWord, example: e.target.value })} />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleUpdateWord} className="bg-primary text-white px-6 py-2.5 rounded-full font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2">
                        <Save className="w-4 h-4" />
                        保存
                      </button>
                      <button onClick={() => setEditingWord(null)} className="text-slate-500 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-slate-100 transition-all">
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-bold mb-4", selectedWord.status === 'mastered' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary')}>
                          {selectedWord.letter}
                        </div>
                        <h2 className="text-3xl font-extrabold text-primary tracking-tight">{selectedWord.english}</h2>
                        <p className="text-lg font-bold text-secondary mt-1">{selectedWord.chinese}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingWord({ ...selectedWord })} className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 className="w-5 h-5" /></button>
                        <button onClick={() => handleDelete(selectedWord.id)} className="p-2 text-slate-400 hover:text-error transition-colors"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    {selectedWord.example && (
                      <div className="bg-slate-50 rounded-xl p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">例句</p>
                        <p className="text-slate-700 italic leading-relaxed">"{selectedWord.example}"</p>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide", selectedWord.status === 'mastered' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary')}>
                        {selectedWord.status === 'mastered' ? '已掌握' : '进行中'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
