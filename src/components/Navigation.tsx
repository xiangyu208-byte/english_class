import React from 'react';
import { 
  LayoutDashboard, 
  PlusSquare, 
  GraduationCap, 
  Gamepad2, 
  BarChart3, 
  HelpCircle, 
  LogOut,
  Search,
  Bell,
  Settings,
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Page, User } from '../types';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
  user: User;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, onLogout, user }) => {
  const isAdmin = user?.role === 'admin';
  
  const navItems = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
    { id: 'entry', label: '词条录入', icon: PlusSquare },
    ...(isAdmin ? [
      { id: 'users', label: '用户数据', icon: Users },
    ] : [
      { id: 'test', label: '词汇测试', icon: GraduationCap },
      { id: 'game', label: '单词接龙', icon: Gamepad2 },
    ]),
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-slate-50 flex flex-col p-4 gap-2 pt-20 hidden lg:flex border-r border-slate-200">
      <div className="px-2 py-4 flex items-center gap-3 mb-4">
        <img 
          className="w-10 h-10 rounded-lg object-cover" 
          src={user?.avatar || undefined} 
          alt="Avatar"
          referrerPolicy="no-referrer"
        />
        <div>
          <p className="text-sky-900 font-black text-sm">{user?.name || ''}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            {isAdmin ? '管理员模式' : '学习者模式'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPageChange(item.id as Page)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-150 text-sm font-medium",
              currentPage === item.id 
                ? "bg-white shadow-sm text-sky-900 font-bold" 
                : "text-slate-600 hover:translate-x-1 hover:text-sky-700"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-8 mb-4 px-2">
        <button 
          onClick={() => onPageChange('entry')}
          className="w-full bg-gradient-to-br from-primary to-primary-container text-white rounded-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95"
        >
          新建词条
        </button>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <button className="text-slate-600 flex items-center gap-3 p-3 hover:translate-x-1 hover:text-sky-700 transition-all text-sm">
          <HelpCircle className="w-5 h-5" />
          <span>帮助</span>
        </button>
        <button 
          onClick={onLogout}
          className="text-slate-600 flex items-center gap-3 p-3 hover:translate-x-1 hover:text-sky-700 transition-all text-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
};

export const TopNav: React.FC<{ 
  currentPage: Page; 
  onPageChange: (page: Page) => void;
  user: User;
  onUpdateUser: (name: string, avatar: string) => void;
  onSearch: (query: string) => void;
}> = ({ currentPage, onPageChange, user, onUpdateUser, onSearch }) => {
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const isAdmin = user?.role === 'admin';

  const getPageTitle = (id: Page) => {
    if (isAdmin && (id === 'test' || id === 'game')) return '仪表盘';
    switch (id) {
      case 'dashboard': return '仪表盘';
      case 'test': return '测评';
      case 'entry': return '词条录入';
      case 'game': return '单词接龙';
      case 'users': return '用户数据';
      case 'settings': return '设置';
      case 'dictionary': return '词典搜索';
      default: return '仪表盘';
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
      setSearchQuery('');
    }
  };

  const [editingName, setEditingName] = React.useState(false);
  const [newName, setNewName] = React.useState(user?.name || '');
  const [editingAvatar, setEditingAvatar] = React.useState(false);
  const [newAvatar, setNewAvatar] = React.useState(user?.avatar || '');

  const handleUpdateProfile = () => {
    onUpdateUser(newName, newAvatar);
    setEditingName(false);
    setEditingAvatar(false);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 h-16 shadow-sm font-headline tracking-tight">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onPageChange('dashboard')}>
          <span className="text-xl font-black text-sky-900">Lexical Sanctuary</span>
          <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block"></div>
          <span className="text-sm font-bold text-primary hidden md:block">{getPageTitle(currentPage)}</span>
        </div>
        <div className="hidden md:flex gap-6 items-center">
          <button 
            onClick={() => onPageChange('dashboard')} 
            className={cn(
              "font-semibold transition-colors text-sm",
              currentPage === 'dashboard' ? "text-sky-700 border-b-2 border-sky-700" : "text-slate-500 hover:text-sky-600"
            )}
          >
            仪表盘
          </button>
          {!isAdmin && (
            <>
              <button 
                onClick={() => onPageChange('test')} 
                className={cn(
                  "font-semibold transition-colors text-sm",
                  currentPage === 'test' ? "text-sky-700 border-b-2 border-sky-700" : "text-slate-500 hover:text-sky-600"
                )}
              >
                测评
              </button>
              <button 
                onClick={() => onPageChange('game')} 
                className={cn(
                  "font-semibold transition-colors text-sm",
                  currentPage === 'game' ? "text-sky-700 border-b-2 border-sky-700" : "text-slate-500 hover:text-sky-600"
                )}
              >
                接龙
              </button>
            </>
          )}
          {isAdmin && (
            <button 
              onClick={() => onPageChange('users')} 
              className={cn(
                "font-semibold transition-colors text-sm",
                currentPage === 'users' ? "text-sky-700 border-b-2 border-sky-700" : "text-slate-500 hover:text-sky-600"
              )}
            >
              用户
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="bg-slate-100 rounded-full px-4 py-1.5 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input 
            className="bg-transparent border-none focus:ring-0 text-sm w-48" 
            placeholder="搜索词典..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
        <div className="flex items-center gap-2 relative">
          <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <Bell className="w-5 h-5 text-sky-900" />
          </button>
          <button 
            onClick={() => onPageChange('settings')}
            className="p-2 hover:bg-slate-50 rounded-full transition-colors"
          >
            <Settings className="w-5 h-5 text-sky-900" />
          </button>
          <div className="relative">
            <img 
              className="w-8 h-8 rounded-full border border-sky-900/10 object-cover cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all" 
              src={user?.avatar || undefined} 
              alt="Avatar"
              referrerPolicy="no-referrer"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            />
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 space-y-4">
                <div className="border-b border-slate-50 pb-2">
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        className="text-sm font-bold text-sky-900 bg-slate-50 border-none rounded px-2 py-1 w-full"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        autoFocus
                      />
                      <button onClick={handleUpdateProfile} className="text-primary text-xs font-bold">保存</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-sky-900">{user?.name || ''}</p>
                        <p className="text-[10px] text-slate-500 uppercase">
                          {isAdmin ? '管理员' : '学习者'}
                        </p>
                      </div>
                      <button onClick={() => setEditingName(true)} className="text-slate-400 hover:text-primary transition-colors">
                        <Settings className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">更改头像</p>
                  {editingAvatar ? (
                    <div className="flex items-center gap-2">
                      <input 
                        className="text-[10px] text-slate-600 bg-slate-50 border-none rounded px-2 py-1 w-full"
                        value={newAvatar}
                        onChange={(e) => setNewAvatar(e.target.value)}
                        placeholder="输入头像 URL"
                      />
                      <button onClick={handleUpdateProfile} className="text-primary text-xs font-bold">保存</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <img src={user?.avatar || undefined} className="w-8 h-8 rounded-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                      <button onClick={() => setEditingAvatar(true)} className="text-primary text-xs font-bold hover:underline">修改</button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-50">
                  <button 
                    onClick={() => { onPageChange('settings'); setShowProfileMenu(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    详细设置
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
