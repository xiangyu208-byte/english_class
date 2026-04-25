import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, X, Flame, BookOpen } from 'lucide-react';
import { getRandomWord, submitTest, getUserStats, type RandomWordResponse, type UserStats } from '../lib/api';
import { User } from '../types';

interface TestPageProps {
  user: User;
}

export const TestPage: React.FC<TestPageProps> = ({ user }) => {
  const [currentWord, setCurrentWord] = useState<RandomWordResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * 从后端加载随机单词
   */
  const loadNextWord = useCallback(async () => {
    try {
      setLoading(true);
      const word = await getRandomWord(user.id);
      setCurrentWord(word);
    } catch (err) {
      console.error('Failed to load word:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  /**
   * 加载用户统计数据
   */
  const loadStats = useCallback(async () => {
    try {
      const s = await getUserStats(user.id);
      setStats(s);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [user.id]);

  useEffect(() => {
    loadNextWord();
    loadStats();
  }, [loadNextWord, loadStats]);

  /**
   * 提交答案到后端验证
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim() === '' || !currentWord) return;
    
    try {
      console.debug('TestPage.handleSubmit: submitting', { userId: user.id, word: currentWord.id, answer });
      // 简单判断：把答题与后端提供的 meaning 做不区分大小写比较，若包含则视为正确
      const given = answer.trim().toLowerCase();
      const target = (currentWord.meaning || '').toLowerCase();
      const isCorrect = target && (given === target || target.includes(given) || given.includes(target));
      // 记录到后端
      await submitTest(user.id || '', currentWord.id, isCorrect ? 1 : 0, 0, 0);
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      setCorrectAnswer(currentWord.meaning || '');
      console.debug('TestPage.handleSubmit: submitTest finished', { isCorrect });
      // 不自动跳到下一个单词，保留当前结果，用户手动点击“下一个”继续
      // 更新本地统计
      loadStats();
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  };

  const handleSkip = () => {
    setQuestionIndex(prev => prev + 1);
    loadNextWord();
  };

  const handleNext = () => {
    setQuestionIndex(prev => prev + 1);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
    loadNextWord();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="font-headline font-bold text-primary tracking-tight text-sm uppercase">进行中的评估</span>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter mt-2">词汇测试</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-on-surface-variant font-medium">
            <span className="text-sm">已答题</span>
            <span className="text-2xl font-headline font-bold text-primary">
              {questionIndex + 1}
            </span>
          </div>
          <div className="w-48 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary rounded-full" 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(((questionIndex + 1) / 20) * 100, 100)}%` }}
            />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl p-12 mb-8 relative overflow-hidden group shadow-sm">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-surface-container-low rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative z-10">
              <span className="text-on-surface-variant text-sm font-medium tracking-widest uppercase mb-4 block">翻译成中文</span>
              <div className="mb-12">
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-16 bg-surface-container-low rounded-lg w-64 mb-6"></div>
                    <div className="h-6 bg-surface-container-low rounded w-96"></div>
                  </div>
                ) : currentWord ? (
                  <>
                    <h2 className="font-headline text-7xl font-bold text-primary tracking-tight leading-none mb-6">{currentWord.english}</h2>
                    <p className="text-on-surface-variant italic font-body text-lg max-w-md">"{currentWord.example}"</p>
                  </>
                ) : (
                  <p className="text-outline text-lg">暂无可用单词，请先录入词库。</p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="max-w-md">
                <input 
                  className="w-full bg-surface-container-low border-none p-6 text-xl rounded-lg font-body placeholder:text-outline/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="在此输入释义..."
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoFocus
                  disabled={feedback !== null || loading}
                />
                <div className="mt-8 flex items-center gap-4">
                  <button 
                    type="submit"
                    className="editorial-gradient text-white rounded-full px-10 py-4 font-headline font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg disabled:opacity-50"
                    disabled={feedback !== null || loading}
                  >
                    提交答案
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={handleSkip}
                    className="text-primary font-bold text-sm tracking-widest uppercase hover:underline underline-offset-8 transition-all px-4"
                    disabled={feedback !== null}
                  >
                    跳过
                  </button>
                  {feedback !== null && (
                    <button onClick={handleNext} className="ml-2 bg-surface-container-high text-primary px-4 py-2 rounded-full font-bold text-sm">下一个</button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {feedback === 'correct' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-secondary-container/30 rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-on-secondary-container font-headline mb-1">太棒了！</p>
                  <p className="text-on-secondary-fixed-variant text-sm">"{answer}" 非常准确。你对这个单词的掌握程度正在提高。</p>
                </div>
              </motion.div>
            )}
            {feedback === 'incorrect' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-error-container/40 rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-error rounded-full flex items-center justify-center shrink-0">
                  <X className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-on-error-container font-headline mb-1">不完全对...</p>
                  <p className="text-on-error-container text-sm">正确答案：<span className="font-bold underline">{correctAnswer}</span>。继续加油！</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-12 flex items-center gap-4 z-20">
            <div className="bg-secondary-container/90 backdrop-blur px-6 py-3 rounded-full flex items-center gap-3 shadow-xl border border-white/20">
              <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></div>
              <span className="text-sm font-black text-on-secondary-container uppercase tracking-tighter">已掌握: {stats?.masteredCount ?? 0}</span>
            </div>
            <div className="bg-tertiary-fixed/90 backdrop-blur px-6 py-3 rounded-full flex items-center gap-3 shadow-xl border border-white/20">
              <div className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse"></div>
              <span className="text-sm font-black text-on-tertiary-fixed uppercase tracking-tighter">连续正确: {stats?.streak ?? 0}</span>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-4 space-y-8">
          <div className="bg-surface-container-low rounded-xl p-8 shadow-sm">
            <h3 className="font-headline font-bold text-lg mb-6 text-primary">本次统计</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant text-sm">正确率</span>
                <span className="font-headline font-bold text-secondary">{stats?.accuracy ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant text-sm">总测试数</span>
                <span className="font-headline font-bold text-on-surface">{stats?.totalTests ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-on-surface-variant text-sm">连续正确</span>
                <div className="flex items-center gap-1">
                  <Flame className="w-5 h-5 text-tertiary fill-current" />
                  <span className="font-headline font-bold text-tertiary">{stats?.streak ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden aspect-square flex flex-col justify-end p-8 group shadow-sm">
            <img 
              alt="Library" 
              className="absolute inset-0 object-cover group-hover:scale-105 transition-transform duration-700"
              src="https://picsum.photos/seed/library2/600/600"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent"></div>
            <div className="relative z-10">
              <span className="text-tertiary-fixed text-xs font-bold uppercase tracking-widest mb-2 block">馆长贴士</span>
              <p className="text-white font-body text-sm leading-relaxed">
                "Ephemeral" 源于希腊语 'ephēmeros'，意为仅持续一天。想象一下那些寿命只有几小时的蜉蝣。
              </p>
            </div>
          </div>

          <div className="bg-primary p-8 rounded-xl text-white shadow-lg">
            <h4 className="font-headline font-bold text-lg mb-2">遇到困难了？</h4>
            <p className="text-primary-fixed/80 text-sm mb-6 leading-relaxed">你可以随时回到课程体系中复习相关的词族。</p>
            <button className="inline-flex items-center gap-2 text-primary-fixed font-bold text-sm tracking-wide group">
              复习词汇
              <BookOpen className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
};
