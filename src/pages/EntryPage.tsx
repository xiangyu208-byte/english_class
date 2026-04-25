import React, { useState, useEffect } from 'react';
import { Upload, Edit2, Trash2, BarChart3, CloudUpload } from 'lucide-react';
import { cn } from '../lib/utils';
import { addWord, deleteWord, listWords, type ApiWord } from '../lib/api';
import { User } from '../types';

interface EntryPageProps {
  user: User;
}

export const EntryPage: React.FC<EntryPageProps> = ({ user }) => {
  const [english, setEnglish] = useState('');
  const [chinese, setChinese] = useState('');
  const [example, setExample] = useState('');
  const [recentWords, setRecentWords] = useState<ApiWord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadWords();
  }, []);

  /**
   * 加载最近录入的词条
   */
  const loadWords = async () => {
    try {
      const username = user?.username || user?.id || '';
      const arr = await listWords(username, false).catch(() => [] as any[]);
      console.debug('EntryPage.loadWords: fetched', arr);
      const mapped: ApiWord[] = (arr || []).map((w: any) => ({ id: w.word, english: w.word, chinese: w.meaning, example: w.example, status: w.status, letter: w.word ? w.word.charAt(0).toUpperCase() : undefined, createdBy: w.creator }));
      setRecentWords(mapped.slice(0, 4));
      setTotalCount(mapped.length);
    } catch (err) {
      console.error('Failed to load words:', err);
    }
  };

  /**
   * 提交新单词到后端
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!english.trim() || !chinese.trim()) return;

    setSaving(true);
    try {
      // 确保传入 creator 字段，后端要求 creator 非空
      const payload = {
        word: english.trim(),
        meaning: chinese.trim(),
        example: example.trim(),
        pos: '',
        origin: '',
        creator: user?.username || user?.id || '',
        status: '进行中'
      };
      console.debug('EntryPage.handleSubmit: adding word', payload);
      await addWord(payload as any);
      console.debug('EntryPage.handleSubmit: addWord succeeded');
      setEnglish('');
      setChinese('');
      setExample('');
      setMessage('单词已成功保存到圣殿！');
      loadWords();
      console.debug('EntryPage.handleSubmit: loadWords triggered');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('保存失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 删除单词
   */
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个单词吗？')) return;
    try {
      await deleteWord(id);
      loadWords();
    } catch (err) {
      console.error('Failed to delete word:', err);
    }
  };

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

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">英文单词</label>
              <input 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" 
                placeholder="例如：Ephemeral" 
                type="text"
                value={english}
                onChange={(e) => setEnglish(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">中文释义</label>
              <input 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all" 
                placeholder="例如：朝生暮死" 
                type="text"
                value={chinese}
                onChange={(e) => setChinese(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">例句</label>
              <textarea 
                className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 transition-all resize-none" 
                placeholder="此单词在高端社论语境下如何使用？" 
                rows={4}
                value={example}
                onChange={(e) => setExample(e.target.value)}
              ></textarea>
            </div>
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-400 font-medium">数据将保存到后端 CSV</span>
              <button 
                type="submit"
                className="bg-primary text-white px-10 py-3 rounded-full font-bold hover:shadow-xl transition-all shadow-md disabled:opacity-50"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存到圣殿'}
              </button>
            </div>
          </form>
        </section>

        {/* Recent Entries */}
        <section className="col-span-12 lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-primary">最近录入</h2>
            <span className="text-sm font-medium text-slate-400">共 {totalCount} 项</span>
          </div>
          
          {recentWords.map((word, idx) => (
            <div key={word.id} className={cn(
              "rounded-2xl p-6 flex items-start gap-6 transition-all hover:translate-x-2 group shadow-sm",
              idx % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low"
            )}>
              <div className={cn(
                "flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold",
                word.status === 'mastered' ? "bg-secondary-container text-on-secondary-container" : "bg-primary-fixed text-primary"
              )}>
                {word.letter}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-2xl font-bold text-primary tracking-tight">{word.english}</h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit2 className="w-5 h-5" /></button>
                    <button 
                      className="p-2 text-slate-400 hover:text-error transition-colors"
                      onClick={() => handleDelete(word.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-secondary font-bold mb-3">{word.chinese}</p>
                <p className="text-sm text-on-surface-variant italic leading-relaxed">{word.example}</p>
              </div>
            </div>
          ))}

          {recentWords.length === 0 && (
            <div className="text-center py-12 text-outline">
              暂无词条，请使用左侧表单添加第一个单词。
            </div>
          )}
        </section>
      </div>

      {/* Stats */}
      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-primary p-8 rounded-[2rem] text-white relative overflow-hidden group shadow-lg">
          <div className="relative z-10">
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">词库总量</h4>
            <p className="text-4xl font-black mb-4">{totalCount} <span className="text-lg font-normal opacity-80">个单词</span></p>
            <div className="h-1 bg-white/20 rounded-full w-full overflow-hidden">
              <div className="h-full bg-white w-2/3"></div>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10 scale-150 group-hover:rotate-12 transition-transform duration-500">
            <BarChart3 className="w-32 h-32 fill-current" />
          </div>
        </div>

        <div className="bg-secondary-container p-8 rounded-[2rem] text-on-secondary-container flex flex-col justify-between shadow-lg">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">数据存储</h4>
            <p className="text-2xl font-bold">CSV 文件存储</p>
          </div>
          <p className="text-sm opacity-70 mt-4">数据通过 C++ 文件流读写</p>
        </div>

        <div className="bg-surface-container-high p-8 rounded-[2rem] border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-surface-container-highest transition-colors">
          <CloudUpload className="w-10 h-10 text-primary mb-2 group-hover:scale-110 transition-transform" />
          <p className="font-bold text-primary">批量导入 (即将推出)</p>
          <p className="text-xs text-on-surface-variant mt-1">CSV 格式批量上传词条</p>
        </div>
      </section>
    </div>
  );
};
