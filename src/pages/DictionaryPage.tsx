import React, { useState, useEffect, useMemo } from 'react';
import { Search, Book, ArrowRight, Volume2, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { getWords, type ApiWord } from '../lib/api';

export const DictionaryPage: React.FC<{ initialQuery?: string }> = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [words, setWords] = useState<ApiWord[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 从后端搜索单词
   */
  const searchWords = async (q: string) => {
    setLoading(true);
    try {
      const data = await getWords(q);
      setWords(data.words);
    } catch (err) {
      console.error('Failed to search:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchWords(query);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchWords(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-4">词典搜索</h1>
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入英文单词或中文释义..."
            className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all text-lg"
          />
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm animate-pulse">
              <div className="h-8 bg-slate-100 rounded w-32 mb-4"></div>
              <div className="h-4 bg-slate-100 rounded w-48 mb-2"></div>
              <div className="h-12 bg-slate-50 rounded-xl mb-4"></div>
              <div className="h-4 bg-slate-100 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {words.map((word, index) => (
            <motion.div 
              key={word.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-primary mb-1">{word.english}</h3>
                  <p className="text-slate-500 text-sm italic">/{word.english.toLowerCase()}/</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors">
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors">
                    <Star className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-sky-900 font-bold">{word.chinese}</p>
                </div>
                
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">例句</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic">"{word.example}"</p>
                </div>
              </div>

              <button className="mt-6 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-white hover:border-primary transition-all">
                查看详情
                <ArrowRight className="w-3 h-3" />
              </button>
            </motion.div>
          ))}

          {words.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center">
              <Book className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">未找到相关词条，尝试换个关键词？</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
