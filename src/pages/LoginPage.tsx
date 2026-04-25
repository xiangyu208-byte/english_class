import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, User as UserIcon, ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { login, register } from '../lib/api';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * 提交登录或注册表单，调用后端 API
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          setError('密码不一致，请重新输入');
          setLoading(false);
          return;
        }
        const res = await register(username, password, email, role, name || username);
        onLogin(res.user as User);
      } else {
        const res = await login(username, password);
        // 后端返回的是 UserInfo，映射为前端期望的 User 结构
        const mapped: User = {
          id: (res as any).username || username,
          username: (res as any).username || username,
          name: (res as any).name || (res as any).username || username,
          avatar: (res as any).avatar || '',
          email: (res as any).email || '',
          role: (res as any).role === 'admin' ? 'admin' : 'student'
        };
        onLogin(mapped);
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-surface">
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[700px] overflow-hidden rounded-xl shadow-sm bg-surface-container-lowest">
        {/* Left Column */}
        <div className="lg:col-span-5 relative flex flex-col justify-between p-12 overflow-hidden bg-primary-container text-white">
          <div className="absolute inset-0 z-0">
            <img 
              alt="Antique encyclopedia pages" 
              className="w-full h-full object-cover mix-blend-overlay opacity-30"
              src="https://picsum.photos/seed/library/1200/1600"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 editorial-gradient opacity-80"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-16">
              <BookOpen className="w-10 h-10 fill-current" />
              <h1 className="font-headline font-extrabold text-2xl tracking-tighter">词汇圣殿</h1>
            </div>
            <div className="space-y-6 max-w-sm">
              <h2 className="font-headline text-5xl font-bold leading-tight">
                {isRegistering ? "加入我们的词汇社区" : "开启您的语言大师之路"}
              </h2>
              <p className="text-primary-fixed leading-relaxed opacity-90 font-light text-lg">
                {isRegistering 
                  ? "创建一个账号，开始记录您的学习进度，并与全球学习者一起精进词汇。" 
                  : "进入文字的数字艺术馆。通过专业的视角提炼您的词汇，掌握语言的艺术。"}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {[1, 2, 3].map((i) => (
                  <img 
                    key={i}
                    alt="User avatar" 
                    className="w-10 h-10 rounded-full border-2 border-primary ring-2 ring-primary-container object-cover"
                    src={`https://picsum.photos/seed/user${i}/100/100`}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-primary-fixed">今天已有 2,400+ 位馆长加入</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center p-8 md:p-16 lg:p-24 bg-surface-container-lowest">
          <div className="w-full max-w-md space-y-10">
            <div className="space-y-2">
              <h3 className="font-headline text-3xl font-bold text-on-surface tracking-tight">
                {isRegistering ? "创建账号" : "欢迎回来"}
              </h3>
              <p className="text-on-surface-variant font-medium">
                {isRegistering ? "请填写以下信息以注册您的圣殿账号。" : "请输入您的凭据以访问圣殿。"}
              </p>
            </div>

            {error && (
              <div className="bg-error-container/40 text-on-error-container px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Role Selection */}
              <div className="space-y-3">
                <label className="font-headline text-sm font-bold text-primary uppercase tracking-widest">
                  {isRegistering ? "选择身份" : "访问模式"}
                </label>
                <div className="grid grid-cols-2 bg-surface-container-low p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setRole('student')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold",
                      role === 'student' ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    <UserIcon className="w-5 h-5" />
                    学习者
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('admin')}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold",
                      role === 'admin' ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    管理员
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="space-y-6">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div 
                    key={isRegistering ? 'reg-name' : 'login-name'}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="relative group"
                    layout
                  >
                    <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">
                      {isRegistering ? "用户名" : "用户名"}
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="absolute left-0 w-5 h-5 text-outline" />
                      <input 
                        className="w-full pl-8 pr-4 py-3 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline/50 font-medium"
                        placeholder={isRegistering ? "请输入用户名" : "请输入用户名"}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                    <div className="h-[1px] w-full bg-outline-variant/30 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary transition-transform duration-300 -translate-x-full group-focus-within:translate-x-0" />
                    </div>
                  </motion.div>

                  {isRegistering && (
                    <>
                      <motion.div 
                        key="name-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative group overflow-hidden"
                        layout
                      >
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">显示名称</label>
                        <div className="relative flex items-center">
                          <UserIcon className="absolute left-0 w-5 h-5 text-outline" />
                          <input 
                            className="w-full pl-8 pr-4 py-3 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline/50 font-medium"
                            placeholder="您的显示名称"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                        <div className="h-[1px] w-full bg-outline-variant/30 relative overflow-hidden">
                          <div className="absolute inset-0 bg-primary transition-transform duration-300 -translate-x-full group-focus-within:translate-x-0" />
                        </div>
                      </motion.div>

                      <motion.div 
                        key="email-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative group overflow-hidden"
                        layout
                      >
                        <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">电子邮箱</label>
                        <div className="relative flex items-center">
                          <Mail className="absolute left-0 w-5 h-5 text-outline" />
                          <input 
                            className="w-full pl-8 pr-4 py-3 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline/50 font-medium"
                            placeholder="example@sanctuary.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div className="h-[1px] w-full bg-outline-variant/30 relative overflow-hidden">
                          <div className="absolute inset-0 bg-primary transition-transform duration-300 -translate-x-full group-focus-within:translate-x-0" />
                        </div>
                      </motion.div>
                    </>
                  )}

                  <motion.div 
                    key="password-field"
                    className="relative group"
                    layout
                  >
                    <div className="flex justify-between items-end mb-1">
                      <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">密码</label>
                      {!isRegistering && (
                        <a className="text-xs font-semibold text-primary hover:underline decoration-2 underline-offset-4" href="#">忘记密码？</a>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-0 w-5 h-5 text-outline" />
                      <input 
                        className="w-full pl-8 pr-4 py-3 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline/50 font-medium"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 text-outline hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="h-[1px] w-full bg-outline-variant/30 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary transition-transform duration-300 -translate-x-full group-focus-within:translate-x-0" />
                    </div>
                  </motion.div>

                  {isRegistering && (
                    <motion.div 
                      key="confirm-password-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative group overflow-hidden"
                      layout
                    >
                      <label className="block text-xs font-bold text-on-surface-variant mb-1 uppercase tracking-wider">确认密码</label>
                      <div className="relative flex items-center">
                        <Lock className="absolute left-0 w-5 h-5 text-outline" />
                        <input 
                          className="w-full pl-8 pr-4 py-3 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline/50 font-medium"
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                      </div>
                      <div className="h-[1px] w-full bg-outline-variant/30 relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary transition-transform duration-300 -translate-x-full group-focus-within:translate-x-0" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <button 
                  className="w-full editorial-gradient text-white py-4 rounded-full font-headline font-bold uppercase tracking-[0.1em] text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "处理中..." : (isRegistering ? "立即注册" : "登录")}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

                <p className="text-center text-xs text-outline">
                  {!isRegistering && "默认账号: admin/admin123 或 student/123456"}
                </p>
              </div>
            </form>

            <div className="text-center pt-8">
              <p className="text-on-surface-variant text-sm">
                {isRegistering ? "已经有账号了？" : "第一次来到圣殿？"}
                <button 
                  onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                  className="text-primary font-bold hover:underline decoration-2 underline-offset-4 ml-1"
                >
                  {isRegistering ? "立即登录" : "申请访问 / 注册"}
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="fixed bottom-8 text-outline-variant text-[10px] uppercase tracking-[0.2em] font-bold">
        由词汇圣殿的馆长们精心打造 © 2024
      </footer>
    </div>
  );
};
