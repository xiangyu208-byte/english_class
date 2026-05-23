import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, X, Flame, BookOpen, GraduationCap, Target, Clock, Shuffle, History, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { getRandomWord, submitTest, getUserStats, type RandomWordResponse, type UserStats, searchDictionary, listWords, getRecords, addMistake, listMistakes, getStats, listCustomBanks } from '../lib/api';
import { User, TestRecord } from '../types';

const BASE_SOURCES = [
  { value: 'personal', label: '个人词库' },
  { value: 'global', label: '全局词库' },
  { value: 'cet4', label: '四级词汇' },
  { value: 'cet6', label: '六级词汇' },
  { value: 'mistakes', label: '错词本' },
];

const DAILY_GOALS = [10, 20, 30, 50, 100];

const LETTERS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const GOAL_STORAGE_KEY = 'lexical_daily_goal';
const MODE_STORAGE_KEY = 'lexical_test_mode';
const TEST_STATE_KEY = 'lexical_test_state';

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

interface TestPageProps {
  user: User;
}

export const TestPage: React.FC<TestPageProps> = ({ user }) => {
  const savedState = (() => {
    try {
      const raw = sessionStorage.getItem(TEST_STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  })();

  const [currentWord, setCurrentWord] = useState<RandomWordResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | 'skipped' | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [questionIndex, setQuestionIndex] = useState(savedState?.questionIndex ?? 0);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [testSource, setTestSource] = useState(savedState?.testSource ?? 'personal');
  const [testLetter, setTestLetter] = useState('');
  const [dailyGoal, setDailyGoal] = useState<number>(() => {
    try { const v = localStorage.getItem(GOAL_STORAGE_KEY); return v ? parseInt(v) : 20; } catch { return 20; }
  });
  const [totalInSource, setTotalInSource] = useState(0);
  const [testMode, setTestMode] = useState<'en2zh' | 'zh2en'>(() => {
    try { return (localStorage.getItem(MODE_STORAGE_KEY) as any) || 'en2zh'; } catch { return 'en2zh'; }
  });
  const [historyDays, setHistoryDays] = useState<{ date: string; label: string; words: TestRecord[] }[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addedToMistakes, setAddedToMistakes] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [customBanks, setCustomBanks] = useState<{ name: string; creator: string }[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');

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

  const loadSourceTotal = useCallback(async () => {
    try {
      if (testSource === 'personal') {
        const words = await listWords(user.id);
        setTotalInSource(words.length);
      } else if (testSource === 'mistakes') {
        try {
          const m = await listMistakes(user.username || user.id);
          setTotalInSource(m.length);
        } catch { setTotalInSource(0); }
      } else if (testSource === 'global') {
        const results = await searchDictionary('');
        setTotalInSource(results.length);
      } else if (testSource.startsWith('custom:')) {
        try {
          const { listCustomBankWords } = await import('../lib/api');
          const w = await listCustomBankWords(testSource.substring(7));
          setTotalInSource(w.length);
        } catch { setTotalInSource(0); }
      } else {
        const results = await searchDictionary('', testSource);
        setTotalInSource(results.length);
      }
    } catch {
      setTotalInSource(0);
    }
  }, [user.id, testSource]);

  const loadHistory = useCallback(async () => {
    try {
      const records = await getRecords(user.username || user.id);
      const dayMap: Record<string, TestRecord[]> = {};
      const now = new Date();
      for (const r of records) {
        if (!r.ts) continue;
        const d = new Date(parseInt(r.ts) * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!dayMap[key]) dayMap[key] = [];
        dayMap[key].push(r);
      }
      const sorted = Object.entries(dayMap)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7)
        .map(([date, words]) => {
          const d = new Date(date);
          const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
          let label = date;
          if (diff === 0) label = '今天';
          else if (diff === 1) label = '昨天';
          else if (diff === 2) label = '前天';
          else label = `${d.getMonth() + 1}月${d.getDate()}日`;
          return { date, label, words };
        });
      setHistoryDays(sorted);
    } catch { /* ignore */ }
  }, [user.username, user.id]);

  const toggleMode = () => {
    const next = testMode === 'en2zh' ? 'zh2en' : 'en2zh';
    setTestMode(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch {}
  };

  const handleAddMistake = async () => {
    if (!currentWord) return;
    try {
      await addMistake(user.username || user.id, currentWord.english, currentWord.meaning || '');
      setAddedToMistakes(true);
    } catch { /* ignore */ }
  };

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
    loadSourceTotal();
    (async () => {
      try {
        const s = await getStats(user.username || user.id);
        if (s.daily_tests && s.daily_tests.length > 0) {
          setTodayCount(s.daily_tests[s.daily_tests.length - 1] || 0);
        }
      } catch {}
    })();
  }, [loadNextWord, loadStats, loadSourceTotal]);

  useEffect(() => {
    try {
      sessionStorage.setItem(TEST_STATE_KEY, JSON.stringify({ questionIndex, testSource }));
    } catch {}
  }, [questionIndex, testSource]);

  useEffect(() => {
    (async () => {
      try { setCustomBanks(await listCustomBanks()); } catch {}
    })();
  }, []);

  const handleSubmit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e?.preventDefault) e.preventDefault();
    if (answer.trim() === '' || !currentWord) return;
    try {
      const given = answer.trim().toLowerCase();
      const target = testMode === 'zh2en'
        ? (currentWord.english || '').toLowerCase()
        : (currentWord.meaning || '').toLowerCase();
      const isCorrect = target && (
        given === target ||
        target.includes(given) ||
        given.includes(target)
      );
      await submitTest(user.id || '', currentWord.id, isCorrect ? 1 : 0, 0, 0);
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      setCorrectAnswer(testMode === 'zh2en' ? (currentWord.english || '') : (currentWord.meaning || ''));
      setTodayCount(prev => prev + 1);
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
    if (!currentWord) return;
    setFeedback('skipped');
    setCorrectAnswer(testMode === 'zh2en' ? (currentWord.english || '') : (currentWord.meaning || ''));
    setTodayCount(prev => prev + 1);
    try { submitTest(user.id || '', currentWord.id, 0, 0, 1); loadStats(); } catch {}
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e?.preventDefault) e.preventDefault();
    setQuestionIndex(prev => prev + 1);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
    setAddedToMistakes(false);
    loadNextWord();
  };

  const handleSourceChange = (source: string) => {
    setTestSource(source);
    setQuestionIndex(0);
    setAnswer('');
    setFeedback(null);
    setCorrectAnswer('');
  };

  const handleGoalChange = (goal: number) => {
    setDailyGoal(goal);
    try { localStorage.setItem(GOAL_STORAGE_KEY, String(goal)); } catch {}
  };

  const mastered = stats?.masteredCount ?? 0;
  const remaining = Math.max(0, totalInSource - mastered);
  const daysNeeded = dailyGoal > 0 ? Math.ceil(remaining / dailyGoal) : 0;

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm text-outline">
              <Target className="w-4 h-4 text-primary" />
              <span>今日已完成</span>
              <span className={cn("font-black text-lg", todayCount >= dailyGoal ? "text-secondary" : "text-primary")}>
                {todayCount}
              </span>
              <span className="text-outline/50">/ {dailyGoal} 词</span>
            </div>
            <div className="flex items-center gap-3 text-on-surface-variant font-medium">
              <span className="text-xs text-outline">已答题</span>
              <span className="text-2xl font-headline font-bold text-primary">{questionIndex + 1}</span>
            </div>
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
            {[...BASE_SOURCES, ...customBanks.map(b => ({ value: `custom:${b.name}`, label: b.name }))].map(s => (
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
        <button
          onClick={toggleMode}
          className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 text-sm font-bold hover:bg-primary/5 transition-colors"
        >
          <Shuffle className="w-4 h-4 text-primary" />
          <span className="text-primary">{testMode === 'en2zh' ? '英 → 中' : '中 → 英'}</span>
        </button>
      </section>

      {totalInSource > 0 && (
        <section className="bg-white rounded-2xl p-5 mb-8 shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-outline font-bold">每日目标</span>
              <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1">
                {DAILY_GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => handleGoalChange(g)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      dailyGoal === g ? 'bg-primary text-white shadow-sm' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    {g}词
                  </button>
                ))}
              </div>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-secondary" />
              <span className="text-outline">
                词库共 <span className="font-black text-primary">{totalInSource}</span> 词
              </span>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex items-center gap-2 text-sm">
              <Flame className="w-4 h-4 text-tertiary" />
              <span className="text-outline">
                已掌握 <span className="font-black text-secondary">{mastered}</span> 词
              </span>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-outline">
                剩余 <span className="font-black text-primary">{remaining}</span> 词
                {dailyGoal > 0 && remaining > 0 && (
                  <span className="ml-1">
                    · 预计
                    <span className="font-black text-secondary mx-1">{daysNeeded}</span>
                    天完成
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="mt-3 w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${totalInSource > 0 ? Math.min((mastered / totalInSource) * 100, 100) : 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest rounded-xl p-12 mb-8 relative overflow-hidden group shadow-sm">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-surface-container-low rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="relative z-10">
              <span className="text-on-surface-variant text-sm font-medium tracking-widest uppercase mb-4 block">{testMode === 'en2zh' ? '翻译成中文' : '翻译成英文'}</span>
              <div className="mb-12">
                {initialLoading ? (
                  <div className="animate-pulse">
                    <div className="h-16 bg-surface-container-low rounded-lg w-64 mb-6"></div>
                    <div className="h-6 bg-surface-container-low rounded w-96"></div>
                  </div>
                ) : currentWord ? (
                  <>
                    <h2 className="font-headline text-5xl font-bold text-primary tracking-tight leading-none mb-6">
                      {testMode === 'en2zh' ? currentWord.english : (currentWord.meaning || currentWord.english)}
                    </h2>
                    {testMode === 'en2zh' && currentWord.example && (
                      <p className="text-on-surface-variant italic font-body text-lg max-w-md">"{currentWord.example}"</p>
                    )}
                    {testMode === 'zh2en' && (
                      <p className="text-on-surface-variant text-sm mt-2">提示：输入对应的英文单词</p>
                    )}
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
                  <p className="text-on-secondary-fixed-variant text-sm">
                    "{answer}"
                    {correctAnswer && (
                      <span className="ml-2 text-secondary font-bold">({correctAnswer})</span>
                    )}
                  </p>
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
                  {!addedToMistakes && (
                    <button
                      onClick={handleAddMistake}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-error bg-error/10 px-3 py-1.5 rounded-lg hover:bg-error/20 transition-colors"
                    >
                      <BookOpen className="w-3 h-3" />
                      加入错词本
                    </button>
                  )}
                  {addedToMistakes && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg">
                      <Check className="w-3 h-3" /> 已加入错词本
                    </span>
                  )}
                </div>
              </motion.div>
            )}
            {feedback === 'skipped' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-surface-container-high rounded-xl p-6 flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-outline/30 rounded-full flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-outline" />
                </div>
                <div>
                  <p className="font-bold text-on-surface font-headline mb-1">已跳过</p>
                  <p className="text-on-surface-variant text-sm">
                    {testMode === 'zh2en' ? '英文：' : '释义：'}
                    <span className="font-bold underline text-primary">{correctAnswer}</span>
                    {testMode === 'en2zh' && currentWord?.english && (
                      <span className="ml-1">（{currentWord.english}）</span>
                    )}
                  </p>
                  {!addedToMistakes && (
                    <button
                      onClick={handleAddMistake}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-outline bg-outline/10 px-3 py-1.5 rounded-lg hover:bg-outline/20 transition-colors"
                    >
                      <BookOpen className="w-3 h-3" />
                      加入错词本
                    </button>
                  )}
                  {addedToMistakes && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg">
                      <Check className="w-3 h-3" /> 已加入错词本
                    </span>
                  )}
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

      {/* Test History */}
      <section className="mt-12">
        <button
          onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) loadHistory(); }}
          className="flex items-center gap-2 text-primary font-bold text-sm hover:underline underline-offset-4 transition-all"
        >
          <History className="w-4 h-4" />
          测试历史
          {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <AnimatePresence>
          {historyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                <div className="flex gap-2 mb-2">
                  {[
                    { key: 'all', label: '全部' },
                    { key: 'correct', label: '正确' },
                    { key: 'wrong', label: '错误' },
                    { key: 'skipped', label: '跳过' },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setHistoryFilter(f.key as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        historyFilter === f.key ? 'bg-primary text-white' : 'bg-surface-container-low text-outline hover:text-on-surface'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {historyDays.length === 0 && (
                  <p className="text-sm text-outline">暂无测试记录</p>
                )}
                {historyDays.map(day => {
                  const filtered = day.words.filter(w => {
                    if (historyFilter === 'all') return true;
                    if (historyFilter === 'correct') return w.result === 1;
                    if (historyFilter === 'wrong') return w.result === 0 && w.skipped === 0;
                    if (historyFilter === 'skipped') return w.skipped === 1;
                    return true;
                  });
                  if (filtered.length === 0) return null;
                  return (
                  <div key={day.date} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                    <h3 className="font-headline font-bold text-primary mb-3">{day.label} · {filtered.length} 词</h3>
                    <div className="flex flex-wrap gap-2">
                      {filtered.map((w, i) => (
                        <span
                          key={`${w.word}-${i}`}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            w.result === 1
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-error/10 text-error'
                          }`}
                        >
                          {w.word}
                          {w.result === 1 ? ' ✓' : ' ✗'}
                        </span>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};