import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { GraduationCap, Gamepad2, Flame, ArrowRight, Plus, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { getDashboardStats, type DashboardStats, type ApiWord } from '../lib/api';
import { User, Word } from '../types';

const weekData = [
  { name: '周一', value: 40 },
  { name: '周二', value: 65 },
  { name: '周三', value: 50 },
  { name: '周四', value: 85 },
  { name: '周五', value: 60 },
  { name: '周六', value: 95 },
  { name: '周日', value: 75 },
];

interface DashboardPageProps {
  onPageChange: (page: any) => void;
  isAdmin?: boolean;
  user?: User;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onPageChange, isAdmin, user }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentWords, setRecentWords] = useState<ApiWord[]>([]);
  const [wordOfDay, setWordOfDay] = useState<ApiWord | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
      loadDashboard();
    }, [user?.id, isAdmin]);
  useEffect(() => { setMounted(true); }, []);
  const isAdminComputed = typeof isAdmin !== 'undefined' ? isAdmin : (user?.role === 'admin');

  /**
   * 从后端加载仪表盘数据
   */
  const loadDashboard = async () => {
    try {
      // 对于普通用户，传入具体用户名以获取该用户的统计；管理员请求全局统计
      const param = isAdminComputed ? 'admin' : (user?.username || user?.id || '');
      const data = await getDashboardStats(param);
      setStats(data);
      setRecentWords(data.recentWords || []);
      setWordOfDay(data.wordOfDay || null);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  const accuracy = stats?.userStats?.accuracy ?? 0;
  const masteredCount = stats?.userStats?.masteredCount ?? 0;
  const streak = stats?.userStats?.streak ?? 0;
  const totalWords = stats?.totalWords ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Hero Header */}
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tighter mb-2">欢迎，{user?.name || ''}。</h1>
          <p className="font-body text-outline text-lg">您的词库共有 <span className="text-secondary font-bold">{totalWords} 个单词</span>。</p>
        </div>
        <div className="flex gap-4">
          {!isAdminComputed && (
            <>
              <button 
                onClick={() => onPageChange('test')}
                className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <GraduationCap className="w-5 h-5 fill-current" />
                开始测试
              </button>
              <button 
                onClick={() => onPageChange('game')}
                className="bg-surface-container-highest text-primary px-8 py-3 rounded-full font-bold uppercase tracking-wider flex items-center gap-2 transition-transform hover:-translate-y-0.5"
              >
                <Gamepad2 className="w-5 h-5" />
                单词接龙
              </button>
            </>
          )}
          {isAdminComputed && (
            <button 
              onClick={() => onPageChange('users')}
              className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
            >
              <Users className="w-5 h-5" />
              管理用户
            </button>
          )}
        </div>
      </header>

      {/* Admin Stats Section */}
      {isAdminComputed && stats && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-primary-fixed text-primary p-6 rounded-xl shadow-sm border border-primary/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">总单词数</h4>
            <p className="text-3xl font-black font-headline">{totalWords}</p>
          </div>
          <div className="bg-secondary-fixed text-secondary p-6 rounded-xl shadow-sm border border-secondary/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">总测试次数</h4>
            <p className="text-3xl font-black font-headline">{stats.totalTests ?? 0}</p>
          </div>
          <div className="bg-tertiary-fixed text-tertiary p-6 rounded-xl shadow-sm border border-tertiary/10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">全局正确率</h4>
            <p className="text-3xl font-black font-headline">{stats.globalAccuracy ?? 0}%</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl shadow-sm border border-slate-100">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-40">系统状态</h4>
            <p className="text-3xl font-black font-headline text-on-surface">运行中</p>
            <p className="text-xs mt-1 font-medium text-on-surface-variant">后端已连接</p>
          </div>
        </section>
      )}

      {/* Bento Grid Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-2 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-headline text-2xl font-bold text-primary mb-6">学习速率</h3>
            <div className="h-48 w-full" style={{ minWidth: 0, minHeight: 200 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData}>
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {weekData.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === weekData.length - 1 ? '#074469' : '#07446920'} 
                          className="hover:fill-primary/40 transition-colors"
                        />
                      ))}
                    </Bar>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 700, fill: '#72787f' }} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
          </div>
        </div>

        {/* Accuracy Rate Orb */}
        <div className="bg-white p-8 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-6">正确率</h3>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" fill="none" r="70" stroke="#f3f3f7" strokeWidth="12" />
              <circle 
                cx="80" 
                cy="80" 
                fill="none" 
                r="70" 
                stroke="#006e1c" 
                strokeWidth="12" 
                strokeDasharray="440" 
                strokeDashoffset={440 - (440 * accuracy / 100)} 
                strokeLinecap="round" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-4xl font-extrabold text-primary">{Math.round(accuracy)}%</span>
            </div>
          </div>
        </div>

        {/* Daily Streak */}
        <div className="bg-tertiary-container text-white p-8 rounded-xl flex flex-col justify-between overflow-hidden relative shadow-sm">
          <div className="relative z-10">
            <h3 className="font-headline text-2xl font-bold mb-2">已掌握</h3>
            <p className="text-tertiary-fixed text-sm">共 {masteredCount} 个单词</p>
          </div>
          <div className="relative z-10 flex items-end gap-1">
            <span className="font-headline text-6xl font-black">{masteredCount}</span>
            <Flame className="w-10 h-10 mb-2 fill-current" />
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12">
            <GraduationCap className="w-32 h-32" />
          </div>
        </div>
      </section>

      {/* Recently Learned & Daily Highlight */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline text-3xl font-bold text-primary">最近收录</h2>
            <button 
              onClick={() => onPageChange('dictionary')}
              className="text-primary font-bold text-sm underline-offset-4 hover:underline"
            >
              查看全部
            </button>
          </div>
          <div className="space-y-4">
            {recentWords.map((word) => (
              <div key={word.id} className="group bg-white p-6 rounded-xl flex items-center justify-between transition-all hover:bg-surface-container-low shadow-sm">
                <div className="flex items-center gap-6">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center font-headline font-bold text-xl",
                    word.status === 'mastered' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"
                  )}>
                    {word.letter}
                  </div>
                  <div>
                    <h4 className="font-headline text-xl font-bold text-on-surface">{word.english}</h4>
                    <p className="text-outline text-sm italic">{word.chinese}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="hidden md:block">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
                      word.status === 'mastered' ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-on-tertiary-fixed"
                    )}>
                      {word.status === 'mastered' ? '已掌握' : word.status === 'learning' ? '学习中' : '新词'}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-outline group-hover:text-primary transition-colors cursor-pointer" />
                </div>
              </div>
            ))}
            {recentWords.length === 0 && (
              <p className="text-center text-outline py-8">暂无词条，请先录入单词。</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="font-headline text-3xl font-bold text-primary">每日一词</h2>
          {wordOfDay ? (
            <div className="bg-white p-1 rounded-2xl shadow-sm overflow-hidden">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img 
                  className="w-full h-full object-cover" 
                  src="https://picsum.photos/seed/book/600/400" 
                  alt="Word of the day"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex items-end p-6">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full">编辑精选</span>
                </div>
              </div>
              <div className="p-8">
                <h3 className="font-headline text-4xl font-extrabold text-primary mb-4 tracking-tighter">{wordOfDay.english}</h3>
                <p className="text-outline text-sm leading-relaxed mb-6">
                  {wordOfDay.chinese}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center text-outline">
              加载中...
            </div>
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <button 
        onClick={() => onPageChange('entry')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 z-50"
      >
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};
