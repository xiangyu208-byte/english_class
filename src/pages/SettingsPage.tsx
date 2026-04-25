import React, { useState } from 'react';
import { Shield, Key, Bell, User as UserIcon, Camera, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { updateUser, changePassword } from '../lib/api';
import { User } from '../types';

interface SettingsPageProps {
  user: User;
  onUpdateUser: (name: string, avatar: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * 保存个人资料到后端
   */
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUser(user.id, { name, avatar });
      onUpdateUser(name, avatar);
      setMessage('个人资料已更新');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('更新失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 修改密码，调用后端 API
   */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('新密码不一致');
      return;
    }

    setSaving(true);
    try {
      await changePassword(user.id, currentPassword, newPassword);
      setMessage('密码修改成功');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('修改失败: ' + (err.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">设置</h1>
        <p className="text-on-surface-variant font-medium opacity-70">管理您的账户偏好与安全设置。</p>
      </header>

      {message && (
        <div className={cn(
          "mb-6 px-4 py-3 rounded-xl text-sm font-medium",
          message.includes('失败') || message.includes('不一致')
            ? "bg-error-container/40 text-on-error-container"
            : "bg-secondary-container/40 text-on-secondary-container"
        )}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-12 gap-8">
        <aside className="col-span-12 lg:col-span-3 space-y-1">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all",
              activeTab === 'profile' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <UserIcon className="w-5 h-5" />
            <span>个人资料</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all",
              activeTab === 'security' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Shield className="w-5 h-5" />
            <span>安全设置</span>
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all",
              activeTab === 'notifications' ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Bell className="w-5 h-5" />
            <span>通知偏好</span>
          </button>
        </aside>

        <main className="col-span-12 lg:col-span-9 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
          {activeTab === 'profile' && (
            <div className="space-y-8">
              <div className="flex items-center gap-8">
                <div className="relative group">
                  <img 
                    className="w-24 h-24 rounded-full object-cover border-4 border-slate-50 shadow-sm" 
                    src={avatar} 
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                  <button className="absolute inset-0 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">头像 URL</label>
                  <input 
                    type="text" 
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">用户名</label>
                  <input 
                    type="text" 
                    value={user.username}
                    disabled
                    className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">姓名</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">电子邮箱</label>
                  <input 
                    type="email" 
                    defaultValue={user.email}
                    disabled
                    className="w-full bg-slate-100 border-none rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-full font-bold hover:shadow-xl transition-all shadow-md disabled:opacity-50"
                  disabled={saving}
                >
                  <Save className="w-5 h-5" />
                  {saving ? '保存中...' : '保存更改'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8">
              <div className="flex items-center gap-3 mb-4">
                <Key className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-primary">修改密码</h2>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">当前密码</label>
                  <input 
                    type="password" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">新密码</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">确认新密码</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:shadow-xl transition-all shadow-md disabled:opacity-50"
                    disabled={saving}
                  >
                    {saving ? '更新中...' : '更新密码'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-primary mb-4">通知设置</h2>
              <div className="space-y-4">
                {[
                  { label: '每日学习提醒', desc: '每天定时提醒您进行词汇复习。' },
                  { label: '新功能更新', desc: '当有新功能或活动时通知我。' },
                  { label: '成就达成通知', desc: '当您获得新勋章或达成目标时通知我。' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                    <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
