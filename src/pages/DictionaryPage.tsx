import React, { useState, useEffect } from 'react';
import { Search, Book, Plus, Volume2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { getWords, searchDictionary, addWordFromDictionary, type ApiWord, type DictWord } from '../lib/api';
import { getCurrentUserId } from '../lib/api';

const SOURCES = [
  { value: '', label: '全部来源' },
  { value: 'cet4', label: '四级词汇' },
  { value: 'cet6', label: '六级词汇' },
];

export const DictionaryPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState('');
  const [personalWords, setPersonalWords] = useState<ApiWord[]>([]);
  const [dictWords, setDictWords] = useState<DictWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedWords, setAddedWords] = useState<Set<string>>(new Set());
  const userId = getCurrentUserId();

  useEffect(() => {
    loadPersonalWords();
  }, []);

  useEffect(() => {
    if (query || source) {
      const timer = setTimeout(() => loadAll(), 300);
      return () => clearTimeout(timer);
    } else {
      setDictWords([]);
    }
  }, [query, source]);

  const loadPersonalWords = async () => {
    try {
      const data = await getWords('');
      setPersonalWords(data.words);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dict] = await Promise.all([
        searchDictionary(query || undefined, source || undefined),
      ]);
      setDictWords(dict);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromDict = async (dw: DictWord) => {
    if (addedWords.has(dw.word)) return;
    try {
      await addWordFromDictionary(dw.word, dw.meaning, dw.example || '');
      setAddedWords(prev => new Set(prev).add(dw.word));
      await loadPersonalWords();
    } catch (e) {
      console.error(e);
    }
  };

  const personalFiltered = query
    ? personalWords.filter(w =>
        w.english.toLowerCase().includes(query.toLowerCase()) ||
        w.chinese.includes(query)
      )
    : personalWords;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="mb-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-4">词典搜索</h1>
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
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-4 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-sm font-bold text-sky-900"
          >
            {SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
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
          {personalFiltered.length > 0 && (
            <section>
              <h2 className="font-headline text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Book className="w-5 h-5" /> 个人词库 ({personalFiltered.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personalFiltered.map((word, index) => (
                  <motion.div
                    key={word.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white p-6 rounded-2xl border border-sky-100 shadow-sm"
                  >
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
            </section>
          )}

          {dictWords.length > 0 && (
            <section>
              <h2 className="font-headline text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Book className="w-5 h-5" /> 内置词典 ({dictWords.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dictWords.map((dw, index) => {
                  const alreadyAdded = addedWords.has(dw.word) || personalWords.some(pw => pw.english === dw.word);
                  return (
                    <motion.div
                      key={dw.word}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm"
                    >
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
                          {SOURCES.find(s => s.value === dw.source)?.label || dw.source}
                        </span>
                        {alreadyAdded ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                            <Check className="w-4 h-4" /> 已添加
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddFromDict(dw)}
                            className="flex items-center gap-1 text-primary text-xs font-bold hover:underline"
                          >
                            <Plus className="w-4 h-4" /> 添加
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {personalFiltered.length === 0 && dictWords.length === 0 && !query && !source && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">输入关键词搜索单词，或选择分类浏览内置词典</p>
            </div>
          )}

          {personalFiltered.length === 0 && dictWords.length === 0 && (query || source) && (
            <div className="py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">未找到相关词条，尝试换个关键词？</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};