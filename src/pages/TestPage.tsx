import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, X, Flame, BookOpen, GraduationCap } from 'lucide-react';
import { getRandomWord, submitTest, getUserStats, type RandomWordResponse, type UserStats } from '../lib/api';
import { User } from '../types';

const TEST_SOURCES = [
  { value: 'personal', label: '个人词库' },
  { value: 'cet4', label: '四级词汇' },
  { value: 'cet6', label: '六级词汇' },
];

const LETTERS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [testSource, setTestSource] = useState('personal');
  const [testLetter, setTestLetter] = useState('');

  const loadNextWord = useCallback(async () => {
    try {
      const word = await getRandomWord(user.id, testSource, testLetter);
      setCurrentWord(word);
    } catch (err) {
      console.error('Failed to load word:', err);
    } finally {
      setInitialLoading(false);
    }
  }, [user.id, testSource, testLetter]);

  const loadStats = useCallback(async () => {
    try {
      const s = await getUserStats(user.id);
      setStats(s);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [user.id]);

  useEffect(() => {
    setInitialLoading(true);
    loadNextWord();
    loadStats();
  }, [loadNextWord, loadStats]);

  const handleSubmit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e?.preventDefault) e.preventDefault();
    if (answer.trim() === '' || !currentWord) return;
    try {
      const given = answer.trim().toLowerCase();
      const target = (currentWord.meaning || '').toLowerCase();
      const isCorrect = target && (given === target || target.includes(given) || given.includes(target));
      await submitTest(user.id || '', currentWord.id, isCorrect ? 1 : 0, 0, 0);
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      setCorrectAnswer(currentWord.meaning || '');
      loadStats();
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !feedback && !initialLoading) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSkip = (e?: React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setQuestionIndex(prev => prev + 1);
    loadNextWord();
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setQuestionIndex(prev => prev + 1);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
    loadNextWord();
  };

  const handleSourceChange = (source: string) => {
    setTestSource(source);
    setQuestionIndex(0);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
  };

  const handleLetterChange = (letter: string) => {
    setTestLetter(letter);
    setQuestionIndex(0);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="font-headline font-bold text-primary tracking-tight text-sm uppercase">进行中的评估</span>
          <h1 className="font-headline text-5xl font-extrabold text-on-surface tracking-tighter mt-2">词汇测试</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 text-on-surface-variant font-medium">
            <span className="text-sm">已答题</span>
            <span className="text-2xl font-headline font-bold text-primary">{questionIndex + 1}</span>
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

      <section className="flex flex-wrap gap-3 mb-8">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          <GraduationCap className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-on-surface-variant">测试来源:</span>
          <select
            value={testSource}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="text-sm font-bold text-primary bg-transparent border-none focus:ring-0"
          >
            {TEST_SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        {testSource !== 'personal' && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
            <span className="text-xs font-bold text-on-surface-variant">首字母:</span>
            <select
              value={testLetter}
              onChange={(e) => handleLetterChange(e.target.value)}
              className="text-sm font-bold text-primary bg-transparent border-none focus:ring-0"
            >
              <option value="">全部</option>
              {LETTERS.filter(Boolean).map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl p-12 mb-8 relative overflow-hidden group shadow-sm">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-surface-container-low rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative z-10">
              <span className="text-on-surface-variant text-sm font-medium tracking-widest uppercase mb-4 block">翻译成中文</span>
              <div className="mb-12">
                {initialLoading ? (
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
                  <p className="text-outline text-lg">暂无可用单词，请先录入词库或选择其他来源。</p>
                )}
              </div>

              <div className="max-w-md">
                <input
                  className="w-full bg-surface-container-low border-none p-6 text-xl rounded-lg font-body placeholder:text-outline/50 focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="在此输入释义..."
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  disabled={feedback !== null || initialLoading}
                />
                <div className="mt-8 flex items-center gap-4">
                  <button
                    onClick={handleSubmit}
                    className="editorial-gradient text-white rounded-full px-10 py-4 font-headline font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg disabled:opacity-50"
                    disabled={feedback !== null || initialLoading}
                  >
                    提交答案
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
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
              </div>
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
                选择不同的测试来源，拓展你的词汇量。从四级到六级，循序渐进。
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