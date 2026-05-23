import React, { useState, useEffect } from 'react';
import { Search, Book, Plus, Volume2, Check, BookOpen, Library, ChevronLeft, Globe, Layers, Trash2, CheckSquare, Square, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { listWords, searchDictionary, addWordFromDictionary, type ApiWord, type DictWord, listMistakes, listCustomBanks, createCustomBank, deleteCustomBank, listCustomBankWords, addWordToCustomBank, removeWordFromCustomBank, addWordsToCustomBank } from '../lib/api';
import { getCurrentUserId } from '../lib/api';

const DICTIONARIES = [
  {
    id: 'personal',
    label: '个人词库',
    description: '你自己收录和创建的单词',
    icon: Book,
    color: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    hoverBg: 'hover:bg-sky-100',
  },
  {
    id: 'global',
    label: '全局词库',
    description: '包含CET4+CET6全部词汇',
    icon: Globe,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    hoverBg: 'hover:bg-violet-100',
  },
  {
    id: 'cet4',
    label: '四级词库',
    description: '大学英语四级考试核心词汇',
    icon: BookOpen,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hoverBg: 'hover:bg-amber-100',
  },
  {
    id: 'cet6',
    label: '六级词库',
    description: '大学英语六级考试核心词汇',
    icon: Library,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    hoverBg: 'hover:bg-emerald-100',
  },
  {
    id: 'mistakes',
    label: '错词本',
    description: '测试中答错或跳过的单词',
    icon: Book,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverBg: 'hover:bg-red-100',
  },
];

export const DictionaryPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedDict, setSelectedDict] = useState<string | null>(initialQuery ? 'all' : null);
  const [personalWords, setPersonalWords] = useState<ApiWord[]>([]);
  const [dictWords, setDictWords] = useState<DictWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedWords, setAddedWords] = useState<Record<string, Set<string>>>({});
  const [addedFeedback, setAddedFeedback] = useState('');
  const [mistakeWords, setMistakeWords] = useState<{ word: string; meaning: string; wrong_count: number; correct_count: number }[]>([]);
  const [customBanks, setCustomBanks] = useState<{ name: string; creator: string }[]>([]);
  const [newBankName, setNewBankName] = useState('');
  const [showNewBank, setShowNewBank] = useState(false);
  const [addTarget, setAddTarget] = useState<DictWord | null>(null);
  const [displayLimit, setDisplayLimit] = useState(200);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkImport, setShowBulkImport] = useState(false);
  const userId = getCurrentUserId();

  useEffect(() => {
    loadPersonalWords();
  }, []);

  useEffect(() => {
    if (selectedDict && query) {
      const timer = setTimeout(() => loadDict(), 300);
      return () => clearTimeout(timer);
    }
  }, [query]);

  const loadPersonalWords = async () => {
    try {
      const username = getCurrentUserId();
      if (!username) {
        setPersonalWords([]);
        return;
      }
      const arr = await listWords(username, false);
      const mapped: ApiWord[] = (arr || []).map((w: any) => ({
        id: w.word,
        english: w.word,
        chinese: w.meaning,
        example: w.example,
        status: w.status,
        letter: w.word ? w.word.charAt(0).toUpperCase() : undefined,
        createdBy: w.creator,
      }));
      setPersonalWords(mapped);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDict = async () => {
    setLoading(true);
    try {
      let source: string | undefined;
      if (selectedDict === 'global') source = undefined;
      else if (selectedDict === 'cet4') source = 'cet4';
      else if (selectedDict === 'cet6') source = 'cet6';
      else source = undefined;
      const dict = await searchDictionary(query || undefined, source);
      setDictWords(dict);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDict = (id: string) => {
    setSelectedDict(id);
    setQuery('');
    setDictWords([]);
    setDisplayLimit(200);
    setBulkMode(false);
    setBulkSelected(new Set());
    if (id === 'personal') {
      loadPersonalWords();
    } else if (id === 'mistakes') {
      loadMistakes();
    } else if (id.startsWith('custom:')) {
      loadCustomDict(id.substring(7));
    } else {
      setLoading(true);
      loadDict();
    }
  };

  const loadCustomDict = async (bankName: string) => {
    setLoading(true);
    try {
      const words = await listCustomBankWords(bankName);
      setDictWords((words || []).map(w => ({ word: w.word, meaning: w.meaning, source: `custom:${bankName}`, example: w.example || '', frequency: '' })));
    } catch { setDictWords([]); }
    finally { setLoading(false); }
  };

  const loadMistakes = async () => {
    setLoading(true);
    try {
      const data = await listMistakes(userId);
      setMistakeWords(data || []);
    } catch { setMistakeWords([]); }
    finally { setLoading(false); }
  };

  const loadCustomBanks = async () => {
    try {
      const banks = await listCustomBanks();
      setCustomBanks(banks || []);
    } catch {}
  };

  useEffect(() => { loadCustomBanks(); }, []);

  const handleCreateBank = async () => {
    if (!newBankName.trim()) return;
    try {
      await createCustomBank(newBankName.trim(), userId);
      setNewBankName('');
      setShowNewBank(false);
      loadCustomBanks();
    } catch (err: any) { alert(err.message || '创建失败'); }
  };

  const handleDeleteBank = async (name: string) => {
    if (!confirm(`确定要删除词库「${name}」吗？`)) return;
    try {
      await deleteCustomBank(name);
      loadCustomBanks();
      if (selectedDict === `custom:${name}`) { setSelectedDict(null); }
    } catch {}
  };

  const handleBack = () => {
    setSelectedDict(null);
    setQuery('');
    setDictWords([]);
  };

  const handleAddFromDict = async (dw: DictWord) => { setAddTarget(dw); };

  const confirmAddWord = async (target: string) => {
    if (!addTarget) return;
    try {
      if (target === 'personal') {
        await addWordFromDictionary(addTarget.word, addTarget.meaning, addTarget.example || '');
      } else {
        await addWordToCustomBank(target, addTarget.word, addTarget.meaning, addTarget.example || '');
      }
      setAddedWords(prev => {
        const next = { ...prev };
        if (!next[addTarget.word]) next[addTarget.word] = new Set();
        next[addTarget.word] = new Set([...next[addTarget.word], target]);
        return next;
      });
      setAddedFeedback(`已添加至${target === 'personal' ? '个人词库' : target}`);
      setTimeout(() => setAddedFeedback(''), 2000);
      if (target === 'personal') await loadPersonalWords();
      setAddTarget(null);
    } catch (e) { console.error(e); }
  };

  const personalFiltered = query
    ? personalWords.filter(w =>
        w.english.toLowerCase().includes(query.toLowerCase()) ||
        w.chinese.includes(query)
      )
    : personalWords;

  const filteredDictWords = query
    ? dictWords.filter(dw =>
        dw.word.toLowerCase().includes(query.toLowerCase()) ||
        (dw.meaning || '').includes(query)
      )
    : dictWords;

  const handleBulkSelect = (word: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word); else next.add(word);
      return next;
    });
  };

  const handleBulkSelectAll = () => {
    const visible = filteredDictWords.slice(0, displayLimit);
    if (bulkSelected.size === visible.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(visible.map(dw => dw.word)));
    }
  };

  const handleBulkImport = async (bank: string) => {
    const words = filteredDictWords.filter(dw => bulkSelected.has(dw.word)).map(dw => ({
      word: dw.word, meaning: dw.meaning, example: dw.example || ''
    }));
    if (words.length === 0) return;
    try {
      await addWordsToCustomBank(bank, words);
      setBulkSelected(new Set());
      setShowBulkImport(false);
      setBulkMode(false);
      setAddedFeedback(`已导入 ${words.length} 词到 ${bank}`);
      setTimeout(() => setAddedFeedback(''), 3000);
    } catch (err: any) { alert(err.message || '导入失败'); }
  };

  const selectedDictInfo = DICTIONARIES.find(d => d.id === selectedDict);
  const isPersonalView = selectedDict === 'personal';
  const isMistakesView = selectedDict === 'mistakes';
  const isCustomView = selectedDict?.startsWith('custom:') ?? false;

  if (!selectedDict) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="mb-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">词库查询</h1>
          <p className="text-slate-500">选择一个词库开始浏览单词</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DICTIONARIES.map((dict, index) => {
            const Icon = dict.icon;
            return (
              <motion.button
                key={dict.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => handleSelectDict(dict.id)}
                className={`${dict.bgColor} ${dict.borderColor} ${dict.hoverBg} border-2 rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98]`}
              >
                <div className={`w-14 h-14 ${dict.bgColor} ${dict.color} rounded-2xl flex items-center justify-center mb-6 border ${dict.borderColor}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className={`text-2xl font-bold ${dict.color} mb-2`}>{dict.label}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{dict.description}</p>
              </motion.button>
            );
          })}
          {customBanks.map((bank, i) => (
            <motion.button
              key={`custom:${bank.name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (DICTIONARIES.length + i) * 0.08 }}
              onClick={() => handleSelectDict(`custom:${bank.name}`)}
              className="bg-teal-50 border-teal-200 hover:bg-teal-100 border-2 rounded-2xl p-8 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] relative group"
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank.name); }}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-teal-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mb-6 border border-teal-200">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-teal-600 mb-2">{bank.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">自定义词库 · {bank.creator}</p>
            </motion.button>
          ))}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={() => setShowNewBank(true)}
            className="border-2 border-dashed border-slate-300 hover:border-primary/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] min-h-[240px]"
          >
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
              <Plus className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-400 mb-1">新建词库</h3>
            <p className="text-sm text-slate-400">创建你的专属词汇集合</p>
          </motion.button>
        </div>

        {showNewBank && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewBank(false)}>
            <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-primary mb-4">新建自定义词库</h3>
              <input
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 mb-4"
                placeholder="输入词库名称"
                value={newBankName}
                onChange={e => setNewBankName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateBank(); }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowNewBank(false); setNewBankName(''); }} className="px-4 py-2 text-sm font-bold text-outline hover:text-on-surface">取消</button>
                <button onClick={handleCreateBank} disabled={!newBankName.trim()} className="bg-primary text-white px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50">创建</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="mb-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 返回
          </button>
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            {selectedDictInfo?.label || '词典搜索'}
          </h1>
        </div>
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入英文单词或中文释义..."
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-lg"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
              <div className="h-8 bg-slate-100 rounded w-32 mb-4"></div>
              <div className="h-4 bg-slate-100 rounded w-48 mb-2"></div>
              <div className="h-12 bg-slate-50 rounded-xl mb-4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {isPersonalView && personalFiltered.length > 0 && (
            <section>
              <h2 className="font-headline text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Book className="w-5 h-5" /> 个人词库 ({personalFiltered.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personalFiltered.slice(0, displayLimit).map((word, index) => (
                  <motion.div
                    key={word.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white p-6 rounded-2xl border border-sky-100 shadow-sm"
                    >
                      {bulkMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkSelect(word.english); }}
                          className="absolute top-3 left-3 z-10"
                        >
                          {bulkSelected.has(word.english)
                            ? <CheckSquare className="w-5 h-5 text-primary" />
                            : <Square className="w-5 h-5 text-outline/30" />
                          }
                        </button>
                      )}
                      <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-primary mb-1">{word.english}</h3>
                        <p className="text-slate-500 text-sm italic">/{word.english.toLowerCase()}/</p>
                      </div>
                      <Volume2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="bg-sky-50 p-3 rounded-xl mb-2">
                      <p className="text-sky-900 font-bold">{word.chinese}</p>
                    </div>
                    {word.example && (
                      <p className="text-sm text-slate-500 italic mt-2">"{word.example}"</p>
                    )}
                    <span className="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest text-sky-500 bg-sky-50 px-2 py-1 rounded-full">个人词库</span>
                  </motion.div>
                ))}
              </div>
              {personalFiltered.length > displayLimit && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => setDisplayLimit(prev => Math.min(prev + 200, personalFiltered.length))}
                    className="bg-primary/10 text-primary px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary/20 transition-colors"
                  >
                    加载更多 ({displayLimit}/{personalFiltered.length})
                  </button>
                </div>
              )}
            </section>
          )}

          {selectedDict === 'mistakes' && (
            <section>
              <h2 className="font-headline text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Book className="w-5 h-5" /> 错词本 ({mistakeWords.length})
              </h2>
              {mistakeWords.length === 0 ? (
                <div className="text-center py-12 text-outline">
                  <Book className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-bold">错词本为空</p>
                  <p className="text-sm mt-1">在测试中答错或跳过的单词会自动加入这里</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {mistakeWords.filter(m => {
                    if (!query) return true;
                    const q = query.toLowerCase();
                    return m.word.toLowerCase().includes(q) || m.meaning.includes(q);
                  }).map((m, index) => (
                    <motion.div
                      key={m.word}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-red-800 mb-1">{m.word}</h3>
                        </div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-xl mb-2">
                        <p className="text-red-900 font-bold">{m.meaning}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-outline">
                        <span>错 {m.wrong_count} 次</span>
                        <span>对 {m.correct_count}/3</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!isPersonalView && !isMistakesView && !isCustomView && dictWords.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline text-xl font-bold text-primary flex items-center gap-2">
                  <Book className="w-5 h-5" /> {selectedDictInfo?.label} ({dictWords.length})
                </h2>
                {!isPersonalView && (
                  <button
                    onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${bulkMode ? 'bg-primary text-white' : 'bg-surface-container-low text-outline hover:text-primary'}`}
                  >
                    <Download className="w-3 h-3" />
                    {bulkMode ? '取消选择' : '批量导入'}
                  </button>
                )}
              </div>
              {bulkMode && (
                <div className="flex items-center gap-3 mb-3 px-3 py-2 bg-primary/5 rounded-xl text-sm">
                  <button onClick={handleBulkSelectAll} className="text-xs font-bold text-primary hover:underline">
                    {bulkSelected.size === Math.min(filteredDictWords.length, displayLimit) ? '取消全选' : '全选当前'}
                  </button>
                  <span className="text-outline text-xs">已选 {bulkSelected.size} 词</span>
                  {bulkSelected.size > 0 && (
                    <button onClick={() => setShowBulkImport(true)} className="ml-auto bg-primary text-white px-3 py-1 rounded-lg text-xs font-bold">
                      导入选中
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDictWords.slice(0, displayLimit).map((dw, index) => {
                  const bankCount = (addedWords[dw.word]?.size || 0) + (personalWords.some(pw => pw.english === dw.word) ? 1 : 0);
                  return (
                    <motion.div
                      key={dw.word}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm relative"
                    >
                      {bulkMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkSelect(dw.word); }}
                          className="absolute top-3 left-3 z-10"
                        >
                          {bulkSelected.has(dw.word)
                            ? <CheckSquare className="w-5 h-5 text-primary" />
                            : <Square className="w-5 h-5 text-outline/30" />
                          }
                        </button>
                      )}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-amber-800 mb-1">{dw.word}</h3>
                          <p className="text-slate-500 text-sm italic">/{dw.word.toLowerCase()}/</p>
                        </div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-xl mb-2">
                        <p className="text-amber-900 font-bold">{dw.meaning}</p>
                      </div>
                      {dw.example && (
                        <p className="text-sm text-slate-500 italic mt-2">"{dw.example}"</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          {DICTIONARIES.find(d => d.id === dw.source)?.label || dw.source}
                        </span>
                        {addTarget?.word === dw.word && addedFeedback ? (
                          <span className="text-green-600 text-xs font-bold">{addedFeedback}</span>
                        ) : (
                          <button
                            onClick={() => handleAddFromDict(dw)}
                            className="flex items-center gap-1 text-primary text-xs font-bold hover:underline"
                          >
                            <Plus className="w-4 h-4" /> 添加{bankCount > 0 ? ` (${bankCount})` : ''}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              {dictWords.length > displayLimit && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => setDisplayLimit(prev => Math.min(prev + 200, dictWords.length))}
                    className="bg-primary/10 text-primary px-6 py-2.5 rounded-full font-bold text-sm hover:bg-primary/20 transition-colors"
                  >
                    加载更多 ({displayLimit}/{dictWords.length})
                  </button>
                </div>
              )}
            </section>
          )}

          {isPersonalView && personalFiltered.length === 0 && !query && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">个人词库还没有单词，去内置词典添加一些吧</p>
            </div>
          )}

          {isPersonalView && personalFiltered.length === 0 && query && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">未在个人词库中找到相关词条</p>
            </div>
          )}

          {!isPersonalView && !isMistakesView && !isCustomView && dictWords.length === 0 && !query && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">输入关键词搜索单词</p>
            </div>
          )}

          {!isPersonalView && dictWords.length === 0 && query && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">未找到相关词条，尝试换个关键词？</p>
            </div>
          )}
        </div>
      )}
      {addTarget && (() => {
        const wordBanks = addedWords[addTarget.word] || new Set();
        const inPersonal = personalWords.some(pw => pw.english === addTarget.word);
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setAddTarget(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-primary mb-2">添加到词库</h3>
            <p className="text-sm text-outline mb-4">选择目标词库添加 <span className="font-bold text-primary">{addTarget.word}</span></p>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => confirmAddWord('personal')}
                className="w-full text-left px-4 py-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-sm transition-colors flex items-center justify-between"
              >
                个人词库
                {inPersonal && <Check className="w-4 h-4 text-green-500" />}
              </button>
              {customBanks.map(b => (
                <button
                  key={b.name}
                  onClick={() => confirmAddWord(b.name)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-sm transition-colors flex items-center justify-between"
                >
                  {b.name}
                  {wordBanks.has(b.name) && <Check className="w-4 h-4 text-green-500" />}
                </button>
              ))}
            </div>
            <button onClick={() => setAddTarget(null)} className="w-full text-center text-sm text-outline hover:text-on-surface font-bold">取消</button>
          </div>
        </div>
        );
      })()}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowBulkImport(false)}>
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-primary mb-2">导入到词库</h3>
            <p className="text-sm text-outline mb-4">将选中的 {bulkSelected.size} 个单词导入到：</p>
            {customBanks.length === 0 ? (
              <p className="text-sm text-outline mb-4">暂无自定义词库，请先在首页创建一个</p>
            ) : (
            <div className="space-y-2 mb-4">
              {customBanks.map(b => (
                <button
                  key={b.name}
                  onClick={() => handleBulkImport(b.name)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-sm transition-colors"
                >
                  {b.name}
                </button>
              ))}
            </div>
            )}
            <button onClick={() => setShowBulkImport(false)} className="w-full text-center text-sm text-outline hover:text-on-surface font-bold">取消</button>
          </div>
        </div>
      )}
      {addedFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-secondary-container text-on-secondary-container px-6 py-3 rounded-full font-bold text-sm shadow-lg z-50">
          <Check className="w-4 h-4 inline mr-1" />{addedFeedback}
        </div>
      )}
    </div>
  );
};
