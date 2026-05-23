import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { GraduationCap, Gamepad2, Flame, ArrowRight, Plus, Users, BookOpen, ClipboardCheck, Shield, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import { getDashboardStats, type DashboardStats, type ApiWord, getAdminDashboard, adminGetConfig, getStats } from '../lib/api';
import { User, Word, Page } from '../types';
import type { AdminDashboardStats, SystemConfig } from '../types';

const DAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function buildWeekData(daily: number[]) {
  const today = new Date();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    result.push({
      name: '周' + DAY_SHORT[d.getDay()],
      value: (daily && daily[6 - i]) || 0,
    });
  }
  return result;
}

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
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dailyTests, setDailyTests] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
      loadDashboard();
    }, [user?.id, isAdmin]);
  useEffect(() => { setMounted(true); }, []);
  const isAdminComputed = typeof isAdmin !== 'undefined' ? isAdmin : (user?.role === 'admin');

  const loadDashboard = async () => {
    try {
      const param = isAdminComputed ? 'admin' : (user?.username || user?.id || '');
      const data = await getDashboardStats(param);
      setStats(data);
      setRecentWords(data.recentWords || []);
      setWordOfDay(data.wordOfDay || null);
      if (!isAdminComputed && (user?.username || user?.id)) {
        try {
          const s = await getStats(user.username || user.id || '');
          if (s.daily_tests && Array.isArray(s.daily_tests)) {
            setDailyTests(s.daily_tests);
          }
        } catch {}
      }
      if (isAdminComputed) {
        try { const ads = await getAdminDashboard(); setAdminStats(ads); } catch (e) { console.error('getAdminDashboard failed:', e); }
      }
      try { const cfg = await adminGetConfig(); setAnnouncement(cfg.announcement || ''); } catch {}
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  };

  const accuracy = stats?.userStats?.accuracy ?? 0;
  const masteredCount = stats?.userStats?.masteredCount ?? 0;
  const totalWords = stats?.totalWords ?? 0;

  useEffect(() => {
    if (!adminStats && isAdminComputed && stats) {
      setAdminStats({
        total_users: 0,
        total_words: stats.totalWords ?? 0,
        today_new_words: 0,
        today_tests: 0,
        active_users: [],
      });
    }
  }, [stats, isAdminComputed]);

  const tu = adminStats?.total_users ?? '-';
  const tnw = adminStats?.today_new_words ?? '-';
  const tt = adminStats?.today_tests ?? '-';
  const tw = adminStats?.total_words ?? '-';
  const active = adminStats?.active_users ?? [];

  const quickActions = [
    { label: '词典管理', desc: '管理内置词库', page: 'dictionary_manage' as Page, icon: BookOpen, color: 'from-emerald-500 to-emerald-600' },
    { label: '审核中心', desc: '审批用户提交的单词', page: 'review' as Page, icon: Shield, color: 'from-amber-500 to-orange-500' },
    { label: '用户管理', desc: '管理注册用户', page: 'users' as Page, icon: Users, color: 'from-blue-500 to-indigo-500' },
    { label: '系统配置', desc: '公告与维护模式', page: 'sys_config' as Page, icon: Wrench, color: 'from-slate-600 to-slate-700' },
  ];

  if (isAdminComputed) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">管理仪表盘</h1>
            <p className="text-on-surface-variant font-medium opacity-70">总览系统数据，管理学习平台</p>
          </div>
        </header>

        {announcement && (
          <div className="bg-primary-fixed text-primary px-6 py-4 rounded-xl shadow-sm border border-primary/10 flex items-center gap-3">
            <span className="text-lg">📢</span>
            <p className="font-bold">{announcement}</p>
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container text-white p-7 rounded-2xl shadow-lg shadow-primary/20 group hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">用户</span>
              </div>
              <p className="text-4xl font-black font-headline mb-1">{tu}</p>
              <p className="text-sm font-medium text-white/70">总用户数</p>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-500 text-white p-7 rounded-2xl shadow-lg shadow-emerald-200 group hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">单词</span>
              </div>
              <p className="text-4xl font-black font-headline mb-1">{tnw}</p>
              <p className="text-sm font-medium text-white/70">今日新增单词</p>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-violet-500 text-white p-7 rounded-2xl shadow-lg shadow-violet-200 group hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1 rounded-full">测试</span>
              </div>
              <p className="text-4xl font-black font-headline mb-1">{tt}</p>
              <p className="text-sm font-medium text-white/70">今日用户测试</p>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-700 text-white p-7 rounded-2xl shadow-lg shadow-slate-200 group hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-400/30 text-emerald-300 px-3 py-1 rounded-full">在线</span>
              </div>
              <p className="text-4xl font-black font-headline mb-1">运行中</p>
              <p className="text-sm font-medium text-white/70">系统状态 · 后端已连接</p>
            </div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {active.length > 0 && (
            <div className="lg:col-span-2 bg-surface-container-low p-8 rounded-2xl shadow-sm">
              <h3 className="font-headline text-2xl font-bold text-primary mb-6">活跃用户排行 (近7天)</h3>
              <div className="space-y-3">
                {active.map((u, i) => (
                  <div key={u.username} className="flex items-center gap-4 p-4 bg-surface-container-highest/50 rounded-xl hover:bg-surface-container-highest transition-colors">
                    <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm", i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-surface-container-highest text-outline')}>
                      {i + 1}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-on-surface">{u.username}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-primary">{u.test_count}</p>
                      <p className="text-[10px] text-outline uppercase tracking-wider font-bold">次测试</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cn(active.length === 0 && "lg:col-span-3")}>
            <div className="bg-surface-container-low rounded-2xl p-8 shadow-sm h-full">
              <h3 className="font-headline text-xl font-bold text-primary mb-5">快捷入口</h3>
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((a) => (
                  <button key={a.page} onClick={() => onPageChange(a.page)}
                    className="group relative overflow-hidden rounded-xl p-5 text-white text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className={cn("absolute inset-0 bg-gradient-to-br", a.color)} />
                    <div className="relative z-10">
                      <a.icon className="w-6 h-6 mb-2 opacity-90" />
                      <p className="font-bold text-sm">{a.label}</p>
                      <p className="text-[10px] text-white/70 mt-0.5">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-outline-variant/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-outline font-medium">系统总词量</span>
                  <span className="font-black text-primary text-xl">{tw}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tighter mb-2">欢迎，{user?.name || ''}。</h1>
          <p className="font-body text-outline text-lg">您的词库共有 <span className="text-secondary font-bold">{totalWords} 个单词</span>。</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => onPageChange('test')} className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-full font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
            <GraduationCap className="w-5 h-5 fill-current" />
            开始测试
          </button>
          <button onClick={() => onPageChange('game')} className="bg-surface-container-highest text-primary px-8 py-3 rounded-full font-bold uppercase tracking-wider flex items-center gap-2 transition-transform hover:-translate-y-0.5">
            <Gamepad2 className="w-5 h-5" />
            单词接龙
          </button>
        </div>
      </header>

      {announcement && (
        <div className="bg-primary-fixed text-primary px-6 py-4 rounded-xl shadow-sm border border-primary/10 flex items-center gap-3">
          <span className="text-lg">📢</span>
          <p className="font-bold">{announcement}</p>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div className="md:col-span-2 lg:col-span-2 bg-surface-container-low p-8 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-headline text-2xl font-bold text-primary mb-6">学习速率</h3>
            <div className="h-48 w-full" style={{ minWidth: 0, minHeight: 200 }}>
              {mounted ? (() => {
                const weekData = buildWeekData(dailyTests);
                return (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData}>
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {weekData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === weekData.length - 1 ? '#074469' : '#07446920'} className="hover:fill-primary/40 transition-colors" />
                      ))}
                    </Bar>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#72787f' }} />
                  </BarChart>
                </ResponsiveContainer>
                );
              })() : <div style={{ width: '100%', height: '100%' }} />}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest mb-6">正确率</h3>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" fill="none" r="70" stroke="#f3f3f7" strokeWidth="12" />
              <circle cx="80" cy="80" fill="none" r="70" stroke="#006e1c" strokeWidth="12" strokeDasharray="440" strokeDashoffset={440 - (440 * accuracy / 100)} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-headline text-4xl font-extrabold text-primary">{Math.round(accuracy)}%</span>
            </div>
          </div>
        </div>

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

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-8 rounded-xl flex flex-col justify-between overflow-hidden relative shadow-sm">
          <div className="relative z-10">
            <h3 className="font-headline text-2xl font-bold mb-2">连续打卡</h3>
            <p className="text-amber-100 text-sm">保持学习习惯</p>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="font-headline text-6xl font-black">{stats?.userStats?.streak ?? 0}</span>
            <span className="text-lg font-bold mb-2 text-amber-100">天</span>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-20 transform rotate-12">
            <Flame className="w-32 h-32 fill-current" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline text-3xl font-bold text-primary">最近收录</h2>
            <button onClick={() => onPageChange('dictionary')} className="text-primary font-bold text-sm underline-offset-4 hover:underline">查看全部</button>
          </div>
          <div className="space-y-4">
            {recentWords.map((word) => (
              <div key={word.id} className="group bg-white p-6 rounded-xl flex items-center justify-between transition-all hover:bg-surface-container-low shadow-sm">
                <div className="flex items-center gap-6">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center font-headline font-bold text-xl", word.status === 'mastered' ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary")}>
                    {word.letter}
                  </div>
                  <div>
                    <h4 className="font-headline text-xl font-bold text-on-surface">{word.english}</h4>
                    <p className="text-outline text-sm italic">{word.chinese}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="hidden md:block">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide", word.status === 'mastered' ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-on-tertiary-fixed")}>
                      {word.status === 'mastered' ? '已掌握' : '新词'}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-outline group-hover:text-primary transition-colors cursor-pointer" />
                </div>
              </div>
            ))}
            {recentWords.length === 0 && <p className="text-center text-outline py-8">暂无词条，请先录入单词。</p>}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="font-headline text-3xl font-bold text-primary">每日一词</h2>
          {wordOfDay ? (
            <div className="bg-white p-1 rounded-2xl shadow-sm overflow-hidden">
              <div className="relative h-48 rounded-t-xl overflow-hidden">
                <img className="w-full h-full object-cover" src="https://picsum.photos/seed/book/600/400" alt="Word of the day" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent flex items-end p-6">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full">编辑精选</span>
                </div>
              </div>
              <div className="p-8">
                <h3 className="font-headline text-4xl font-extrabold text-primary mb-4 tracking-tighter">{wordOfDay.english}</h3>
                <p className="text-outline text-sm leading-relaxed mb-6">{wordOfDay.chinese}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl shadow-sm text-center text-outline">加载中...</div>
          )}
        </div>
      </section>

      <button onClick={() => onPageChange('entry')} className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 z-50">
        <Plus className="w-8 h-8" />
      </button>
    </div>
  );
};
