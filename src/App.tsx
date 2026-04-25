import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TestPage } from './pages/TestPage';
import { EntryPage } from './pages/EntryPage';
import { GamePage } from './pages/GamePage';
import { SettingsPage } from './pages/SettingsPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { Sidebar, TopNav } from './components/Navigation';
import { Page, User } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { UsersPage } from './pages/UsersPage';
import { setCurrentUserId } from './lib/api';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User>({
    id: '',
    username: '',
    name: '',
    avatar: '',
    email: '',
    role: 'student'
  });

  // 从 sessionStorage 恢复会话和上次所在页面（刷新后保持登录和页面位置）
  const restorePageRef = React.useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('lexical_session');
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (parsed && (parsed.username || parsed.id)) {
          setUser(parsed);
          setIsLoggedIn(true);
          setCurrentUserId(parsed.id || parsed.username || '');
          // 恢复上次所在的页面
          const savedPage = sessionStorage.getItem('lexical_page') as Page | null;
          if (savedPage && savedPage !== 'login') {
            setCurrentPage(savedPage);
            restorePageRef.current = true;
          }
        }
      }
    } catch (e) {}
  }, []);

  // 切换页面并保存到 sessionStorage（刷新后自动回到该页面）
  const changePage = (page: Page) => {
    try { console.debug('App.changePage ->', page); } catch (e) {}
    setCurrentPage(page);
    try { sessionStorage.setItem('lexical_page', page); } catch (e) {}
  };

  const handleLogin = (loggedInUser: User) => {
    const mapped = {
      id: (loggedInUser as any).id || (loggedInUser as any).username || '',
      username: (loggedInUser as any).username || '',
      name: (loggedInUser as any).name || '',
      avatar: (loggedInUser as any).avatar || '',
      email: (loggedInUser as any).email || '',
      role: (loggedInUser as any).role || 'student'
    } as User;
    setIsLoggedIn(true);
    setUser(mapped);
    setCurrentUserId(mapped.id);
    try { sessionStorage.setItem('lexical_session', JSON.stringify(mapped)); } catch (e) {}
    changePage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUserId('');
    setUser({
      id: '',
      username: '',
      name: '',
      avatar: '',
      email: '',
      role: 'student'
    });
    try { sessionStorage.removeItem('lexical_session'); sessionStorage.removeItem('lexical_page'); } catch (e) {}
    changePage('login');
  };

  const handleUpdateUser = (name: string, avatar: string) => {
    setUser(prev => ({ ...prev, name, avatar }));
  };

  const handleSearch = (query: string) => {
    setInitialSearchQuery(query);
    changePage('dictionary');
  };

  const renderPage = () => {
    const isAdmin = user?.role === 'admin';
    
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onPageChange={changePage} isAdmin={isAdmin} user={user} />;
      case 'test':
        return isAdmin ? <DashboardPage onPageChange={changePage} isAdmin={isAdmin} user={user} /> : <TestPage user={user} />;
      case 'entry':
        return <EntryPage user={user} />;
      case 'game':
        return isAdmin ? <DashboardPage onPageChange={changePage} isAdmin={isAdmin} user={user} /> : <GamePage />;
      case 'users':
        return isAdmin ? <UsersPage /> : <DashboardPage onPageChange={changePage} isAdmin={isAdmin} user={user} />;
      case 'settings':
        return <SettingsPage user={user} onUpdateUser={handleUpdateUser} />;
      case 'dictionary':
        return <DictionaryPage initialQuery={initialSearchQuery} />;
      default:
        return <DashboardPage onPageChange={changePage} isAdmin={isAdmin} user={user} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-surface">
      <TopNav 
        currentPage={currentPage} 
        onPageChange={changePage} 
        user={user} 
        onUpdateUser={handleUpdateUser} 
        onSearch={handleSearch}
      />
      <div className="flex">
        <Sidebar 
          currentPage={currentPage} 
          onPageChange={changePage} 
          onLogout={handleLogout} 
          user={user}
        />
        
        <main className="flex-1 lg:pl-64 pt-24 pb-12 px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default App;
