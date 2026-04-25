import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stars, ArrowRight, CheckCircle, Info, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateGameWord } from '../lib/api';

export const GamePage: React.FC = () => {
  const [gameState, setGameState] = useState<'idle' | 'playing'>('idle');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(['Labyrinthine', 'Eternal', 'Nostalgic', 'Glimmer', 'Radiant']);
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [showBonus, setShowBonus] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [error, setError] = useState('');

  const currentWord = history[history.length - 1];
  const lastLetter = currentWord.charAt(currentWord.length - 1).toUpperCase();

  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setLastScore(score);
          setGameState('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, score]);

  const startGame = () => {
    setHistory(['Labyrinthine', 'Eternal', 'Nostalgic', 'Glimmer', 'Radiant']);
    setScore(0);
    setTimeLeft(60);
    setInput('');
    setError('');
    setGameState('playing');
  };

  /**
   * 提交接龙单词，通过后端验证
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gameState !== 'playing') return;
    if (input.trim().length < 4) {
      setError('单词长度至少 4 个字符');
      return;
    }

    try {
      const result = await validateGameWord(currentWord, input.trim());
      
      if (result.valid) {
        setHistory(prev => [...prev, input.trim()]);
        setScore(prev => prev + (result.score || 500));
        setInput('');
        setError('');
        setTimeLeft(prev => Math.min(prev + 10, 60));
        setShowBonus(true);
        setTimeout(() => setShowBonus(false), 2000);
      } else {
        setError(result.reason || '无效单词');
      }
    } catch (err: any) {
      setError(err.message || '验证失败');
    }
  };

  return (
    <div className="max-w-7xl mx-auto min-h-[80vh] relative">
      <AnimatePresence mode="wait">
        {gameState === 'idle' ? (
          <motion.div 
            key="start-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-8">
              <Stars className="w-16 h-16 text-primary animate-pulse" />
            </div>
            <h1 className="font-headline text-6xl font-black text-primary tracking-tighter mb-4">单词接龙</h1>
            <p className="text-outline text-lg max-w-md mb-12">
              挑战你的词汇量！用上一个单词的末尾字母开始新单词，在限定时间内尽可能接得更长。
            </p>
            
            {lastScore !== null && (
              <div className="mb-12 bg-surface-container-low px-8 py-4 rounded-2xl border border-primary/10">
                <span className="text-xs font-bold text-outline uppercase tracking-widest block mb-1">上次得分</span>
                <span className="text-4xl font-black font-headline text-secondary">{lastScore.toLocaleString()}</span>
              </div>
            )}

            <button 
              onClick={startGame}
              className="bg-gradient-to-br from-primary to-primary-container text-white px-12 py-5 rounded-full font-black text-xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
            >
              开始游戏
              <ArrowRight className="w-6 h-6" />
            </button>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-4xl w-full">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary mb-4">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sky-900 mb-2">规则一</h4>
                <p className="text-sm text-slate-500">单词长度必须大于等于 4 个字符。</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                  <Stars className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sky-900 mb-2">规则二</h4>
                <p className="text-sm text-slate-500">首字母必须与上个单词末尾字母一致。</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="w-10 h-10 bg-tertiary-fixed/10 rounded-lg flex items-center justify-center text-tertiary mb-4">
                  <Stars className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sky-900 mb-2">奖励</h4>
                <p className="text-sm text-slate-500">词库中存在的单词可获得额外分数奖励。</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="game-screen"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-12"
          >
            {/* Game Header */}
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="text-sm font-semibold tracking-wider text-primary/60 uppercase font-headline">本次进度</span>
                <div className="flex items-center gap-4">
                  <div className="bg-surface-container-low px-6 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                    <Stars className="w-6 h-6 text-secondary fill-current" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-black font-headline text-on-surface">{score.toLocaleString()}</span>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">总分</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-low px-6 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                    <Stars className="w-6 h-6 text-primary fill-current" />
                    <div className="flex flex-col">
                      <span className="text-2xl font-black font-headline text-on-surface">{history.length}</span>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">接龙长度</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle className="text-surface-container-highest" cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" strokeWidth="6"></circle>
                    <motion.circle 
                      className={cn("transition-colors", timeLeft < 10 ? "text-error" : "text-secondary")} 
                      cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" 
                      strokeWidth="6"
                      strokeDasharray="226.2"
                      animate={{ strokeDashoffset: 226.2 * (1 - timeLeft / 60) }}
                    />
                  </svg>
                  <span className={cn("text-xl font-black font-headline", timeLeft < 10 ? "text-error animate-pulse" : "text-on-surface")}>{timeLeft}s</span>
                </div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">剩余时间</span>
              </div>
            </div>

            {/* Word Play Zone */}
            <div className="grid grid-cols-12 gap-8 items-start">
              <div className="col-span-12 lg:col-span-8 space-y-8">
                <div className="bg-surface-container-lowest p-16 rounded-[2rem] relative overflow-hidden flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl"></div>
                  <span className="text-xs font-bold tracking-[0.3em] text-outline uppercase mb-4 font-headline">当前目标</span>
                  <h1 className="text-8xl font-black font-headline text-primary tracking-tighter mb-6 relative">
                    {currentWord.slice(0, -1)}<span className="text-secondary">{currentWord.slice(-1)}</span>
                  </h1>

                  {error && (
                    <div className="mb-4 text-error text-sm font-bold">{error}</div>
                  )}

                  <form onSubmit={handleSubmit} className="w-full max-w-md relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black font-headline text-secondary">{lastLetter}</div>
                    <input 
                      className="w-full bg-surface-container-high border-none rounded-full py-6 pl-12 pr-20 text-xl font-bold font-headline focus:ring-2 focus:ring-primary/20 placeholder:text-outline/40 placeholder:font-normal"
                      placeholder="输入下一个单词..."
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      autoFocus
                    />
                    <button 
                      type="submit"
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-gradient-to-br from-primary to-primary-container w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 transition-transform"
                    >
                      <ArrowRight className="w-6 h-6" />
                    </button>
                  </form>
                </div>

                <div className="bg-surface-container-low p-8 rounded-[2rem] shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-headline font-bold text-lg text-primary">历史记录</h3>
                    <span className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-widest">最近 5 个单词</span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {history.slice(-5).reverse().map((word, i) => (
                      <motion.div 
                        key={word + i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-sm"
                      >
                        <span className="text-primary font-bold">{word}</span>
                        <CheckCircle className="w-4 h-4 text-secondary" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="col-span-12 lg:col-span-4 space-y-8">
                <div className="bg-primary p-8 rounded-[2rem] text-white shadow-lg">
                  <Info className="w-8 h-8 mb-4 text-secondary-fixed" />
                  <h4 className="font-headline font-bold text-xl mb-2">玩法说明</h4>
                  <p className="text-primary-fixed/80 text-sm leading-relaxed mb-6">
                    用当前单词的最后一个字母开始你的新单词。词库中存在的词可获得额外分数奖励！
                  </p>
                  <ul className="space-y-3">
                    {['最少 4 个字符', '不可使用专有名词', '正确接龙 +10 秒时间'].map(rule => (
                      <li key={rule} className="flex items-center gap-3 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBonus && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50"
          >
            <div className="bg-secondary-container text-on-secondary-container px-6 py-3 rounded-full font-black font-headline shadow-xl border-4 border-white flex items-center gap-2">
              <PlusCircle className="w-6 h-6 fill-current" />
              接龙成功！
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
